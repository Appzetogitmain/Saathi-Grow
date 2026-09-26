import express from 'express';
import {
  getMyAddresses,
  addAddress,
  updateAddress,
  deleteAddress
} from '../controllers/userAddressController.js';
import { protect, requireRegistrationComplete } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // Ensure user is logged in

router.route('/')
  .get(getMyAddresses)
  .post(requireRegistrationComplete, addAddress);

router.route('/:id')
  .put(requireRegistrationComplete, updateAddress)
  .delete(deleteAddress);

export default router;
