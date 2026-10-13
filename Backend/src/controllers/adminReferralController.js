import mongoose from 'mongoose';
import GlobalSetting from '../models/GlobalSetting.js';
import Referral from '../models/Referral.js';
import { getActiveReferralSettings } from '../services/referralService.js';
import { buildReferralSettings } from '../utils/referralSettings.js';

// @desc    Get Referral Configuration
// @route   GET /api/admin/referrals/settings
// @access  Private (Admin)
export const getAdminReferralSettings = async (req, res) => {
  try {
    const settings = await getActiveReferralSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Referral Configuration
// @route   PUT /api/admin/referrals/settings
// @access  Private (Admin)
export const updateAdminReferralSettings = async (req, res) => {
  try {
    for (const field of ['referrerRewardAmount', 'refereeRewardAmount', 'minOrderValue', 'maxReferralsPerUser']) {
      if (req.body[field] !== undefined && (typeof req.body[field] !== 'number' || !Number.isFinite(req.body[field]) ||
          req.body[field] < 0 || (field === 'maxReferralsPerUser' && !Number.isInteger(req.body[field])))) {
        return res.status(400).json({ success: false, message: `Invalid ${field}` });
      }
    }
    if (req.body.isEnabled !== undefined && typeof req.body.isEnabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isEnabled must be a boolean' });
    }
    if (req.body.rewardTrigger !== undefined && !['registration', 'first_order_delivered'].includes(req.body.rewardTrigger)) {
      return res.status(400).json({ success: false, message: 'Invalid reward trigger' });
    }
    let globalSetting = await GlobalSetting.findOne();
    if (!globalSetting) {
      globalSetting = new GlobalSetting();
    }

    const {
      isEnabled,
      rewardTrigger,
      referrerRewardAmount,
      refereeRewardAmount,
      minOrderValue,
      maxReferralsPerUser,
      headline,
      description,
      terms
    } = req.body;

    globalSetting.referral = {
      isEnabled: isEnabled ?? globalSetting.referral?.isEnabled ?? true,
      rewardTrigger: rewardTrigger ?? globalSetting.referral?.rewardTrigger ?? 'first_order_delivered',
      referrerRewardAmount: referrerRewardAmount ?? globalSetting.referral?.referrerRewardAmount ?? 50,
      refereeRewardAmount: refereeRewardAmount ?? globalSetting.referral?.refereeRewardAmount ?? 25,
      minOrderValue: minOrderValue ?? globalSetting.referral?.minOrderValue ?? 199,
      maxReferralsPerUser: maxReferralsPerUser ?? globalSetting.referral?.maxReferralsPerUser ?? 50,
      headline: headline ?? globalSetting.referral?.headline ?? 'Invite Friends & Earn Rewards!',
      description: description ?? globalSetting.referral?.description ?? 'Share your referral code with friends. When they place their first order, both of you earn wallet cashback!',
      terms: Array.isArray(terms) ? terms.filter(t => t && String(t).trim()) : (globalSetting.referral?.terms || [])
    };

    await globalSetting.save();
    res.json({
      success: true,
      message: 'Referral settings updated successfully',
      settings: buildReferralSettings(globalSetting)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Referral Analytics & Top Referrers
// @route   GET /api/admin/referrals/analytics
// @access  Private (Admin)
export const getAdminReferralAnalytics = async (req, res) => {
  try {
    const [totalReferrals, totalRewarded, totalPending, rewardsAgg, topReferrersAgg] = await Promise.all([
      Referral.countDocuments(),
      Referral.countDocuments({ status: 'rewarded' }),
      Referral.countDocuments({ status: 'registered' }),
      Referral.aggregate([
        { $match: { status: 'rewarded' } },
        {
          $group: {
            _id: null,
            totalReferrerPaid: { $sum: '$referrerReward' },
            totalRefereePaid: { $sum: '$refereeReward' }
          }
        }
      ]),
      Referral.aggregate([
        { $match: { status: 'rewarded' } },
        {
          $group: {
            _id: '$referrer',
            successfulCount: { $sum: 1 },
            totalEarned: { $sum: '$referrerReward' }
          }
        },
        { $sort: { successfulCount: -1, totalEarned: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            successfulCount: 1,
            totalEarned: 1,
            name: '$user.name',
            phone: '$user.phone',
            referralCode: '$user.referralCode'
          }
        }
      ])
    ]);

    const totalReferrerPaid = rewardsAgg[0]?.totalReferrerPaid || 0;
    const totalRefereePaid = rewardsAgg[0]?.totalRefereePaid || 0;

    res.json({
      success: true,
      analytics: {
        totalReferrals,
        totalRewarded,
        totalPending,
        totalPayout: totalReferrerPaid + totalRefereePaid,
        totalReferrerPaid,
        totalRefereePaid,
        topReferrers: topReferrersAgg
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Paginated Referral History / Logs
// @route   GET /api/admin/referrals/list
// @access  Private (Admin)
export const getAdminReferralsList = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const status = req.query.status;
    const search = (req.query.search || '').trim();

    const query = {};
    if (status && ['registered', 'rewarded', 'cancelled'].includes(status)) {
      query.status = status;
    }

    if (search) {
      const matchingUsers = await mongoose.model('User').find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { referralCode: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = matchingUsers.map(u => u._id);
      query.$or = [
        { referrer: { $in: userIds } },
        { referee: { $in: userIds } },
        { referralCode: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Referral.countDocuments(query);
    const referrals = await Referral.find(query)
      .populate('referrer', 'name phone referralCode')
      .populate('referee', 'name phone')
      .populate('orderId', 'orderId totalAmount status createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      referrals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
