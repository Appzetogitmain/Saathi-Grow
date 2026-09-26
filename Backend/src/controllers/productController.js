import mongoose from 'mongoose';
import Product from '../models/Product.js';
import InventoryLog from '../models/InventoryLog.js';
import CampaignSection from '../models/CampaignSection.js';
import Branch from '../models/Branch.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import Brand from '../models/Brand.js';
import { generateProductDescription, generateProductTags, analyzeSearchQuery } from '../utils/aiService.js';
import QRCode from 'qrcode';
import { sendPushNotification } from '../services/notificationService.js';
import { syncLocationAssignment } from './physicalLocationController.js';
import PhysicalLocation from '../models/PhysicalLocation.js';
import XLSX from 'xlsx';
import { recordSearchLog } from '../services/searchLogService.js';

/** Default product image (SG logo) when bulk upload has no image URL */
const getDefaultProductImageUrl = () => {
  if (process.env.DEFAULT_PRODUCT_IMAGE_URL) {
    return process.env.DEFAULT_PRODUCT_IMAGE_URL;
  }
  const clientBase = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${clientBase}/assets/logo_fav.png`;
};

// Helper to determine status based on total stock
const determineProductStatus = (branchStocks, vendorStock = null, vendorThreshold = null) => {
  let totalStock = 0;
  let totalThreshold = 0;

  if (vendorStock !== null) {
    const normalizedStock = Number(vendorStock);
    const normalizedThreshold = Number(vendorThreshold);
    totalStock = Number.isFinite(normalizedStock) ? normalizedStock : 0;
    totalThreshold = Number.isFinite(normalizedThreshold) ? normalizedThreshold : 10;
  } else {
    if (!branchStocks || branchStocks.length === 0) return 'Draft';
    totalStock = branchStocks.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
    totalThreshold = branchStocks.reduce((sum, item) => sum + (Number(item.lowStockThreshold) || 0), 0);
  }

  if (totalStock <= 0) return 'Out of Stock';
  if (totalStock <= totalThreshold) return 'Low Stock';
  return 'Active';
};

// Helper to escape regex special characters
const escapeRegExp = (string) => {
  if (!string) return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Build a bounded, literal search regex to avoid malformed/expensive patterns.
const buildSafeSearchRegex = (value, maxLen = 80) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().slice(0, maxLen);
  if (!normalized) return null;
  return new RegExp(escapeRegExp(normalized), 'i');
};

// Helper to handle comma-separated strings or arrays
const parseParam = (val) => {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim());
};

// Help parse status list which we specifically send as arrays/comma-lists
const parseStatus = (val) => {
  if (!val) return [];
  const arr = Array.isArray(val) ? val : val.split(',');
  return arr.map(s => s.trim()).filter(Boolean);
};

// @desc    Get AI suggestions for product description and tags
// @route   POST /api/admin/products/ai-suggestions
// @access  Private (Admin/Staff)
export const getAISuggestions = async (req, res) => {
  try {
    const { productName, type } = req.body;
    console.log(`Received AI suggestion request for: ${productName}, type: ${type}`);

    if (!productName) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    let suggestion = '';

    if (type === 'description') {
      suggestion = await generateProductDescription(productName);
    } else if (type === 'tags') {
      suggestion = await generateProductTags(productName);
    } else {
      return res.status(400).json({ message: 'Invalid suggestion type' });
    }

    res.json({ suggestion });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new product
// @route   POST /api/admin/products
// @access  Private (Admin/Staff)
export const createProduct = async (req, res) => {
  try {
    console.log('DEBUG: createProduct req.body:', req.body);
    console.log('DEBUG: createProduct req.files:', req.files);

    const {
      name,
      description,
      tags,
      basePrice,
      branchStocks, // Expected: [{ branchId, stock, lowStockThreshold }]
      unitType,
      physicalLocation,
      category,
      subCategory,
      brandName,
      isAllBranches,
      specificBranches,
      sku,
      status,
      vendor,
      stock,
      lowStockThreshold,
      mrp,
      isVeg,
      variants,
      unitValue,
      isSaathigro,
      // --- New Inventory fields ---
      reorderThreshold,
      maxCapacityPerSku,
      isStockAutoSync,
      weightCategory,
      isFragile,
      temperatureType,
      pickPriority,
      pickingZone,
      variantGroupId,
      pickSequence,
      displayOrder
    } = req.body;

    let parsedDisplayOrder = null;
    if (displayOrder !== undefined && displayOrder !== null && String(displayOrder).trim() !== '') {
      const num = Number(displayOrder);
      if (!Number.isFinite(num) || num < 0) {
        return res.status(400).json({ message: 'Invalid displayOrder. Must be a non-negative number or null.' });
      }
      parsedDisplayOrder = num;
    }

    const productExists = await Product.findOne({ sku });
    if (productExists) {
      return res.status(400).json({ message: 'Product with this SKU already exists' });
    }

    let image = '';
    let gallery = [];


    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        image = req.files.image[0].path;
        console.log('DEBUG: Image path found:', image);
      }
      if (req.files.gallery) {
        gallery = req.files.gallery.map(file => file.path);
        console.log('DEBUG: Gallery paths found:', gallery);
      }
    }

    // Parse branchStocks if it's sent as a string (from FormData)
    let parsedBranchStocks = branchStocks;
    if (typeof branchStocks === 'string') {
      try {
        parsedBranchStocks = JSON.parse(branchStocks);
      } catch (e) {
        parsedBranchStocks = [];
      }
    }

    const normalizedVendorStock = Number.isFinite(Number(stock)) ? Number(stock) : 0;
    const normalizedVendorThreshold = Number.isFinite(Number(lowStockThreshold)) ? Number(lowStockThreshold) : 10;

    // Determine initial status if not Draft
    let finalStatus = status || 'Active';
    if (finalStatus !== 'Draft') {
      if (vendor) {
        finalStatus = determineProductStatus([], req.body.stock || 0, req.body.lowStockThreshold || 10);
      } else {
        finalStatus = determineProductStatus(parsedBranchStocks);
      }
    }

    // Generate QR Code from SKU
    const qrCodeDataUrl = await QRCode.toDataURL(sku, {
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      margin: 1
    });

    const product = await Product.create({
      name,
      description,
      tags: typeof tags === 'string' ? tags.split(',') : tags,
      basePrice,
      branchStocks: parsedBranchStocks,
      unitType: unitType || 'pcs',
      unitValue: Number(unitValue) || 1,
      physicalLocation,
      category,
      subCategory,
      brandName,
      isAllBranches: isAllBranches === 'true' || isAllBranches === true,
      specificBranches: typeof specificBranches === 'string'
        ? specificBranches.split(',').map(s => s.trim()).filter(Boolean)
        : (specificBranches || []).filter(Boolean),
      sku,
      qrCode: qrCodeDataUrl,
      status: finalStatus,
      image,
      gallery,
      vendor: vendor || null,
      mrp: Number(mrp) || Number(basePrice),
      isVeg: isVeg === 'true' || isVeg === true,
      variants: typeof variants === 'string' ? JSON.parse(variants) : (variants || []),
      isSaathigro: isSaathigro === 'true' || isSaathigro === true,
      stock: vendor ? normalizedVendorStock : 0,
      lowStockThreshold: vendor ? normalizedVendorThreshold : 10,

      // --- New Fields ---
      reorderThreshold: Number(reorderThreshold) || 10,
      maxCapacityPerSku: Number(maxCapacityPerSku) || 0,
      isStockAutoSync: isStockAutoSync === 'true' || isStockAutoSync === true,
      weightCategory: weightCategory || 'Light',
      isFragile: isFragile === 'true' || isFragile === true,
      temperatureType: temperatureType || 'Normal',
      pickPriority: Number(pickPriority) || 0,
      pickingZone: pickingZone || 'Other',
      variantGroupId: variantGroupId || '',
      pickSequence: Number(pickSequence) || 0,
      displayOrder: parsedDisplayOrder,

      createdBy: req.admin._id
    });

    // Create Initial Inventory Logs for each branch
    if (parsedBranchStocks && parsedBranchStocks.length > 0) {
      const logs = parsedBranchStocks.map(item => ({
        product: product._id,
        admin: req.admin._id,
        branchId: item.branchId,
        changeAmount: item.stock,
        previousStock: 0,
        newStock: item.stock,
        type: 'Addition',
        reason: 'Initial Product Creation'
      }));
      await InventoryLog.insertMany(logs);
    }

    if (vendor) {
      await InventoryLog.create({
        product: product._id,
        admin: req.admin._id,
        vendorId: vendor,
        changeAmount: normalizedVendorStock,
        previousStock: 0,
        newStock: normalizedVendorStock,
        type: 'Addition',
        reason: 'Initial Product Creation'
      });
    }

    // Sync physical location assignment
    if (physicalLocation) {
      // For admin products, scope to first branch if multiple
      const firstBranchId = parsedBranchStocks?.[0]?.branchId || null;

      // ── Conflict check: shelf already occupied by another product? ──
      const locationFilter = { label: physicalLocation.trim(), isActive: true };
      if (firstBranchId) locationFilter.branchId = firstBranchId;
      else if (vendor) locationFilter.vendorId = vendor;

      const occupiedLoc = await PhysicalLocation.findOne(locationFilter).populate('assignedProduct', 'name sku');
      if (occupiedLoc && occupiedLoc.assignedProduct) {
        // Rollback: delete the just-created product
        await product.deleteOne();
        return res.status(409).json({
          message: `Shelf "${physicalLocation}" is already occupied by "${occupiedLoc.assignedProduct.name}" (${occupiedLoc.assignedProduct.sku}). Please choose a different shelf.`
        });
      }

      await syncLocationAssignment({
        newLabel: physicalLocation,
        productId: product._id.toString(),
        branchId: firstBranchId,
        vendorId: vendor || null
      });
    }

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all products
// @route   GET /api/admin/products
// @access  Public (Enhanced with filtering)
export const getProducts = async (req, res) => {
  try {
    const {
      category,
      subCategory,
      search,
      status,
      brand,
      minPrice,
      maxPrice,
      isVeg,
      sort = '-createdAt',
      page = 1,
      limit = 20,
      campaignId,
      source, // 'vendor' | 'branch' | '' (all)
      storeId,
      storeType
    } = req.query;

    // Sanitize storeId (handle stringified 'null' or 'undefined' from frontend)
    const effectiveStoreId = (storeId && storeId !== 'null' && storeId !== 'undefined') ? storeId : null;
    let effectiveStoreObjectId = null;
    if (effectiveStoreId) {
      try {
        effectiveStoreObjectId = new mongoose.Types.ObjectId(effectiveStoreId);
      } catch (e) {
        console.error('Invalid storeId format:', effectiveStoreId);
      }
    }

    // Build query object
    let query = {};

    // 1. Store Status & Context Validation (Production Level Security)
    // If not admin/vendor, exclude products from inactive sources
    if (!req.admin && !req.vendor) {
      if (effectiveStoreId && storeType) {
        // Verify current selected store status
        if (storeType === 'branch') {
          const branch = await Branch.findById(effectiveStoreId).select('isActive');
          if (!branch || !branch.isActive) {
            return res.json({ products: [], total: 0, pages: 0, message: 'Selected store is currently inactive' });
          }
        } else if (storeType === 'vendor') {
          const v = await mongoose.model('Vendor').findById(effectiveStoreId).select('status');
          if (!v || v.status !== 'Active') {
            return res.json({ products: [], total: 0, pages: 0, message: 'Selected vendor is currently inactive' });
          }
        }
      }

      // Globally exclude inactive vendors from all public listings
      const inactiveVendors = await mongoose.model('Vendor').find({ status: { $ne: 'Active' } }).distinct('_id');
      if (inactiveVendors.length > 0) {
        query.vendor = { $nin: inactiveVendors };
      }

      // Hide branch products that are not available on any active branch
      const activeBranches = await Branch.find({ isActive: true }).distinct('_id');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { vendor: { $exists: true, $ne: null } },
          ...(activeBranches.length > 0
            ? [{ 'branchStocks.branchId': { $in: activeBranches } }]
            : [{ _id: null }]) // no active branches => hide all branch-only products
        ]
      });
    }

    // Campaign filtering
    if (campaignId) {
      const campaign = await CampaignSection.findById(campaignId);
      if (campaign) {
        const productIds = (campaign.products || []).map(p => p.productId).filter(id => id);
        query._id = { $in: productIds };
      } else {
        return res.json({ products: [], total: 0, pages: 0 });
      }
    }

    // Offer filtering
    if (req.query.offerId) {
      const OfferDeal = mongoose.model('OfferDeal');
      const offer = await OfferDeal.findById(req.query.offerId);
      if (offer) {
        const productIds = (offer.products || []).map(p => p.productId).filter(id => id);
        query._id = { $in: productIds };
      } else {
        return res.json({ products: [], total: 0, pages: 0 });
      }
    }

    // Status filtering
    if (status) {
      const statusList = parseStatus(status);
      if (req.admin && req.admin.role !== 'Admin' && req.admin.branchId) {
        const statusOr = [];
        if (statusList.includes('Out of Stock')) {
          statusOr.push({ branchStocks: { $elemMatch: { branchId: req.admin.branchId, stock: { $lte: 0 } } } });
        }
        if (statusList.includes('Low Stock')) {
          statusOr.push({ branchStocks: { $elemMatch: { branchId: req.admin.branchId, stock: { $gt: 0, $lte: 10 } } } });
        }
        if (statusList.includes('Active')) {
          statusOr.push({ branchStocks: { $elemMatch: { branchId: req.admin.branchId, stock: { $gt: 10 } } } });
        }
        if (statusList.includes('Draft')) {
          statusOr.push({ status: 'Draft' });
        }
        if (statusOr.length > 0) {
          query.$and = query.$and || [];
          query.$and.push({ $or: statusOr });
        }
      } else {
        // For public users, even if they request 'Active', we show out of stock items
        // to support the 'Out of Stock' display logic.
        if (!req.admin && statusList.length === 1 && statusList[0] === 'Active') {
          query.status = { $in: ['Active', 'Out of Stock', 'Low Stock'] };
        } else {
          query.status = { $in: statusList };
        }
      }
    } else if (!req.admin) {
      query.status = { $in: ['Active', 'Out of Stock', 'Low Stock'] };
    }

    if (category) {
      const categoryList = Array.isArray(category) ? category : [category];
      const categoryRegexes = categoryList.map(
        (cat) => new RegExp(`^${escapeRegExp(cat.trim())}$`, 'i')
      );
      query.category = { $in: categoryRegexes };
    }

    if (subCategory) {
      const subCategoryList = Array.isArray(subCategory) ? subCategory : [subCategory];
      query.subCategory = { $in: subCategoryList.map(s => new RegExp(escapeRegExp(s.trim()), 'i')) };
    }

    if (brand) {
      const brandList = Array.isArray(brand) ? brand : brand.split(',').map(s => s.trim());
      // Create exact match regex for each brand with escaping
      query.brandName = {
        $in: brandList.map(b => new RegExp(`^${escapeRegExp(b)}$`, 'i'))
      };
    }

    if (isVeg !== undefined) {
      query.isVeg = isVeg === 'true';
    }

    // Price filtering
    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }

    if (search) {
      const safeSearchRegex = buildSafeSearchRegex(search);
      if (!safeSearchRegex) {
        return res.status(400).json({ message: 'Invalid search query' });
      }

      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: safeSearchRegex } },
          { sku: { $regex: safeSearchRegex } },
          { description: { $regex: safeSearchRegex } },
          { tags: { $in: [safeSearchRegex] } }
        ]
      });
    }

    // Source filtering: vendor products vs branch products
    if (source === 'vendor') {
      query.vendor = { $exists: true, $ne: null };
    } else if (source === 'branch') {
      query.vendor = { $in: [null, undefined] };
    }

    // Priority 2: Explicit parameter scoping (Hard Filter for Store Pages)
    // ONLY apply hard filter if explicitly requested via hardFilter=true
    if (effectiveStoreId && req.query.hardFilter === 'true') {
      if (storeType === 'branch') {
        query['branchStocks.branchId'] = effectiveStoreId;
      } else if (storeType === 'vendor') {
        query.vendor = effectiveStoreId;
      }
    }
    // If no storeId, but we are a branch staff/vendor auth, apply their scope
    else if (req.admin && req.admin.role !== 'Admin' && req.admin.branchId && req.query.allBranches !== 'true') {
      query['branchStocks.branchId'] = req.admin.branchId;
    } else if (req.vendor) {
      query.vendor = req.vendor._id;
    }

    // Pagination logic
    const skip = (Number(page) - 1) * Number(limit);

    console.log("DEBUG: getProducts query:", JSON.stringify(query));
    console.log("DEBUG: req.vendor:", req.vendor ? req.vendor._id : null);

    const total = await Product.countDocuments(query);

    let products = [];
    const isExplicitSort = sort && sort !== '-createdAt' && sort !== 'displayOrder';

    if (isExplicitSort) {
      let sortObj = {};
      if (typeof sort === 'string') {
        const parts = sort.split(' ');
        parts.forEach(p => {
          const field = p.startsWith('-') ? p.substring(1) : p;
          const order = p.startsWith('-') ? -1 : 1;
          sortObj[field] = order;
        });
      }
      let productQuery = Product.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit));

      if (!req.admin && !req.vendor) {
        productQuery = productQuery.select('name image gallery variants description basePrice mrp category status brandName unitType unitValue isVeg sku branchStocks vendor stock lowStockThreshold averageRating ratingCount displayOrder');
      }

      products = await productQuery
        .populate('branchStocks.branchId', 'name code logo phone email address')
        .populate('vendor', 'storeName logo businessType phone email address')
        .lean();
    } else {
      // Default/Featured catalog ordering:
      // 1. Explicit displayOrder (1, 2, 3...)
      // 2. Unassigned (null) ordered by isSaathigro DESC, createdAt DESC, _id ASC
      const orderedQuery = { ...query, displayOrder: { $ne: null, $gte: 0 } };
      const unassignedQuery = { ...query, $or: [{ displayOrder: null }, { displayOrder: { $exists: false } }] };

      const orderedCount = await Product.countDocuments(orderedQuery);

      if (skip < orderedCount) {
        let q1 = Product.find(orderedQuery)
          .sort({ displayOrder: 1, isSaathigro: -1, createdAt: -1, _id: 1 })
          .skip(skip)
          .limit(Number(limit));

        if (!req.admin && !req.vendor) {
          q1 = q1.select('name image gallery variants description basePrice mrp category status brandName unitType unitValue isVeg sku branchStocks vendor stock lowStockThreshold averageRating ratingCount displayOrder');
        }

        const res1 = await q1
          .populate('branchStocks.branchId', 'name code logo phone email address')
          .populate('vendor', 'storeName logo businessType phone email address')
          .lean();

        products = res1;

        if (products.length < Number(limit)) {
          const remainingNeeded = Number(limit) - products.length;
          let q2 = Product.find(unassignedQuery)
            .sort({ isSaathigro: -1, createdAt: -1, _id: 1 })
            .skip(0)
            .limit(remainingNeeded);

          if (!req.admin && !req.vendor) {
            q2 = q2.select('name image gallery variants description basePrice mrp category status brandName unitType unitValue isVeg sku branchStocks vendor stock lowStockThreshold averageRating ratingCount displayOrder');
          }

          const res2 = await q2
            .populate('branchStocks.branchId', 'name code logo phone email address')
            .populate('vendor', 'storeName logo businessType phone email address')
            .lean();

          products = products.concat(res2);
        }
      } else {
        const unassignedSkip = skip - orderedCount;
        let q2 = Product.find(unassignedQuery)
          .sort({ isSaathigro: -1, createdAt: -1, _id: 1 })
          .skip(unassignedSkip)
          .limit(Number(limit));

        if (!req.admin && !req.vendor) {
          q2 = q2.select('name image gallery variants description basePrice mrp category status brandName unitType unitValue isVeg sku branchStocks vendor stock lowStockThreshold averageRating ratingCount displayOrder');
        }

        products = await q2
          .populate('branchStocks.branchId', 'name code logo phone email address')
          .populate('vendor', 'storeName logo businessType phone email address')
          .lean();
      }
    }

    // Store-Aware logic: Inject isDeliverable flag and specific stock info
    const enrichmentStoreId = effectiveStoreId || req.query.activeStoreId;
    const enrichmentStoreType = storeType || req.query.activeStoreType;

    if (enrichmentStoreId && enrichmentStoreType) {
      products = products.map(p => {
        const pObj = p; // already lean
        let isDeliverable = false;
        let availableStock = 0;
        let lowStockThreshold = 10;
        let inStore = false;

        if (enrichmentStoreType === 'branch') {
          // Check if product is in stock at this branch
          const branchStock = pObj.branchStocks?.find(bs => {
            const bId = bs.branchId?._id || bs.branchId;
            return bId && bId.toString() === enrichmentStoreId.toString();
          });

          if (branchStock) {
            inStore = true;
            availableStock = branchStock.stock || 0;
            lowStockThreshold = branchStock.lowStockThreshold || 10;
            if (availableStock > 0) isDeliverable = true;
          } else if (pObj.vendor) {
            inStore = true;
            availableStock = pObj.stock || 0;
            lowStockThreshold = pObj.lowStockThreshold || 10;
            if (availableStock > 0) isDeliverable = true;
          } else if (pObj.isAllBranches) {
            inStore = true;
            availableStock = 0;
            lowStockThreshold = pObj.lowStockThreshold || 10;
            isDeliverable = false;
          }
        } else if (enrichmentStoreType === 'vendor') {
          const vId = pObj.vendor?._id || pObj.vendor;
          if (vId && vId.toString() === enrichmentStoreId.toString()) {
            inStore = true;
            availableStock = pObj.stock || 0;
            lowStockThreshold = pObj.lowStockThreshold || 10;
            if (availableStock > 0) isDeliverable = true;
          }
        }
        return { ...pObj, isDeliverable, availableStock, lowStockThreshold, inStore };
      });
    }

    // If Store Manager/Staff, transform products to only show their branch details and local status
    if (req.admin && req.admin.role !== 'Admin' && req.admin.branchId) {
      products = products.map(p => {
        const pObj = p.toObject ? p.toObject() : p;
        pObj.branchStocks = pObj.branchStocks.filter(bs => {
          const bsBranchId = bs.branchId?._id || bs.branchId;
          return bsBranchId && bsBranchId.toString() === req.admin.branchId.toString();
        });
        if (pObj.status !== 'Draft') {
          if (pObj.vendor) {
            pObj.status = determineProductStatus([], pObj.stock, pObj.lowStockThreshold);
          } else {
            pObj.status = determineProductStatus(pObj.branchStocks);
          }
        }
        return pObj;
      });
    }

    if (search && typeof search === 'string' && search.trim().length > 0 && Number(page || 1) === 1) {
      recordSearchLog(req, search, total, 'keyword').catch(() => {});
    }

    res.json({
      products,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    AI-Powered Product Search
// @route   GET /api/admin/products/search/ai
// @access  Public
export const searchProductsWithAI = async (req, res) => {
  try {
    const { q, storeId, storeType } = req.query;
    const effectiveStoreId = (storeId && storeId !== 'null' && storeId !== 'undefined') ? storeId : null;

    if (!q || q.trim().length < 2) {
      return res.json({ products: [], total: 0, page: 1, pages: 0 });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const qTrimmed = q.trim();

    // ─── Store Scope ────────────────────────────────────────────────────────────
    const buildStoreScope = () => {
      if (req.admin && req.admin.role !== 'Admin' && req.admin.branchId) {
        return { 'branchStocks.branchId': new mongoose.Types.ObjectId(req.admin.branchId) };
      }
      if (req.vendor) return { vendor: new mongoose.Types.ObjectId(req.vendor._id) };
      if (effectiveStoreId) {
        return storeType === 'branch'
          ? { 'branchStocks.branchId': new mongoose.Types.ObjectId(effectiveStoreId) }
          : { vendor: new mongoose.Types.ObjectId(effectiveStoreId) };
      }
      return {};
    };
    const storeScope = buildStoreScope();

    // ─── Step 1: Get AI keywords from the user's query ──────────────────────────
    let aiKeywords = [];
    try {
      const aiResponse = await analyzeSearchQuery(qTrimmed);
      if (aiResponse) {
        const cleaned = aiResponse.replace(/[^a-zA-Z0-9,\s]/g, '');
        const stopWords = new Set(['is', 'ki', 'ka', 'ke', 'ko', 'me', 'se', 'the', 'a', 'an', 'and', 'for', 'with', 'in', 'of', 'to', 'on', 'at', 'by', 'or']);
        aiKeywords = cleaned.split(',').map(s => s.trim().toLowerCase()).filter(s => s && s.length > 1 && !stopWords.has(s));
      }
    } catch (aiErr) {
      console.warn('[AI-SEARCH] AI keyword extraction failed, falling back to raw query:', aiErr.message);
    }

    const rawWords = qTrimmed.split(/\s+/).map(s => s.toLowerCase()).filter(s => s.length > 1);
    const allKeywords = [...new Set([...aiKeywords, ...rawWords])];

    const keywordPattern = allKeywords.map(k => {
      const esc = escapeRegExp(k);
      return esc.length <= 3 ? `\\b${esc}\\b` : esc;
    }).join('|');
    const keywordRegex = new RegExp(keywordPattern, 'i');

    // Separate regexes for different weights
    const primaryPattern = rawWords.map(k => {
      const esc = escapeRegExp(k);
      return esc.length <= 3 ? `\\b${esc}\\b` : esc;
    }).join('|');
    const primaryRegex = new RegExp(primaryPattern || escapeRegExp(qTrimmed), 'i');

    const secondaryPattern = aiKeywords.length > 0 ? aiKeywords.map(k => {
      const esc = escapeRegExp(k);
      return esc.length <= 3 ? `\\b${esc}\\b` : esc;
    }).join('|') : null;
    const secondaryRegex = secondaryPattern ? new RegExp(secondaryPattern, 'i') : null;

    const exactRegex = new RegExp(`^${escapeRegExp(qTrimmed)}$`, 'i');
    const partialRegex = new RegExp(escapeRegExp(qTrimmed), 'i');

    // ─── Step 3: Match products (Broad match for base set) ──────────────────────
    const baseMatch = {
      status: { $in: ['Active', 'Out of Stock', 'Low Stock'] },
      $or: [
        { name: { $regex: keywordRegex } },
        { description: { $regex: keywordRegex } },
        { tags: { $in: [primaryRegex] } }
      ]
    };

    // ─── Step 4: Aggregate with weighted relevance scoring ──────────────────────
    const pipeline = [
      { $match: baseMatch },
      {
        $addFields: {
          relevanceScore: {
            $add: [
              // Exact name match (Highest Weight)
              { $cond: [{ $regexMatch: { input: '$name', regex: exactRegex } }, 100, 0] },
              // Partial original query in name
              { $cond: [{ $regexMatch: { input: '$name', regex: partialRegex } }, 70, 0] },
              // Original query in tags
              { $cond: [{ $regexMatch: { input: { $reduce: { input: { $ifNull: ["$tags", []] }, initialValue: "", in: { $concat: ["$$value", " ", "$$this"] } } }, regex: primaryRegex } }, 50, 0] },
              // AI Keyword in name
              { $cond: [secondaryRegex ? { $regexMatch: { input: '$name', regex: secondaryRegex } } : false, 50, 0] },
              // Matches in description (Lowest Weight)
              { $cond: [{ $regexMatch: { input: { $ifNull: ['$description', ''] }, regex: partialRegex } }, 20, 0] },
              { $cond: [secondaryRegex ? { $regexMatch: { input: { $ifNull: ['$description', ''] }, regex: secondaryRegex } } : false, 10, 0] },
              { $cond: ['$isSaathigro', 5, 0] }
            ]
          }
        }
      },
      // Higher threshold: items must reach at least 50 points to be included.
      // If isAI is true, we relax this to 20 to show related items.
      { $match: { relevanceScore: { $gte: req.query.isAI === 'true' ? 20 : 50 } } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $sort: { relevanceScore: -1, isSaathigro: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
          ]
        }
      }
    ];

    const [result] = await Product.aggregate(pipeline);
    const total = result?.metadata?.[0]?.total || 0;
    const pages = Math.ceil(total / limit);
    let products = result?.data || [];

    // ─── Step 5: Populate refs ──────────────────────────────────────────────────
    if (products.length > 0) {
      products = await Product.populate(products, [
        { path: 'branchStocks.branchId', select: 'name code logo phone email address' },
        { path: 'vendor', select: 'storeName logo businessType phone email address' }
      ]);
    }

    // ─── Step 6: Store-aware stock + deliverability ─────────────────────────────
    if (products.length > 0 && effectiveStoreId && storeType) {
      products = products.map(p => {
        const pObj = p.toObject ? p.toObject() : p;
        let isDeliverable = false, availableStock = 0, lowStockThreshold = 10, inStore = false;

        if (storeType === 'branch') {
          const bs = pObj.branchStocks?.find(b => {
            const bId = b.branchId?._id || b.branchId;
            return bId && bId.toString() === effectiveStoreId.toString();
          });
          if (bs) {
            inStore = true;
            availableStock = bs.stock || 0;
            lowStockThreshold = bs.lowStockThreshold || 10;
            if (availableStock > 0) isDeliverable = true;
          } else if (pObj.isAllBranches) {
            inStore = true;
            availableStock = 0;
            lowStockThreshold = pObj.lowStockThreshold || 10;
            isDeliverable = false;
          }
        } else if (storeType === 'vendor') {
          const vId = pObj.vendor?._id || pObj.vendor;
          if (vId && vId.toString() === effectiveStoreId.toString()) {
            inStore = true;
            availableStock = pObj.stock || 0;
            lowStockThreshold = pObj.lowStockThreshold || 10;
            if (availableStock > 0) isDeliverable = true;
          }
        }

        return { ...pObj, isDeliverable, availableStock, lowStockThreshold, inStore };
      });
    }

    // ─── Step 7: Store Manager role — filter to own branch only ───────────────
    if (req.admin && req.admin.role !== 'Admin' && req.admin.branchId) {
      products = products.map(p => {
        const pObj = p.toObject ? p.toObject() : p;
        pObj.branchStocks = (pObj.branchStocks || []).filter(bs => {
          const bId = bs.branchId?._id || bs.branchId;
          return bId && bId.toString() === req.admin.branchId.toString();
        });
        if (pObj.status !== 'Draft') {
          pObj.status = pObj.vendor
            ? determineProductStatus([], pObj.stock, pObj.lowStockThreshold)
            : determineProductStatus(pObj.branchStocks);
        }
        return pObj;
      });
    }

    if (qTrimmed && Number(page || 1) === 1) {
      recordSearchLog(req, qTrimmed, total, 'ai').catch(() => {});
    }

    return res.json({ products, total, page, pages });

  } catch (error) {
    console.error('[AI-SEARCH] Fatal error:', error);
    res.status(500).json({ message: 'Search failed. Please try again.', error: error.message });
  }
};

// @desc    Get product by ID
// @route   GET /api/admin/products/:id
// @access  Private (Admin/Staff)
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('branchStocks.branchId', 'name code logo phone email address')
      .populate('vendor', 'storeName logo businessType phone email address');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const pObj = product.toObject();

    // Store-Aware logic for single product view
    const { storeId, storeType } = req.query;
    const effectiveStoreId = (storeId && storeId !== 'null' && storeId !== 'undefined') ? storeId : null;
    if (effectiveStoreId && storeType) {
      // Security Check: Verify store status before returning store-specific stock
      if (storeType === 'branch') {
        const branch = await Branch.findById(effectiveStoreId).select('isActive');
        if (!branch || !branch.isActive) {
          return res.status(403).json({ message: 'This store is currently inactive' });
        }
      } else {
        const v = await mongoose.model('Vendor').findById(effectiveStoreId).select('status');
        if (!v || v.status !== 'Active') {
          return res.status(403).json({ message: 'This vendor is currently inactive' });
        }
      }

      let isDeliverable = false;
      let availableStock = 0;
      let lowStockThreshold = 10;
      let inStore = false;

      if (storeType === 'branch') {
        const branchStock = pObj.branchStocks?.find(bs => {
          const bId = bs.branchId?._id || bs.branchId;
          return bId && bId.toString() === effectiveStoreId.toString();
        });
        if (branchStock) {
          inStore = true;
          availableStock = branchStock.stock || 0;
          lowStockThreshold = branchStock.lowStockThreshold || 10;
          if (availableStock > 0) {
            isDeliverable = true;
          }
        } else if (pObj.vendor) {
          inStore = true;
          availableStock = pObj.stock || 0;
          lowStockThreshold = pObj.lowStockThreshold || 10;
          if (availableStock > 0) {
            isDeliverable = true;
          }
        } else if (pObj.isAllBranches) {
          inStore = true;
          availableStock = 0;
          lowStockThreshold = pObj.lowStockThreshold || 10;
          isDeliverable = false;
        }
      } else if (storeType === 'vendor') {
        const vId = pObj.vendor?._id || pObj.vendor;
        if (vId && vId.toString() === effectiveStoreId.toString()) {
          inStore = true;
          availableStock = pObj.stock || 0;
          lowStockThreshold = pObj.lowStockThreshold || 10;
          if (availableStock > 0) {
            isDeliverable = true;
          }
        }
      }
      pObj.isDeliverable = isDeliverable;
      pObj.availableStock = availableStock;
      pObj.lowStockThreshold = lowStockThreshold;
      pObj.maxAllowed = availableStock; // Allow ordering up to full available stock, even if low stock
      pObj.inStore = inStore;

      // Enrich sourceInfo
      if (storeType === 'branch') {
        const targetBranch = pObj.branchStocks?.find(bs => (bs.branchId?._id || bs.branchId)?.toString() === effectiveStoreId.toString());
        if (targetBranch) {
          pObj.sourceInfo = {
            id: effectiveStoreId,
            type: 'Branch',
            name: targetBranch.branchId?.name,
            logo: targetBranch.branchId?.logo,
            code: targetBranch.branchId?.code,
            phone: targetBranch.branchId?.phone,
            email: targetBranch.branchId?.email,
            address: targetBranch.branchId?.address
          };
        }
      } else if (storeType === 'vendor' && pObj.vendor) {
        pObj.sourceInfo = {
          id: pObj.vendor._id || pObj.vendor,
          type: 'Vendor',
          name: pObj.vendor.storeName,
          logo: pObj.vendor.logo,
          phone: pObj.vendor.phone,
          email: pObj.vendor.email,
          address: pObj.vendor.address
        };
      }
    }

    // Enrich Brand Info
    if (pObj.brandName) {
      const brandDoc = await Brand.findOne({ name: new RegExp(`^${escapeRegExp(pObj.brandName)}$`, 'i') }).lean();
      if (brandDoc) {
        pObj.brandInfo = {
          id: brandDoc._id,
          name: brandDoc.name,
          logo: brandDoc.logo,
          description: brandDoc.description
        };
      }
    }

    res.json(pObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Private (Admin/Staff)
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      // Restriction: Admin/Staff/Store Managers cannot edit vendor products via this controller
      if (product.vendor) {
        return res.status(403).json({ message: 'Only vendors can manage their own products. Admin/Staff editing is restricted for vendor partners.' });
      }

      product.name = req.body.name || product.name;
      product.description = req.body.description || product.description;
      if (req.body.tags) {
        product.tags = typeof req.body.tags === 'string' ? req.body.tags.split(',') : req.body.tags;
      }

      const oldPrice = product.basePrice;
      product.basePrice = req.body.basePrice || product.basePrice;

      // Price Drop Notification
      if (oldPrice > 0 && product.basePrice < oldPrice) {
        const interestedUsers = await User.find({ wishlist: product._id });
        for (const user of interestedUsers) {
          sendPushNotification(user._id, 'User', {
            title: 'Price Drop Alert! 📉',
            body: `Great news! ${product.name} in your wishlist is now available at a lower price: ₹${product.basePrice}`
          }, { productId: product._id.toString(), type: 'price_drop' });
        }
      }

      product.unitType = req.body.unitType || product.unitType;
      product.unitValue = req.body.unitValue !== undefined ? Number(req.body.unitValue) : product.unitValue;
      product.physicalLocation = req.body.physicalLocation || product.physicalLocation;
      product.category = req.body.category || product.category;
      product.subCategory = req.body.subCategory !== undefined ? req.body.subCategory : product.subCategory;
      if (req.body.brandName !== undefined) {
        product.brandName = String(req.body.brandName || '').trim();
      }
      product.vendor = req.body.vendor !== undefined ? (req.body.vendor || null) : product.vendor;

      // Update vendor stock/threshold if it's a vendor product
      if (product.vendor) {
        if (req.body.stock !== undefined) product.stock = Number(req.body.stock);
        if (req.body.lowStockThreshold !== undefined) product.lowStockThreshold = Number(req.body.lowStockThreshold);
      }

      product.mrp = req.body.mrp !== undefined ? Number(req.body.mrp) : product.mrp;
      product.isVeg = req.body.isVeg !== undefined ? (req.body.isVeg === 'true' || req.body.isVeg === true) : product.isVeg;
      product.isSaathigro = req.body.isSaathigro !== undefined ? (req.body.isSaathigro === 'true' || req.body.isSaathigro === true) : product.isSaathigro;
      if (req.body.stock !== undefined) {
        const parsedStock = Number(req.body.stock);
        if (Number.isFinite(parsedStock)) {
          product.stock = parsedStock;
        }
      }
      if (req.body.lowStockThreshold !== undefined) {
        const parsedThreshold = Number(req.body.lowStockThreshold);
        if (Number.isFinite(parsedThreshold)) {
          product.lowStockThreshold = parsedThreshold;
        }
      }

      if (req.body.variants) {
        product.variants = typeof req.body.variants === 'string' ? JSON.parse(req.body.variants) : req.body.variants;
      }

      if (req.body.sku && req.body.sku !== product.sku) {
        product.sku = req.body.sku;
        // Regenerate QR Code if SKU changed
        product.qrCode = await QRCode.toDataURL(product.sku, {
          color: { dark: '#000000', light: '#ffffff' },
          margin: 1
        });
      }

      if (req.body.isAllBranches !== undefined) {
        product.isAllBranches = req.body.isAllBranches === 'true' || req.body.isAllBranches === true;
      }
      if (req.body.specificBranches) {
        product.specificBranches = typeof req.body.specificBranches === 'string'
          ? req.body.specificBranches.split(',').map(s => s.trim()).filter(Boolean)
          : (req.body.specificBranches || []).filter(Boolean);
      }
      product.sku = req.body.sku || product.sku;

      // Update new inventory fields
      if (req.body.reorderThreshold !== undefined) product.reorderThreshold = Number(req.body.reorderThreshold);
      if (req.body.maxCapacityPerSku !== undefined) product.maxCapacityPerSku = Number(req.body.maxCapacityPerSku);
      if (req.body.isStockAutoSync !== undefined) product.isStockAutoSync = req.body.isStockAutoSync === 'true' || req.body.isStockAutoSync === true;
      if (req.body.weightCategory !== undefined) product.weightCategory = req.body.weightCategory;
      if (req.body.isFragile !== undefined) product.isFragile = req.body.isFragile === 'true' || req.body.isFragile === true;
      if (req.body.temperatureType !== undefined) product.temperatureType = req.body.temperatureType;
      if (req.body.pickPriority !== undefined) product.pickPriority = Number(req.body.pickPriority);
      if (req.body.pickingZone !== undefined) product.pickingZone = req.body.pickingZone;
      if (req.body.variantGroupId !== undefined) product.variantGroupId = req.body.variantGroupId;
      if (req.body.pickSequence !== undefined) product.pickSequence = Number(req.body.pickSequence);
      if (req.body.displayOrder !== undefined) {
        if (req.body.displayOrder === null || String(req.body.displayOrder).trim() === '') {
          product.displayOrder = null;
        } else {
          const num = Number(req.body.displayOrder);
          if (!Number.isFinite(num) || num < 0) {
            return res.status(400).json({ message: 'Invalid displayOrder. Must be a non-negative number or null.' });
          }
          product.displayOrder = num;
        }
      }

      // Handle Branch Stock Updates
      if (req.body.branchStocks) {
        let parsedBranchStocks = req.body.branchStocks;
        if (typeof req.body.branchStocks === 'string') {
          try {
            parsedBranchStocks = JSON.parse(req.body.branchStocks);
          } catch (e) {
            parsedBranchStocks = product.branchStocks;
          }
        }

        const newBranchIds = parsedBranchStocks.map(bs => bs.branchId.toString());

        // Remove branches that are no longer present
        product.branchStocks = product.branchStocks.filter(bs =>
          newBranchIds.includes(bs.branchId.toString())
        );

        // Update or Add branches
        for (const newBranchStock of parsedBranchStocks) {
          const existingIndex = product.branchStocks.findIndex(bs => bs.branchId.toString() === newBranchStock.branchId.toString());

          if (existingIndex !== -1) {
            const oldStock = product.branchStocks[existingIndex].stock;
            if (oldStock !== Number(newBranchStock.stock)) {
              await InventoryLog.create({
                product: product._id,
                admin: req.admin._id,
                branchId: newBranchStock.branchId,
                changeAmount: Number(newBranchStock.stock) - oldStock,
                previousStock: oldStock,
                newStock: newBranchStock.stock,
                type: Number(newBranchStock.stock) > oldStock ? 'Addition' : 'Deduction',
                reason: req.body.reason || 'Manual Update'
              });
            }
            product.branchStocks[existingIndex].stock = newBranchStock.stock;
            product.branchStocks[existingIndex].lowStockThreshold = newBranchStock.lowStockThreshold || product.branchStocks[existingIndex].lowStockThreshold;
          } else {
            // New branch added to product
            product.branchStocks.push(newBranchStock);
            await InventoryLog.create({
              product: product._id,
              admin: req.admin._id,
              branchId: newBranchStock.branchId,
              changeAmount: newBranchStock.stock,
              previousStock: 0,
              newStock: newBranchStock.stock,
              type: 'Addition',
              reason: 'New Branch Added'
            });
          }
        }

        // Keep specificBranches and isAllBranches in sync with branchStocks
        product.specificBranches = newBranchIds;
      }

      if (product.vendor && req.body.stock !== undefined && Number.isFinite(Number(req.body.stock)) && Number(req.body.stock) !== previousVendorStock) {
        await InventoryLog.create({
          product: product._id,
          admin: req.admin._id,
          vendorId: product.vendor,
          changeAmount: Number(req.body.stock) - previousVendorStock,
          previousStock: previousVendorStock,
          newStock: Number(req.body.stock),
          type: Number(req.body.stock) > previousVendorStock ? 'Addition' : 'Deduction',
          reason: req.body.reason || 'Manual Update'
        });
      }

      // Automatically update status if it's not Draft
      if (product.status !== 'Draft') {
        if (product.vendor) {
          product.status = determineProductStatus([], product.stock, product.lowStockThreshold);
        } else {
          product.status = determineProductStatus(product.branchStocks);
        }
      } else if (req.body.status && req.body.status !== 'Draft') {
        if (product.vendor) {
          product.status = determineProductStatus([], product.stock, product.lowStockThreshold);
        } else {
          product.status = determineProductStatus(product.branchStocks);
        }
      } else if (req.body.status === 'Draft') {
        product.status = 'Draft';
      }

      let finalGallery = [];
      if (req.body.existingGallery) {
        try {
          finalGallery = JSON.parse(req.body.existingGallery);
        } catch (e) {
          finalGallery = [];
        }
      }

      if (req.files) {
        if (req.files.image && req.files.image[0]) {
          product.image = req.files.image[0].path;
        }
        if (req.files.gallery) {
          const newGalleryPaths = req.files.gallery.map(file => file.path);
          finalGallery = [...finalGallery, ...newGalleryPaths];
        }
      }

      product.gallery = finalGallery;

      const updatedProduct = await product.save();

      // Sync physical location assignment
      // ── Conflict check: shelf already occupied by a DIFFERENT product? ──
      if (updatedProduct.physicalLocation) {
        const locFilter = { label: updatedProduct.physicalLocation.trim(), isActive: true };
        const branchIdForLoc = updatedProduct.branchStocks?.[0]?.branchId?.toString() || null;
        const vendorIdForLoc = updatedProduct.vendor ? updatedProduct.vendor.toString() : null;
        if (branchIdForLoc) locFilter.branchId = branchIdForLoc;
        else if (vendorIdForLoc) locFilter.vendorId = vendorIdForLoc;

        const occupiedLoc = await PhysicalLocation.findOne(locFilter).populate('assignedProduct', 'name sku _id');
        if (
          occupiedLoc &&
          occupiedLoc.assignedProduct &&
          occupiedLoc.assignedProduct._id.toString() !== updatedProduct._id.toString()
        ) {
          return res.status(409).json({
            message: `Shelf "${updatedProduct.physicalLocation}" is already occupied by "${occupiedLoc.assignedProduct.name}" (${occupiedLoc.assignedProduct.sku}). Please choose a different shelf.`
          });
        }
      }

      await syncLocationAssignment({
        newLabel: updatedProduct.physicalLocation || null,
        productId: updatedProduct._id.toString(),
        branchId: updatedProduct.branchStocks?.[0]?.branchId?.toString() || null,
        vendorId: updatedProduct.vendor ? updatedProduct.vendor.toString() : null
      });

      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Adjust inventory (Restock/Audit) for a specific branch
// @route   POST /api/admin/products/:id/inventory
// @access  Private (Admin/Staff)
export const adjustInventory = async (req, res) => {
  try {
    const { branchId, amount, type, reason, storeType } = req.body;
    let finalBranchId = branchId;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Restriction: Any admin portal user cannot adjust inventory for vendor products
    if (product.vendor) {
      return res.status(403).json({ message: 'Vendor product inventory is managed exclusively by the vendor. Admin/Staff access is restricted.' });
    }

    // 1. Handle Vendor Products (Direct Stock)
    if (product.vendor && (!branchId || branchId === 'vendor')) {
      const previousStock = product.stock || 0;
      let newStock = previousStock;

      if (type === 'Addition' || type === 'Return') {
        newStock += Number(amount);
      } else if (type === 'Deduction' || type === 'Sale' || type === 'Damage') {
        newStock -= Number(amount);
      } else if (type === 'Audit') {
        newStock = Number(amount);
      } else {
        return res.status(400).json({ message: 'Invalid adjustment type' });
      }

      if (newStock < 0) {
        return res.status(400).json({ message: 'Stock cannot be negative' });
      }

      product.stock = newStock;
      if (product.status !== 'Draft') {
        product.status = determineProductStatus([], product.stock, product.lowStockThreshold);
      }
      await product.save();

      const log = await InventoryLog.create({
        product: product._id,
        admin: req.admin._id,
        vendorId: product.vendor,
        changeAmount: type === 'Audit' ? newStock - previousStock : (type === 'Addition' || type === 'Return' ? amount : -amount),
        previousStock,
        newStock,
        type,
        reason: reason || 'Inventory Adjustment (Vendor Direct)'
      });

      return res.json({ product, log });
    }

    // 2. Handle Branch Products
    // Security check: Staff and Branch Managers can ONLY adjust their own branch's inventory
    if (req.admin.role !== 'Admin') {
      if (!req.admin.branchId) {
        return res.status(403).json({ message: 'You are not assigned to any branch. Cannot adjust inventory.' });
      }

      // If they provided a branchId, it MUST match their assigned branch
      if (branchId && branchId.toString() !== req.admin.branchId.toString()) {
        return res.status(403).json({ message: 'You can only adjust inventory for your own branch.' });
      }

      finalBranchId = req.admin.branchId;
    }

    if (!finalBranchId) {
      return res.status(400).json({ message: 'Branch ID is required for inventory adjustment' });
    }

    const branchStockIndex = product.branchStocks.findIndex(bs => bs.branchId.toString() === finalBranchId.toString());

    if (branchStockIndex === -1) {
      // Branch not found in product stocks, add it
      const previousStock = 0;
      let newStock = amount;

      product.branchStocks.push({
        branchId: finalBranchId,
        stock: newStock,
        lowStockThreshold: 10
      });

      if (product.status !== 'Draft') {
        product.status = determineProductStatus(product.branchStocks);
      }
      await product.save();

      const log = await InventoryLog.create({
        product: product._id,
        admin: req.admin._id,
        branchId: finalBranchId,
        changeAmount: amount,
        previousStock,
        newStock,
        type,
        reason: reason || 'Inventory Adjustment (New Branch)'
      });

      return res.json({ product, log });
    }

    const previousStock = product.branchStocks[branchStockIndex].stock;
    let newStock = previousStock;

    if (type === 'Addition' || type === 'Return') {
      newStock += Number(amount);
    } else if (type === 'Deduction' || type === 'Sale' || type === 'Damage') {
      newStock -= Number(amount);
    } else if (type === 'Audit') {
      newStock = Number(amount);
    } else {
      return res.status(400).json({ message: 'Invalid adjustment type' });
    }

    if (newStock < 0) {
      return res.status(400).json({ message: 'Stock cannot be negative' });
    }

    product.branchStocks[branchStockIndex].stock = newStock;
    if (product.status !== 'Draft') {
      product.status = determineProductStatus(product.branchStocks);
    }
    await product.save();

    const log = await InventoryLog.create({
      product: product._id,
      admin: req.admin._id,
      branchId: finalBranchId,
      changeAmount: type === 'Audit' ? newStock - previousStock : (type === 'Addition' || type === 'Return' ? amount : -amount),
      previousStock,
      newStock,
      type,
      reason: reason || 'Inventory Adjustment'
    });

    res.json({ product, log });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk Adjust inventory
// @route   POST /api/admin/products/inventory/bulk-adjust
// @access  Private (Admin/Staff)
export const bulkAdjustInventory = async (req, res) => {
  try {
    const { adjustments, commonData } = req.body; // adjustments: [{ productId, branchId, amount }], commonData: { type, reason, notes }

    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
      return res.status(400).json({ message: 'Invalid adjustments data' });
    }

    const { type, reason, notes } = commonData || {};
    const finalReason = (reason || 'Inventory Adjustment') + (notes ? ` - ${notes}` : '');
    const results = [];

    for (const adj of adjustments) {
      const { productId, branchId, amount } = adj;
      const product = await Product.findById(productId);

      if (!product) continue;

      // Skip vendor products
      if (product.vendor) continue;

      let finalBranchId = branchId;
      if (req.admin.role !== 'Admin') {
        if (!req.admin.branchId) continue;
        finalBranchId = req.admin.branchId;
      }

      if (!finalBranchId) continue;

      const branchStockIndex = product.branchStocks.findIndex(bs => bs.branchId.toString() === finalBranchId.toString());

      if (branchStockIndex === -1) {
        const previousStock = 0;
        let newStock = Number(amount);
        product.branchStocks.push({
          branchId: finalBranchId,
          stock: newStock,
          lowStockThreshold: 10
        });
        if (product.status !== 'Draft') {
          product.status = determineProductStatus(product.branchStocks);
        }
        await product.save();
        await InventoryLog.create({
          product: product._id,
          admin: req.admin._id,
          branchId: finalBranchId,
          changeAmount: amount,
          previousStock,
          newStock,
          type: type || 'Addition',
          reason: finalReason || 'Bulk Inventory Adjustment (New Branch)'
        });
      } else {
        const previousStock = product.branchStocks[branchStockIndex].stock;
        let newStock = previousStock;

        if (type === 'Addition' || type === 'Return') {
          newStock += Number(amount);
        } else if (type === 'Deduction' || type === 'Sale' || type === 'Damage') {
          newStock -= Number(amount);
        } else if (type === 'Audit') {
          newStock = Number(amount);
        } else {
          newStock += Number(amount); // Default to addition
        }

        if (newStock < 0) newStock = 0;

        product.branchStocks[branchStockIndex].stock = newStock;
        if (product.status !== 'Draft') {
          product.status = determineProductStatus(product.branchStocks);
        }
        await product.save();
        await InventoryLog.create({
          product: product._id,
          admin: req.admin._id,
          branchId: finalBranchId,
          changeAmount: type === 'Audit' ? newStock - previousStock : (type === 'Addition' || type === 'Return' ? amount : -amount),
          previousStock,
          newStock,
          type: type || 'Addition',
          reason: finalReason || 'Bulk Inventory Adjustment'
        });
      }
      results.push(productId);
    }

    res.json({ success: true, message: `Successfully adjusted ${results.length} products`, results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all inventory logs (Global)
// @route   GET /api/admin/products/inventory-logs
// @access  Private (Admin/Staff)
export const getAllInventoryLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.admin && req.admin.role !== 'Admin') {
      if (req.admin.branchId) {
        query.branchId = req.admin.branchId;
      } else {
        return res.json({ logs: [], total: 0, page, totalPages: 0 });
      }
    }

    const total = await InventoryLog.countDocuments(query);
    const logs = await InventoryLog.find(query)
      .select('product admin branchId vendorId changeAmount previousStock newStock type reason createdAt')
      .populate('product', 'name sku image')
      .populate('admin', 'name email')
      .populate('branchId', 'name code')
      .populate('vendorId', 'storeName logo')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get inventory logs for a product
// @route   GET /api/admin/products/:id/inventory-logs
// @access  Private (Admin/Staff)
export const getInventoryLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = { product: req.params.id };

    if (req.admin && req.admin.role !== 'Admin') {
      if (req.admin.branchId) {
        query.branchId = req.admin.branchId;
      } else {
        return res.json({ logs: [], total: 0 });
      }
    }

    const total = await InventoryLog.countDocuments(query);
    const logs = await InventoryLog.find(query)
      .select('admin branchId vendorId changeAmount previousStock newStock type reason createdAt')
      .populate('admin', 'name email')
      .populate('branchId', 'name code')
      .populate('vendorId', 'storeName logo')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get unique brand names
// @route   GET /api/admin/products/brands
// @access  Public
export const getUniqueBrands = async (req, res) => {
  try {
    const { category } = req.query;
    let query = { status: 'Active' };

    if (category) {
      query.category = new RegExp(`^${escapeRegExp(category.trim())}$`, 'i');
    }

    const brands = await Product.distinct('brandName', query);
    res.json(brands.filter(Boolean).sort());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Private (Admin)
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Restriction: Only Super Admins can delete vendor products. Other portal roles (Staff/Managers) are blocked.
    if (product.vendor && req.admin.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Only Super Admins or the vendor partner can delete this product.' });
    }

    await product.deleteOne();
    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk delete products
// @route   DELETE /api/admin/products/bulk
// @access  Private (Admin)
export const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No product ids provided' });
    }

    const objectIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (objectIds.length === 0) {
      return res.status(400).json({ message: 'No valid product ids provided' });
    }

    const query = { _id: { $in: objectIds } };

    // Non-admins cannot delete vendor-owned products
    if (req.admin?.role !== 'Admin') {
      query.$or = [{ vendor: null }, { vendor: { $exists: false } }];
    }

    const result = await Product.deleteMany(query);

    res.json({
      message: `${result.deletedCount} product(s) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get inventory analytical stats
// @route   GET /api/admin/products/inventory/stats
// @access  Private (Admin/Staff)
export const getInventoryStats = async (req, res) => {
  try {
    const { branchId, role } = req.admin;
    const targetBranchId = (role !== 'Admin') ? branchId : req.query.branchId;

    const isBranchProductMatch = {
      status: { $ne: 'Draft' },
      $or: [
        { vendor: null },
        { vendor: { $exists: false } }
      ]
    };

    // 1. Holistic Aggregate for KPIs
    const statsResult = await Product.aggregate([
      {
        $match: (targetBranchId && targetBranchId !== 'all' && targetBranchId !== 'vendor' && mongoose.Types.ObjectId.isValid(targetBranchId))
          ? {
            ...isBranchProductMatch,
            branchStocks: { $elemMatch: { branchId: new mongoose.Types.ObjectId(targetBranchId) } }
          }
          : isBranchProductMatch
      },
      {
        $project: {
          basePrice: 1,
          focusedStock: (targetBranchId && targetBranchId !== 'all' && targetBranchId !== 'vendor')
            ? {
              $filter: {
                input: "$branchStocks",
                as: "bs",
                cond: { $eq: [{ $toObjectId: "$$bs.branchId" }, new mongoose.Types.ObjectId(targetBranchId)] }
              }
            }
            : "$branchStocks"
        }
      },
      {
        $project: {
          itemStock: { $sum: "$focusedStock.stock" },
          itemValue: { $multiply: [{ $sum: "$focusedStock.stock" }, "$basePrice"] },
          isLow: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$focusedStock",
                    as: "s",
                    cond: {
                      $and: [
                        { $gt: ["$$s.stock", 0] },
                        { $lte: ["$$s.stock", { $ifNull: ["$$s.lowStockThreshold", 10] }] }
                      ]
                    }
                  }
                }
              },
              0
            ]
          },
          isOut: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$focusedStock",
                    as: "s",
                    cond: { $lte: ["$$s.stock", 0] }
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: "$itemStock" },
          inventoryValue: { $sum: "$itemValue" },
          lowStockCount: { $sum: { $cond: ["$isLow", 1, 0] } },
          outOfStockCount: { $sum: { $cond: ["$isOut", 1, 0] } }
        }
      }
    ]);

    const stats = statsResult[0] || {
      totalProducts: 0, totalStock: 0, inventoryValue: 0, lowStockCount: 0, outOfStockCount: 0
    };

    // 2. Facets for Distribution and Urgent Items
    const facets = await Product.aggregate([
      { $match: isBranchProductMatch },
      {
        $facet: {
          categoryDist: [
            { $unwind: "$branchStocks" },
            { $addFields: { bId: { $toObjectId: "$branchStocks.branchId" } } },
            { $match: (targetBranchId && targetBranchId !== 'all') ? { bId: new mongoose.Types.ObjectId(targetBranchId) } : {} },
            { $group: { _id: "$category", stock: { $sum: "$branchStocks.stock" } } },
            { $sort: { stock: -1 } },
            { $limit: 10 }
          ],
          lowStockItems: [
            { $unwind: "$branchStocks" },
            { $addFields: { bId: { $toObjectId: "$branchStocks.branchId" } } },
            { $match: (targetBranchId && targetBranchId !== 'all') ? { bId: new mongoose.Types.ObjectId(targetBranchId) } : {} },
            { $match: { "branchStocks.stock": { $lte: 0 } } },
            { $limit: 5 },
            {
              $lookup: {
                from: 'branches',
                localField: 'bId',
                foreignField: '_id',
                as: 'bInfo'
              }
            },
            {
              $project: {
                name: 1, sku: 1, image: 1, stock: "$branchStocks.stock",
                branchName: { $arrayElemAt: ["$bInfo.name", 0] }
              }
            }
          ]
        }
      }
    ]);

    const categoryDistribution = facets[0]?.categoryDist || [];
    const restockItems = facets[0]?.lowStockItems || [];

    // 3. Branch Health (Detailed Super-Admin Grid)
    let branchHealth = [];
    if (!targetBranchId || targetBranchId === 'all') {
      const allBranches = await Branch.find({ isActive: true }).select('name code branchCode');
      const bStats = await Product.aggregate([
        { $match: isBranchProductMatch },
        { $unwind: "$branchStocks" },
        { $addFields: { bId: { $toObjectId: "$branchStocks.branchId" } } },
        {
          $group: {
            _id: "$bId",
            totalProducts: { $sum: 1 },
            low: { $sum: { $cond: [{ $and: [{ $gt: ["$branchStocks.stock", 0] }, { $lte: ["$branchStocks.stock", { $ifNull: ["$branchStocks.lowStockThreshold", 10] }] }] }, 1, 0] } },
            outNum: { $sum: { $cond: [{ $lte: ["$branchStocks.stock", 0] }, 1, 0] } },
            sumStock: { $sum: "$branchStocks.stock" }
          }
        }
      ]);

      branchHealth = allBranches.map(branch => {
        const s = bStats.find(st => st._id?.toString() === branch._id.toString()) || { totalProducts: 0, low: 0, outNum: 0, sumStock: 0 };
        const issues = s.low + s.outNum;
        return {
          _id: branch._id, name: branch.name, code: branch.code || branch.branchCode || 'N/A',
          totalProducts: s.totalProducts, lowStock: s.low, outOfStock: s.outNum, totalStock: s.sumStock,
          healthScore: s.totalProducts > 0 ? Math.max(0, 100 - ((issues / s.totalProducts) * 100)) : 100
        };
      });
    }

    // 4. Critical Items Unified
    const criticalItems = await Product.aggregate([
      { $match: isBranchProductMatch },
      { $unwind: "$branchStocks" },
      { $addFields: { bId: { $toObjectId: "$branchStocks.branchId" } } },
      { $match: (targetBranchId && targetBranchId !== 'all') ? { bId: new mongoose.Types.ObjectId(targetBranchId) } : {} },
      { $match: { $expr: { $lte: ["$branchStocks.stock", { $ifNull: ["$branchStocks.lowStockThreshold", 10] }] } } },
      { $sort: { "branchStocks.stock": 1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'branches',
          localField: 'bId',
          foreignField: '_id',
          as: 'bInfo'
        }
      },
      {
        $project: {
          _id: "$_id",
          name: 1, image: 1, stock: "$branchStocks.stock", threshold: "$branchStocks.lowStockThreshold",
          branchName: { $arrayElemAt: ["$bInfo.name", 0] }
        }
      }
    ]);

    res.json({
      success: true,
      stats,
      categoryDistribution: categoryDistribution.map(c => ({ name: c._id, stock: c.stock })),
      branchHealth,
      criticalItems
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get branch-wise stock with filtering and pagination
// @route   GET /api/admin/products/inventory/branch-wise
// @access  Private (Admin/Staff)
export const getBranchWiseStock = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      branchId,
      status, // 'Low Stock', 'Out of Stock', 'In Stock'
      category
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    let initialMatch = {
      $or: [
        { vendor: null },
        { vendor: { $exists: false } }
      ],
      status: { $ne: 'Draft' }
    };

    // Aggregation Pipeline
    const pipeline = [
      { $match: initialMatch },
      { $unwind: "$branchStocks" },
      { $addFields: { "branchStocks.branchId": { $toObjectId: "$branchStocks.branchId" } } }
    ];

    // Branch Scoping
    if (req.admin.role !== 'Admin' && req.admin.branchId) {
      pipeline.push({ $match: { "branchStocks.branchId": new mongoose.Types.ObjectId(req.admin.branchId) } });
    } else if (branchId && branchId !== 'vendor' && mongoose.Types.ObjectId.isValid(branchId)) {
      pipeline.push({ $match: { "branchStocks.branchId": new mongoose.Types.ObjectId(branchId) } });
    }

    // Status Filtering
    if (status) {
      if (status === 'Out of Stock') {
        pipeline.push({ $match: { "branchStocks.stock": { $lte: 0 } } });
      } else if (status === 'Low Stock') {
        pipeline.push({
          $match: {
            $expr: {
              $and: [
                { $gt: ["$branchStocks.stock", 0] },
                { $lte: ["$branchStocks.stock", "$branchStocks.lowStockThreshold"] }
              ]
            }
          }
        });
      } else if (status === 'In Stock') {
        pipeline.push({
          $match: {
            $expr: { $gt: ["$branchStocks.stock", "$branchStocks.lowStockThreshold"] }
          }
        });
      }
    }

    // Category Filtering
    if (category) {
      pipeline.push({ $match: { category: new RegExp(escapeRegExp(category), 'i') } });
    }

    // Search (Needs Branch Name too, so lookup first if searching by the name)
    pipeline.push({
      $lookup: {
        from: 'branches',
        localField: 'branchStocks.branchId',
        foreignField: '_id',
        as: 'branchInfo'
      }
    });
    pipeline.push({ $unwind: "$branchInfo" });

    const trimmedSearch = typeof search === 'string' ? search.trim() : '';
    if (trimmedSearch) {
      const escapedSearch = escapeRegExp(trimmedSearch);
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: escapedSearch, $options: 'i' } },
            { sku: { $regex: escapedSearch, $options: 'i' } },
            { "branchInfo.name": { $regex: escapedSearch, $options: 'i' } },
            { "branchInfo.branchCode": { $regex: escapedSearch, $options: 'i' } }
          ]
        }
      });
    }

    // Project only necessary fields
    pipeline.push({
      $project: {
        _id: 0,
        productId: "$_id",
        productName: "$name",
        sku: 1,
        image: 1,
        branchName: "$branchInfo.name",
        branchCode: "$branchInfo.code", // In Branch.js it is 'code', but in previous logs it was sometimes 'branchCode'
        branchId: "$branchStocks.branchId",
        stock: "$branchStocks.stock",
        lowStockThreshold: "$branchStocks.lowStockThreshold",
        status: {
          $cond: {
            if: { $lte: ["$branchStocks.stock", 0] },
            then: "Out of Stock",
            else: {
              $cond: {
                if: { $lte: ["$branchStocks.stock", "$branchStocks.lowStockThreshold"] },
                then: "Low Stock",
                else: "In Stock"
              }
            }
          }
        }
      }
    });

    // Sort: Lowest stock first for visibility
    pipeline.push({ $sort: { stock: 1, productName: 1 } });

    // Pagination via $facet
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limitNum }]
      }
    });

    const result = await Product.aggregate(pipeline);
    const total = result[0].metadata[0]?.total || 0;
    const data = result[0].data;

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: parseInt(page),
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get low stock alerts with filtering and pagination
// @route   GET /api/admin/products/inventory/low-stock
// @access  Private (Admin/Staff)
export const getLowStockAlerts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      branchId,
      category,
      severity // 'Critical', 'Warning'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Initial Match: exclude Drafts
    const baseMatch = { status: { $ne: 'Draft' } };

    const pipeline = [
      {
        $facet: {
          internalStock: [
            {
              $match: {
                ...baseMatch,
                $or: [
                  { vendor: { $exists: false } },
                  { vendor: null }
                ]
              }
            },
            { $unwind: "$branchStocks" },
            { $addFields: { "branchStocks.branchId": { $toObjectId: "$branchStocks.branchId" } } },
            {
              $match: {
                $expr: { $lte: ["$branchStocks.stock", { $ifNull: ["$branchStocks.lowStockThreshold", 10] }] }
              }
            },
            {
              $lookup: {
                from: 'branches',
                localField: 'branchStocks.branchId',
                foreignField: '_id',
                as: 'branchInfo'
              }
            },
            { $unwind: "$branchInfo" },
            {
              $project: {
                productId: "$_id",
                productName: "$name",
                sku: 1,
                image: 1,
                category: 1,
                branchName: "$branchInfo.name",
                branchId: "$branchStocks.branchId",
                stock: "$branchStocks.stock",
                threshold: "$branchStocks.lowStockThreshold",
                isVendor: { $literal: false },
                severity: { $cond: [{ $lte: ["$branchStocks.stock", 0] }, "Critical", "Warning"] }
              }
            }
          ],
          vendorStock: [
            {
              $match: {
                ...baseMatch,
                vendor: { $exists: true }
              }
            },
            {
              $match: {
                $expr: { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 10] }] }
              }
            },
            {
              $lookup: {
                from: 'vendors',
                localField: 'vendor',
                foreignField: '_id',
                as: 'vendorInfo'
              }
            },
            { $unwind: "$vendorInfo" },
            {
              $project: {
                productId: "$_id",
                productName: "$name",
                sku: 1,
                image: 1,
                category: 1,
                branchName: "Vendor Managed",
                storeName: "$vendorInfo.storeName",
                stock: "$stock",
                threshold: "$lowStockThreshold",
                isVendor: { $literal: true },
                severity: { $cond: [{ $lte: ["$stock", 0] }, "Critical", "Warning"] }
              }
            }
          ]
        }
      },
      {
        $project: {
          combined: { $concatArrays: ["$internalStock", "$vendorStock"] }
        }
      },
      { $unwind: "$combined" },
      { $replaceRoot: { newRoot: "$combined" } }
    ];

    // Branch Scoping (Staff only see their own branch, omit vendor products for staff)
    if (req.admin.role !== 'Admin' && req.admin.branchId) {
      pipeline.push({
        $match: {
          isVendor: false,
          branchId: new mongoose.Types.ObjectId(req.admin.branchId)
        }
      });
    } else if (branchId) {
      if (branchId === 'vendor') {
        pipeline.push({ $match: { isVendor: true } });
      } else if (mongoose.Types.ObjectId.isValid(branchId)) {
        pipeline.push({
          $match: {
            branchId: new mongoose.Types.ObjectId(branchId)
          }
        });
      }
    }

    // Category Filter
    if (category) {
      pipeline.push({ $match: { category: new RegExp(escapeRegExp(category), 'i') } });
    }

    // Severity Filter
    if (severity) {
      pipeline.push({ $match: { severity: severity } });
    }

    // Search
    const trimmedSearch = typeof search === 'string' ? search.trim() : '';
    if (trimmedSearch) {
      const escapedSearch = escapeRegExp(trimmedSearch);
      pipeline.push({
        $match: {
          $or: [
            { productName: { $regex: escapedSearch, $options: 'i' } },
            { sku: { $regex: escapedSearch, $options: 'i' } },
            { branchName: { $regex: escapedSearch, $options: 'i' } }
          ]
        }
      });
    }

    // Sort: Critical first, then stock ascending
    pipeline.push({ $sort: { stock: 1, productName: 1 } });

    // Pagination
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limitNum }]
      }
    });

    const result = await Product.aggregate(pipeline);
    const total = result[0]?.metadata[0]?.total || 0;
    const data = result[0]?.data || [];

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: parseInt(page),
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Helper: Parse Excel Buffer ───────────────────────────────────────────────
// ─── Helper: Normalize Excel header keys ─────────────────────────────────────
const BULK_HEADER_ALIASES = {
  name: ['name', 'product', 'productname', 'product_name', 'item', 'itemname', 'item_name'],
  category: ['category', 'cat', 'categoryname', 'category_name'],
  subcategory: ['subcategory', 'sub_category', 'subcat'],
  brandname: ['brandname', 'brand', 'brand_name'],
  baseprice: ['baseprice', 'base_price', 'price', 'sellingprice', 'selling_price', 'sp'],
  mrp: ['mrp', 'maxretailprice', 'max_retail_price', 'retailprice'],
  unittype: ['unittype', 'unit_type', 'unit', 'uom'],
  unitvalue: ['unitvalue', 'unit_value', 'size', 'packsize', 'pack_size'],
  description: ['description', 'desc', 'details'],
  tags: ['tags', 'tag', 'keywords'],
  sku: ['sku', 'code', 'productsku', 'product_sku', 'itemcode', 'item_code'],
  stock: ['stock', 'qty', 'quantity', 'inventory', 'stockqty', 'stock_qty'],
  status: ['status', 'productstatus', 'product_status'],
  image: ['image', 'imageurl', 'image_url', 'img', 'photo'],
  isveg: ['isveg', 'is_veg', 'veg'],
  displayorder: ['displayorder', 'display_order', 'sequence', 'sortorder', 'sort_order', 'order', 'position', 'rank'],
};

