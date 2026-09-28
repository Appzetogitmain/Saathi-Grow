import express from 'express';
import {
  getDeliverySlots,
  getAllSlotsAdmin,
  createDeliverySlot,
  updateDeliverySlot,
  deleteDeliverySlot,
  getAvailableDeliveryDays,
  getHolidaysAdmin,
  addHolidayAdmin,
  deleteHolidayAdmin
} from '../controllers/deliverySlotController.js';
import { protectAdmin, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes for users during checkout
router.get('/', getDeliverySlots);
router.get('/available-days', getAvailableDeliveryDays);

// Admin routes (Protected)
router.use(protectAdmin);
router.get('/admin', getAllSlotsAdmin);
router.post('/admin', createDeliverySlot);
router.put('/admin/:id', updateDeliverySlot);
router.delete('/admin/:id', deleteDeliverySlot);

// Admin Holiday Management routes
router.get('/admin/holidays', requirePermission('MANAGE_SETTINGS'), getHolidaysAdmin);
router.post('/admin/holidays', requirePermission('MANAGE_SETTINGS'), addHolidayAdmin);
router.delete('/admin/holidays/:date', requirePermission('MANAGE_SETTINGS'), deleteHolidayAdmin);

export default router;
