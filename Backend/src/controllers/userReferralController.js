import { getUserReferralDashboard } from '../services/referralService.js';

// @desc    Get logged-in user's referral dashboard (code, link, earnings, friends list, program terms)
// @route   GET /api/referrals/my-dashboard
// @access  Private (User)
export const getMyReferralsDashboard = async (req, res) => {
  try {
    const dashboard = await getUserReferralDashboard(req.user._id);
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
