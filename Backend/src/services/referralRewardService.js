import mongoose from 'mongoose';
import Referral from '../models/Referral.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import UserTransaction from '../models/UserTransaction.js';
import { sendPushNotification } from './notificationService.js';

// Include returned orders: a return must not make a subsequent order the first delivery.
export const findFirstDeliveredOrder = (userId, session = null) => Order.findOne({
  user: userId,
  $or: [
    { 'deliveryTimestamps.deliveredAt': { $ne: null } },
    { status: { $in: ['delivered', 'return_requested', 'return_pickup_scheduled', 'return_picked_up', 'returned'] } }
  ]
}).sort({ 'deliveryTimestamps.deliveredAt': 1, createdAt: 1, _id: 1 }).session(session);

// All writes participate in the same transaction. No notification is sent until commit.
export const applyReferralRewards = async ({ referralId, settings, order = null }) => {
  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      result = null; // withTransaction can retry the callback after a write conflict.
      const referral = await Referral.findOne({ _id: referralId, status: 'registered' }).session(session);
      if (!referral) return;

      const referrer = await User.findOneAndUpdate(
        { _id: referral.referrer, isActive: { $ne: false } },
        { $inc: { referralRewardRevision: 1 } },
        { new: true, session }
      );
      if (!referrer) throw new Error('Referral referrer is unavailable');
      const referee = await User.findById(referral.referee).session(session);
      if (!referee || referee.isActive === false) throw new Error('Referral recipient is unavailable');

      if (order) {
        // Re-read authoritative order state, including retries after returns/refunds.
        const firstOrder = await findFirstDeliveredOrder(referral.referee, session);
        if (!firstOrder) return;
        if (firstOrder.status !== 'delivered' || firstOrder.paymentStatus !== 'paid' ||
            !Number.isFinite(Number(firstOrder.totalAmount)) || Number(firstOrder.totalAmount) < settings.minOrderValue) {
          referral.status = 'cancelled';
          referral.orderId = firstOrder._id;
          referral.cancellationReason = 'First delivered order did not qualify';
          await referral.save({ session });
          return;
        }
        order = firstOrder;
      }

      const count = await Referral.countDocuments({ referrer: referral.referrer, status: 'rewarded' }).session(session);
      if (settings.maxReferralsPerUser > 0 && count >= settings.maxReferralsPerUser) {
        referral.status = 'cancelled';
        referral.cancellationReason = 'Referrer reward cap reached';
        await referral.save({ session });
        return;
      }

      const amounts = { referrer: settings.referrerRewardAmount, referee: settings.refereeRewardAmount };
      for (const role of ['referrer', 'referee']) {
        const amount = amounts[role];
        if (amount <= 0) continue;
        const credited = await User.findByIdAndUpdate(referral[role], { $inc: { walletBalance: amount } }, { session, new: true });
        if (!credited) throw new Error('Referral wallet recipient is missing');
        await UserTransaction.create([{
          user: referral[role], amount, type: 'credit', category: 'referral_reward', status: 'completed',
          description: role === 'referrer' ? 'Referral reward for inviting a friend' : 'Welcome referral bonus',
          orderId: order?._id || null, referralId: referral._id, referralRole: role
        }], { session });
      }
      referral.status = 'rewarded';
      referral.orderId = order?._id || null;
      referral.referrerReward = amounts.referrer;
      referral.refereeReward = amounts.referee;
      referral.rewardedAt = new Date();
      await referral.save({ session });
      result = { referrerAmount: amounts.referrer, refereeAmount: amounts.referee,
        referrer: referral.referrer, referee: referral.referee };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await session.endSession();
  }
  if (result) {
    for (const role of ['referrer', 'referee']) {
      const amount = result[`${role}Amount`];
      if (amount <= 0) continue;
      sendPushNotification(result[role], 'User', {
        title: role === 'referrer' ? 'Referral Cashback Earned!' : 'Welcome Referral Bonus!',
        body: `₹${amount} referral cashback has been credited to your Saathi Wallet.`
      }, { type: 'referral_reward', amount: String(amount), route: '/wallet' })
        .catch(error => console.error('[REFERRAL_NOTIFICATION_ERROR]', error));
    }
  }
  return result;
};
