import mongoose from 'mongoose';
import Referral from '../models/Referral.js';
import User from '../models/User.js';
import GlobalSetting from '../models/GlobalSetting.js';
import { ensureUserReferralCode } from '../utils/generateReferralCode.js';
import { applyReferralRewards, findFirstDeliveredOrder } from './referralRewardService.js';
import { buildReferralSettings } from '../utils/referralSettings.js';

/**
 * Get or default referral settings
 */
export const getActiveReferralSettings = async () => {
  let settings = await GlobalSetting.findOne();
  if (!settings) {
    settings = await GlobalSetting.create({});
  }

  return buildReferralSettings(settings);
};

/** Persist attribution idempotently; the user record remains the recovery source. */
export const recordReferralSignup = async ({ referrerId, refereeId, referralCode }) => {
  if (!referrerId || !refereeId || String(referrerId) === String(refereeId)) return null;
  let referral;
  try {
    referral = await Referral.findOneAndUpdate({ referee: refereeId }, {
      $setOnInsert: { referrer: referrerId, referee: refereeId,
        referralCode: String(referralCode).trim().toUpperCase(), status: 'registered' }
    }, { upsert: true, new: true, runValidators: true });
  } catch (error) {
    // Concurrent signup/recovery can race on the unique referee index.
    if (error.code !== 11000) throw error;
    referral = await Referral.findOne({ referee: refereeId });
    if (!referral) throw error;
  }
  await User.updateOne({ _id: refereeId }, { $set: { referralRecoveryPending: false } });
  const settings = await getActiveReferralSettings();
  if (settings.isEnabled && settings.rewardTrigger === 'registration' && referral.status === 'registered') {
    await applyReferralRewards({ referralId: referral._id, settings });
  }
  return referral;
};

/** Rebuild missed bookkeeping from persisted signup attribution. Safe to retry. */
export const recoverUserReferral = async (userOrId) => {
  const user = typeof userOrId === 'object' && userOrId?.referredBy !== undefined
    ? userOrId : await User.findById(userOrId);
  if (!user?.referredBy) return null;
  let code = user.signupReferralCode;
  if (!code) {
    const referrer = await User.findById(user.referredBy).select('referralCode');
    code = referrer?.referralCode;
  }
  if (!code) throw new Error('Referral attribution code is unavailable');
  return recordReferralSignup({ referrerId: user.referredBy, refereeId: user._id, referralCode: code });
};

export const processOrderDeliveryReferral = async (order) => {
  if (!order?.user || order.status !== 'delivered') return null;
  try {
    const settings = await getActiveReferralSettings();
    if (!settings.isEnabled) return null;
    const referral = await recoverUserReferral(order.user);
    if (!referral || referral.status !== 'registered' || settings.rewardTrigger !== 'first_order_delivered') return null;
    return await applyReferralRewards({ referralId: referral._id, settings, order });
  } catch (error) {
    // Delivery itself must succeed; persistent pending records are retried by the worker.
    console.error('[PROCESS_ORDER_DELIVERY_REFERRAL_ERROR]', error);
    return null;
  }
};

let recoveryRunning = false;
export const retryPendingReferrals = async () => {
  if (recoveryRunning || mongoose.connection.readyState !== 1) return;
  recoveryRunning = true;
  try {
    const users = await User.find({ referralRecoveryPending: true }).sort({ updatedAt: 1 }).limit(100);
    for (const user of users) {
      try { await recoverUserReferral(user); }
      catch (error) {
        await User.updateOne({ _id: user._id }, { $set: { referralRecoveryPending: true } });
        console.error('[REFERRAL_SIGNUP_RECOVERY_ERROR]', error);
      }
    }
    const settings = await getActiveReferralSettings();
    if (!settings.isEnabled) return;
    const pending = await Referral.find({ status: 'registered' }).sort({ updatedAt: 1 }).limit(100);
    for (const referral of pending) {
      try {
        const order = settings.rewardTrigger === 'registration' ? null : await findFirstDeliveredOrder(referral.referee);
        if (settings.rewardTrigger === 'registration' || order) {
          await applyReferralRewards({ referralId: referral._id, settings, order });
        }
      } catch (error) { console.error('[REFERRAL_REWARD_RETRY_ERROR]', error); }
      // Rotate attempted and not-yet-eligible records so one batch cannot starve others.
      await Referral.updateOne({ _id: referral._id }, { $set: { updatedAt: new Date() } });
    }
  } finally { recoveryRunning = false; }
};

/** User referral dashboard, including recovery after transient signup failures. */
export const getUserReferralDashboard = async (userId) => {
  try { await recoverUserReferral(userId); }
  catch (error) { console.error('[REFERRAL_DASHBOARD_RECOVERY_ERROR]', error); }
  const user = await User.findById(userId).select('name phone referralCode walletBalance');
  if (!user) throw new Error('User not found');

  const referralCode = await ensureUserReferralCode(user);
  const settings = await getActiveReferralSettings();

  const [totalInvited, totalRewarded, referrals, earningsAgg] = await Promise.all([
    Referral.countDocuments({ referrer: userId }),
    Referral.countDocuments({ referrer: userId, status: 'rewarded' }),
    Referral.find({ referrer: userId })
      .populate('referee', 'name phone createdAt profileImage')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Referral.aggregate([
      { $match: { referrer: new mongoose.Types.ObjectId(userId), status: 'rewarded' } },
      { $group: { _id: null, total: { $sum: '$referrerReward' } } }
    ])
  ]);

  const totalEarned = earningsAgg[0]?.total || 0;

  // Mask referee phone numbers for privacy
  const formattedReferrals = referrals.map(ref => {
    const rawPhone = ref.referee?.phone || '';
    const maskedPhone = rawPhone.length >= 4
      ? `${rawPhone.slice(0, 2)}******${rawPhone.slice(-2)}`
      : '******';
    return {
      _id: ref._id,
      friendName: ref.referee?.name || 'Saathi User',
      friendPhone: maskedPhone,
      status: ref.status,
      earnedAmount: ref.referrerReward || 0,
      rewardedAt: ref.rewardedAt,
      registeredAt: ref.createdAt
    };
  });

  return {
    referralCode,
    walletBalance: user.walletBalance || 0,
    totalInvited,
    totalRewarded,
    totalEarned,
    referrals: formattedReferrals,
    programSettings: settings
  };
};
