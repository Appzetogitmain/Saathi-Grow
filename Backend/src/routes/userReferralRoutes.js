import express from 'express';
import { getMyReferralsDashboard } from '../controllers/userReferralController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/my-dashboard', protect, getMyReferralsDashboard);

export default router;
