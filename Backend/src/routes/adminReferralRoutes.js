import express from 'express';
import {
  getAdminReferralSettings,
  updateAdminReferralSettings,
  getAdminReferralAnalytics,
  getAdminReferralsList
} from '../controllers/adminReferralController.js';
import { protectAdmin, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protectAdmin, requirePermission('MANAGE_SETTINGS'));

router.get('/settings', getAdminReferralSettings);
router.put('/settings', updateAdminReferralSettings);
router.get('/analytics', getAdminReferralAnalytics);
router.get('/list', getAdminReferralsList);

export default router;
