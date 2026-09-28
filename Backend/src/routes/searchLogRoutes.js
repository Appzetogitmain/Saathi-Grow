import express from 'express';
import { getSearchLogs, exportSearchLogs } from '../controllers/searchLogController.js';
import { protectAdmin, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protectAdmin, requirePermission('VIEW_REPORTS'));

router.get('/', getSearchLogs);
router.get('/export', exportSearchLogs);

export default router;
