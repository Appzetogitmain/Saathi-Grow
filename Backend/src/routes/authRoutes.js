import express from 'express';
import {
  requestOTP,
  verifyOTP,
  resendOTP,
  getUserProfile,
  completeRegistration,
  updateProfile,
  deleteProfile
} from '../controllers/authController.js';
import { updateFCMToken } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  validateUserOtpRequestPayload,
  validateUserOtpVerifyPayload,
  validateUserOtpResendPayload,
  validateCompleteRegistrationPayload,
} from '../middleware/requestValidation.js';

import { userUpload } from '../config/cloudinary.js';

const router = express.Router();

// OTP Authentication Routes
router.post('/request-otp', validateUserOtpRequestPayload, requestOTP);
router.post('/verify-otp', validateUserOtpVerifyPayload, verifyOTP);
router.post('/resend-otp', validateUserOtpResendPayload, resendOTP);

// Profile Management & Customer Onboarding
router.post('/complete-registration', protect, validateCompleteRegistrationPayload, completeRegistration);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, userUpload.single('image'), updateProfile);
router.delete('/profile', protect, deleteProfile);
router.put('/fcm-token', protect, updateFCMToken);

export default router;