const normalizeHeaderKey = (key) =>
  String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '');

const canonicalBulkKey = (rawKey) => {
  const normalized = normalizeHeaderKey(rawKey);
  for (const [canonical, aliases] of Object.entries(BULK_HEADER_ALIASES)) {
    if (aliases.includes(normalized) || canonical === normalized) return canonical === 'subcategory' ? 'subCategory'
      : canonical === 'brandname' ? 'brandName'
      : canonical === 'baseprice' ? 'basePrice'
      : canonical === 'unittype' ? 'unitType'
      : canonical === 'unitvalue' ? 'unitValue'
      : canonical === 'isveg' ? 'isVeg'
      : canonical === 'displayorder' ? 'displayOrder'
      : canonical;
  }
  return null;
};

const normalizeBulkRow = (rawRow) => {
  const row = {};
  for (const [key, value] of Object.entries(rawRow || {})) {
    const canonical = canonicalBulkKey(key);
    if (!canonical) continue;
    // Prefer first non-empty value if duplicate headers map to same field
    if (row[canonical] === undefined || row[canonical] === null || row[canonical] === '') {
      row[canonical] = typeof value === 'string' ? value.trim() : value;
    }
  }
  return row;
};

const isBlankBulkRow = (row) => {
  const keys = ['name', 'category', 'basePrice', 'mrp', 'sku', 'description', 'brandName'];
  return keys.every((k) => row[k] === undefined || row[k] === null || row[k] === '');
};

