import express from 'express';
import { getWalletData, initiateTopup, verifyTopup } from '../controllers/walletController.js';
import { protect, requireRegistrationComplete } from '../middleware/authMiddleware.js';
import {
  walletTopupInitiateLimiter,
  walletTopupVerifyLimiter
} from '../middleware/securityMiddleware.js';

const router = express.Router();

router.get('/data', protect, getWalletData);
router.post('/topup/initiate', protect, requireRegistrationComplete, walletTopupInitiateLimiter, initiateTopup);
router.post('/topup/verify', protect, requireRegistrationComplete, walletTopupVerifyLimiter, verifyTopup);

export default router;
