import express from 'express';
import {
  createProduct,
  bulkReorderProducts,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  getAISuggestions,
  adjustInventory,
  getInventoryLogs,
  getAllInventoryLogs,
  searchProductsWithAI,
  searchCustomerProducts,
  getUniqueBrands,
  getInventoryStats,
  bulkAdjustInventory,
  getBranchWiseStock,
  getLowStockAlerts,
  bulkUploadProducts,
  bulkUploadProductsJson
} from '../controllers/productController.js';
import { protectAdmin, restrictTo, requirePermission, optionalProtectAdmin, protectStoreManager, optionalProtectStoreManager, optionalProtect } from '../middleware/authMiddleware.js';
import { upload, productImageUpload } from '../config/cloudinary.js';
import multer from 'multer';

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// Static routes first (MUST BE ABOVE /:id)
router.get('/brands', getUniqueBrands);
router.get('/search', optionalProtect, optionalProtectStoreManager, searchCustomerProducts);
router.get('/search/ai', optionalProtect, optionalProtectStoreManager, searchProductsWithAI);

// Admin Only Static Routes
router.get('/inventory/stats', protectAdmin, requirePermission('VIEW_PRODUCTS'), getInventoryStats);
router.get('/inventory/branch-wise', protectAdmin, requirePermission('VIEW_PRODUCTS'), getBranchWiseStock);
router.get('/inventory/low-stock', protectAdmin, requirePermission('VIEW_PRODUCTS'), getLowStockAlerts);
router.post('/inventory/bulk-adjust', protectAdmin, requirePermission('MANAGE_INVENTORY'), bulkAdjustInventory);
router.post('/ai-suggestions', protectStoreManager, getAISuggestions);
router.get('/inventory-logs', protectAdmin, requirePermission('MANAGE_INVENTORY'), getAllInventoryLogs);
router.put('/reorder', protectAdmin, requirePermission('MANAGE_PRODUCTS'), bulkReorderProducts);
router.post('/bulk-upload', protectAdmin, requirePermission('MANAGE_PRODUCTS'), csvUpload.single('file'), bulkUploadProducts);
router.post('/bulk-json', protectAdmin, requirePermission('MANAGE_PRODUCTS'), bulkUploadProductsJson);
router.delete('/bulk', protectAdmin, requirePermission('MANAGE_PRODUCTS'), restrictTo('Admin', 'Store Manager'), bulkDeleteProducts);

// Public/General Routes
router.get('/', optionalProtect, optionalProtectStoreManager, getProducts);
router.get('/:id', optionalProtectStoreManager, getProductById);

// Admin Only Dynamic Routes
router.use(protectAdmin);

// Dynamic Routes Section
router.get('/:id/inventory-logs', requirePermission('MANAGE_INVENTORY'), getInventoryLogs);

router.post('/', requirePermission('MANAGE_PRODUCTS'), productImageUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), createProduct);

router.route('/:id')
  .put(requirePermission('MANAGE_PRODUCTS'), productImageUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), updateProduct)
  .delete(requirePermission('MANAGE_PRODUCTS'), restrictTo('Admin', 'Store Manager'), deleteProduct);

router.post('/:id/inventory', requirePermission('MANAGE_INVENTORY'), adjustInventory);

export default router;