const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';

// ─── Helper: Parse Excel Buffer ───────────────────────────────────────────────
const parseExcelBuffer = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return rawRows.map(normalizeBulkRow);
  } catch (err) {
    console.error('Excel parse error:', err);
    return [];
  }
};

const parseBulkTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  return String(tags).split(/[|,]/).map((t) => t.trim()).filter(Boolean);
};

const processBulkProductRows = async (rows, adminId, { rowLabel = (i) => `Row ${i + 2}` } = {}) => {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = rowLabel(i);

    try {
      if (isBlankBulkRow(row)) {
        continue;
      }

      const missing = [];
      if (!hasValue(row.name)) missing.push('name');
      if (!hasValue(row.category)) missing.push('category');
      if (!hasValue(row.basePrice) && row.basePrice !== 0) missing.push('basePrice');
      if (!hasValue(row.mrp) && row.mrp !== 0) missing.push('mrp');
      if (missing.length) {
        errors.push(`${label}: Missing required fields (${missing.join(', ')})`);
        skipped++;
        continue;
      }

      const sku = row.sku || `SAATHI-${String(row.name).substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const productData = {
        name: String(row.name).trim(),
        category: String(row.category).trim(),
        subCategory: row.subCategory || '',
        brandName: row.brandName || '',
        basePrice: Number(row.basePrice) || 0,
        mrp: Number(row.mrp) || Number(row.basePrice) || 0,
        unitType: (() => {
          const raw = (row.unitType || 'pcs').toString().toLowerCase().trim();
          const map = { g: 'gm', gram: 'gm', grams: 'gm', litre: 'ltr', liter: 'ltr', liters: 'ltr', litres: 'ltr', piece: 'pcs', pieces: 'pcs', packet: 'pkt', packets: 'pkt' };
          return map[raw] || raw;
        })(),
        unitValue: Number(row.unitValue) || 1,
        description: row.description || `${row.name} - Quality product`,
        tags: parseBulkTags(row.tags),
        sku: String(sku).trim(),
        stock: Number(row.stock) || 0,
        status: (() => {
          const raw = (row.status || 'Active').toString().toLowerCase().trim();
          const statusMap = {
            active: 'Active',
            draft: 'Draft',
            'out of stock': 'Out of Stock',
            'low stock': 'Low Stock',
            'pending approval': 'Pending Approval',
            rejected: 'Rejected'
          };
          return statusMap[raw] || 'Active';
        })(),
        isVeg: row.isVeg === 'false' || row.isVeg === false ? false : true,
        displayOrder: (() => {
          if (row.displayOrder !== undefined && row.displayOrder !== null && String(row.displayOrder).trim() !== '') {
            const num = Number(row.displayOrder);
            return Number.isFinite(num) && num >= 0 ? num : null;
          }
          return null;
        })(),
        branchStocks: [],
        isAllBranches: false,
        createdBy: adminId,
      };

      const existing = await Product.findOne({ sku: productData.sku });

      if (existing) {
        const updateSet = {
          name: productData.name,
          basePrice: productData.basePrice,
          mrp: productData.mrp,
          description: productData.description,
          tags: productData.tags,
          unitType: productData.unitType,
          unitValue: productData.unitValue,
          stock: productData.stock,
          status: productData.status,
        };
        if (productData.displayOrder !== null) {
          updateSet.displayOrder = productData.displayOrder;
        }
        // If Excel provides an image, use it; if product has no image yet, set SG logo default
        const rowImage = (row.image || '').toString().trim();
        if (rowImage) {
          updateSet.image = rowImage;
        } else if (!existing.image) {
          updateSet.image = getDefaultProductImageUrl();
        }
        await Product.findByIdAndUpdate(existing._id, { $set: updateSet });
        updated++;
      } else {
        const nameExists = await Product.findOne({ name: new RegExp(`^${productData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), sku: { $ne: productData.sku } });
        if (nameExists) {
          errors.push(`${label}: Product "${productData.name}" already exists with different SKU`);
          skipped++;
          continue;
        }

        const qrCodeDataUrl = await QRCode.toDataURL(productData.sku, { margin: 1 }).catch(() => '');
        const imageUrl = (row.image || '').toString().trim() || getDefaultProductImageUrl();
        await Product.create({
          ...productData,
          image: imageUrl,
          qrCode: qrCodeDataUrl,
        });
        created++;
      }
    } catch (rowErr) {
      let msg = rowErr.message;
      if (rowErr.name === 'ValidationError' && rowErr.errors) {
        msg = Object.values(rowErr.errors).map((e) => e.message).join('; ');
      }
      errors.push(`${label}: ${msg}`);
      skipped++;
    }
  }

  return {
    created,
    updated,
    skipped,
    total: rows.length,
    errors: errors.slice(0, 20)
  };
};

