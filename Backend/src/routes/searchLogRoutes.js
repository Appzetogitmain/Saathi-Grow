import express from 'express';
import { getSearchLogs, exportSearchLogs } from '../controllers/searchLogController.js';
import { protectAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protectAdmin);

router.get('/', getSearchLogs);
router.get('/export', exportSearchLogs);

export default router;
