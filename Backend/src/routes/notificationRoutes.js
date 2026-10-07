import express from 'express';
import { 
  updateFCMToken, 
  getMyNotifications, 
  markAsRead, 
  markAllRead, 
  getUnreadCount,
  adminSendNotification,
  getAdminNotificationHistory,
  searchRecipients,
  deleteNotifications
} from '../controllers/notificationController.js';
import { protectAny, protectAdmin } from '../middleware/authMiddleware.js';
import { validateFcmUpdatePayload } from '../middleware/requestValidation.js';
import { memoryUpload } from '../config/cloudinary.js';

const router = express.Router();

router.put('/update-token', protectAny, validateFcmUpdatePayload, updateFCMToken);

// Admin Specific Routes
router.post('/admin/send', protectAdmin, memoryUpload.single('image'), adminSendNotification);
router.get('/admin/history', protectAdmin, getAdminNotificationHistory);
router.get('/admin/search', protectAdmin, searchRecipients);
router.delete('/delete', protectAny, deleteNotifications);

// Notification History & Read Status
router.get('/my', protectAny, getMyNotifications);
router.get('/unread-count', protectAny, getUnreadCount);
router.put('/read/:id', protectAny, markAsRead);
router.put('/read-all', protectAny, markAllRead);

export default router;