// @desc   Bulk upload products from Excel
// @route  POST /api/admin/products/bulk-upload
// @access Private (Admin only)
export const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No Excel file uploaded' });
    }

    const rows = parseExcelBuffer(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Excel is empty or has no valid rows' });
    }

    const result = await processBulkProductRows(rows, req.admin._id);

    res.json({
      message: 'Bulk upload completed',
      ...result
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Bulk upload products from JSON
// @route  POST /api/admin/products/bulk-json
// @access Private (Admin only)
export const bulkUploadProductsJson = async (req, res) => {
  try {
    const payload = req.body?.products ?? req.body;
    if (!Array.isArray(payload)) {
      return res.status(400).json({ message: 'JSON body must be an array of products or { products: [...] }' });
    }

    if (payload.length === 0) {
      return res.status(400).json({ message: 'No products provided in JSON' });
    }

    const rows = payload.map((item) => normalizeBulkRow(item));

    const result = await processBulkProductRows(rows, req.admin._id, {
      rowLabel: (i) => `Item ${i + 1}`
    });

    res.json({
      message: 'JSON bulk upload completed',
      ...result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Bulk reorder products
// @route   PUT /api/admin/products/reorder
// @access  Private (Admin / Store Manager with MANAGE_PRODUCTS)
export const bulkReorderProducts = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Request body must contain a non-empty items array: [{ id, displayOrder }]' });
    }

    const assignedPositions = new Set();
    const operations = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || !item.id) {
        return res.status(400).json({ message: `Item at index ${i} is missing product ID.` });
      }

      if (!mongoose.Types.ObjectId.isValid(item.id)) {
        return res.status(400).json({ message: `Item at index ${i} has an invalid product ID: ${item.id}` });
      }

      let parsedOrder = null;
      if (item.displayOrder !== undefined && item.displayOrder !== null && String(item.displayOrder).trim() !== '') {
        const num = Number(item.displayOrder);
        if (!Number.isFinite(num) || num < 0) {
          return res.status(400).json({ message: `Item with ID ${item.id} has an invalid displayOrder: must be a non-negative number or null.` });
        }
        if (assignedPositions.has(num)) {
          return res.status(400).json({ message: `Duplicate displayOrder position ${num} found in reorder payload.` });
        }
        assignedPositions.add(num);
        parsedOrder = num;
      }

      const opFilter = { _id: item.id };
      if (req.admin && req.admin.role !== 'Admin' && req.admin.branchId) {
        opFilter['branchStocks.branchId'] = req.admin.branchId;
      } else if (req.vendor) {
        opFilter.vendor = req.vendor._id;
      }

      operations.push({
        updateOne: {
          filter: opFilter,
          update: { $set: { displayOrder: parsedOrder } }
        }
      });
    }

    // Atomic pre-validation: verify all products exist and are within user's authorization scope
    const itemIds = items.map(it => it.id);
    const scopeFilter = { _id: { $in: itemIds } };
    if (req.admin && req.admin.role !== 'Admin' && req.admin.branchId) {
      scopeFilter['branchStocks.branchId'] = req.admin.branchId;
    } else if (req.vendor) {
      scopeFilter.vendor = req.vendor._id;
    }

    const matchingProducts = await Product.find(scopeFilter).select('_id').lean();
    const matchingIdSet = new Set(matchingProducts.map(p => String(p._id)));
    const missingIds = itemIds.filter(id => !matchingIdSet.has(String(id)));

    if (missingIds.length > 0) {
      return res.status(404).json({
        message: 'Reorder rejected: some products were not found or you do not have permission to modify them.',
        missingIds,
        matchedCount: matchingProducts.length,
        totalRequested: items.length
      });
    }

    const result = await Product.bulkWrite(operations);

    res.json({
      success: true,
      message: 'Product ordering updated successfully',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reorder products: ' + error.message });
  }
};
