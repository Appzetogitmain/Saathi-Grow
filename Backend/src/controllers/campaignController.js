import mongoose from 'mongoose';
import CampaignSection from '../models/CampaignSection.js';
import Product from '../models/Product.js';
import { notifyAllUsers } from '../services/notificationService.js';

// @desc    Get all campaign sections
// @route   GET /api/admin/campaigns
// @access  Private (Admin/Staff)
export const getCampaignSections = async (req, res) => {
  try {
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const includeMeta = req.query.includeMeta === 'true';
    const pageNumber = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const listQuery = CampaignSection.find()
      .select('title subtitle highlightText displayType bgColor textColor accentColor isActive bannerImage products vendor')
      .populate('products.productId', 'name image basePrice mrp sku variants subCategory')
      .sort('-createdAt')
      .lean();

    if (hasPagination) {
      const total = await CampaignSection.countDocuments();
      const sections = await listQuery
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(pageNumber));
      res.set('X-Limit', String(limitNumber));
      res.set('X-Total-Pages', String(Math.ceil(total / limitNumber) || 1));
      if (includeMeta) {
        return res.json({
          success: true,
          sections,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber) || 1
          }
        });
      }
      return res.json(sections);
    }

    const sections = await listQuery;
    if (includeMeta) {
      return res.json({ success: true, sections });
    }
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get campaign section by ID
// @route   GET /api/admin/campaigns/:id
// @access  Private (Admin/Staff)
export const getCampaignById = async (req, res) => {
  try {
    const section = await CampaignSection.findById(req.params.id)
      .populate('products.productId', 'name image basePrice mrp sku variants subCategory')
      .lean();
    if (!section) return res.status(404).json({ message: 'Campaign not found' });
    res.json(section);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active campaign sections for frontend
// @route   GET /api/admin/campaigns/public  (served under /api/admin/campaigns)
// @access  Public
export const getActiveCampaignSections = async (req, res) => {
  try {
    const sections = await CampaignSection.find({ isActive: true }, {
      // Return all fields except products, which we slice
      title: 1,
      subtitle: 1,
      highlightText: 1,
      displayType: 1,
      bgColor: 1,
      textColor: 1,
      accentColor: 1,
      isActive: 1,
      bannerImage: 1,
      products: 1
    })
      .populate('products.productId', 'name image basePrice mrp unitType unitValue category subCategory status isSaathigro branchStocks vendor stock lowStockThreshold variants')
      .sort('-createdAt')
      .lean();

    // Inject isDeliverable if store context provided
    const { storeId, storeType } = req.query;

    // Also send total product count per section to help frontend pagination
    const counts = await CampaignSection.aggregate([
      { $match: { isActive: true } },
      { $project: { totalProducts: { $size: '$products' } } }
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c.totalProducts || 0]));

    const sectionsWithCount = sections.map((s) => {
      const sectionObj = { ...s };

      if (storeId && storeType) {
        sectionObj.products = sectionObj.products.map(cp => {
          if (!cp.productId) return cp;

          let isDeliverable = false;
          let availableStock = 0;
          let lowStockThreshold = 10;
          let inStore = false;
          const pObj = cp.productId;

          if (storeType === 'branch') {
            const branchStock = pObj.branchStocks?.find(bs => {
              const bId = bs.branchId?._id || bs.branchId;
              return bId && bId.toString() === storeId.toString();
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
            }
          } else if (storeType === 'vendor') {
            const vId = pObj.vendor?._id || pObj.vendor;
            if (vId && vId.toString() === storeId.toString()) {
              inStore = true;
              availableStock = pObj.stock || 0;
              lowStockThreshold = pObj.lowStockThreshold || 10;
              if (availableStock > 0) {
                isDeliverable = true;
              }
            }
          }

          cp.productId.isDeliverable = isDeliverable;
          cp.productId.availableStock = availableStock;
          cp.productId.lowStockThreshold = lowStockThreshold;
          cp.productId.inStore = inStore;
          return cp;
        });
      }

      return {
        ...sectionObj,
        totalProducts: countById.get(String(sectionObj._id)) || 0
      };
    });

    const filteredSections = sectionsWithCount.filter(s => s.totalProducts > 0);
    res.json(filteredSections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get public campaign metadata by ID
// @route   GET /api/admin/campaigns/public/:id
// @access  Public
export const getCampaignMetadata = async (req, res) => {
  try {
    const campaignId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const campaign = await CampaignSection.findOne({ _id: campaignId, isActive: true })
      .select('title subtitle highlightText displayType bgColor textColor accentColor bannerImage isActive products')
      .populate('products.productId', 'category subCategory')
      .lean();

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Extract unique subcategories and categories present in this campaign
    const subCategoriesSet = new Set();
    const categoriesSet = new Set();
    (campaign.products || []).forEach(cp => {
      const p = cp.productId;
      if (p) {
        if (p.subCategory && typeof p.subCategory === 'string' && p.subCategory.trim()) {
          subCategoriesSet.add(p.subCategory.trim());
        }
        if (p.category && typeof p.category === 'string' && p.category.trim()) {
          categoriesSet.add(p.category.trim());
        }
      }
    });

    const subCategories = Array.from(subCategoriesSet);
    const categories = Array.from(categoriesSet);

    res.json({
      _id: campaign._id,
      title: campaign.title,
      subtitle: campaign.subtitle,
      highlightText: campaign.highlightText,
      displayType: campaign.displayType,
      bgColor: campaign.bgColor,
      textColor: campaign.textColor,
      accentColor: campaign.accentColor,
      bannerImage: campaign.bannerImage,
      isActive: campaign.isActive,
      totalProducts: (campaign.products || []).length,
      subCategories,
      categories
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Create a new campaign section
// @route   POST /api/admin/campaigns
// @access  Private (Admin)
export const createCampaignSection = async (req, res) => {
  try {
    const { title, subtitle, highlightText, bgColor, textColor, accentColor, products, displayType } = req.body;

    let parsedProducts = products;
    if (typeof products === 'string') {
      try {
        parsedProducts = JSON.parse(products);
      } catch (e) {
        parsedProducts = [];
      }
    }

    if (parsedProducts && parsedProducts.length > 0) {
      const productUpdates = parsedProducts
        .filter((p) => p && p.productId && p.basePrice !== undefined)
        .map((p) => ({
          updateOne: {
            filter: { _id: p.productId },
            update: { $set: { basePrice: p.basePrice } }
          }
        }));

      if (productUpdates.length > 0) {
        await Product.bulkWrite(productUpdates);
      }
    }

    const section = await CampaignSection.create({
      title,
      subtitle,
      highlightText,
      bgColor,
      textColor,
      accentColor,
      displayType: displayType || 'festive',
      products: parsedProducts,
      bannerImage: req.file ? req.file.path : ''
    });

    // Notify all users about New Festive Campaign
    if (section.isActive) {
      notifyAllUsers({
        title: `🎁 ${section.title}`,
        body: section.highlightText || section.subtitle || 'Check out our latest offers!'
      }, { campaignId: section._id.toString(), type: 'campaign' });
    }

    const populatedSection = await section.populate('products.productId', 'name image basePrice mrp sku');
    res.status(201).json(populatedSection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a campaign section
// @route   PUT /api/admin/campaigns/:id
// @access  Private (Admin)
export const updateCampaignSection = async (req, res) => {
  try {
    const section = await CampaignSection.findById(req.params.id);

    if (!section) {
      return res.status(404).json({ message: 'Campaign section not found' });
    }

    // Admin cannot edit vendor campaigns (only vendors can edit their own)
    if (req.admin && section.vendor) {
      return res.status(403).json({ message: 'Admin can only delete vendor campaigns, not edit them' });
    }

    const { title, subtitle, highlightText, bgColor, textColor, accentColor, products, isActive, displayType } = req.body;

    section.title = title || section.title;
    section.subtitle = subtitle !== undefined ? subtitle : section.subtitle;
    section.highlightText = highlightText || section.highlightText;
    section.bgColor = bgColor || section.bgColor;
    section.textColor = textColor || section.textColor;
    section.accentColor = accentColor || section.accentColor;
    section.isActive = isActive !== undefined ? isActive : section.isActive;
    
    // Notify if becoming active
    const wasActive = section.isActive;
    const isNowActive = isActive === true || isActive === 'true';
    if (!wasActive && isNowActive) {
      notifyAllUsers({
        title: `🎊 ${section.title} is now Live!`,
        body: section.highlightText || section.subtitle || 'Don\'t miss out on amazing deals.'
      }, { campaignId: section._id.toString(), type: 'campaign' });
    }
    

    if (displayType) section.displayType = displayType;

    if (products) {
      const parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;
      section.products = parsedProducts;

      if (parsedProducts && parsedProducts.length > 0) {
        const productUpdates = parsedProducts
          .filter((p) => p && p.productId && p.basePrice !== undefined)
          .map((p) => ({
            updateOne: {
              filter: { _id: p.productId },
              update: { $set: { basePrice: p.basePrice } }
            }
          }));

        if (productUpdates.length > 0) {
          await Product.bulkWrite(productUpdates);
        }
      }
    }

    if (req.file) {
      section.bannerImage = req.file.path;
    }

    await section.save();
    const updated = await CampaignSection.findById(section._id).populate('products.productId', 'name image basePrice mrp sku');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a campaign section
// @route   DELETE /api/admin/campaigns/:id
// @access  Private (Admin)
export const deleteCampaignSection = async (req, res) => {
  try {
    const section = await CampaignSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }
    await section.deleteOne();
    res.json({ message: 'Section removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get campaign products with pagination (Public)
// @route   GET /api/admin/campaigns/public/:id/products
export const getCampaignProducts = async (req, res) => {
  try {
    const { page = 1, limit = 12, storeId, storeType } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const section = await CampaignSection.findById(req.params.id)
      .slice('products', [(pageNum - 1) * limitNum, limitNum])
      .populate('products.productId', 'name image basePrice mrp sku unitType unitValue category subCategory status isVeg branchStocks vendor stock lowStockThreshold variants');

    if (!section) return res.status(404).json({ message: 'Campaign not found' });

    // Inject store context
    let products = section.products || [];
    if (storeId && storeType) {
      products = products.map(cp => {
        if (!cp.productId) return cp;
        const pObj = cp.productId;
        let isDeliverable = false;
        let availableStock = 0;
        
        if (storeType === 'branch') {
          const bs = pObj.branchStocks?.find(s => (s.branchId?._id || s.branchId)?.toString() === storeId.toString());
          if (bs) {
            if (bs.stock > 0) isDeliverable = true;
            availableStock = bs.stock || 0;
          } else if (pObj.vendor) {
            if (pObj.stock > 0) isDeliverable = true;
            availableStock = pObj.stock || 0;
          }
        } else if (storeType === 'vendor') {
          if ((pObj.vendor?._id || pObj.vendor)?.toString() === storeId.toString() && pObj.stock > 0) isDeliverable = true;
          availableStock = pObj.stock || 0;
        }
        
        cp.productId.isDeliverable = isDeliverable;
        cp.productId.availableStock = availableStock;
        return cp;
      });
    }

    res.json({
      products: products.filter(p => p.productId),
      hasMore: (section.products?.length || 0) === limitNum
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
