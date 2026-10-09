import OfferDeal from '../models/OfferDeal.js';
import Product from '../models/Product.js';
import { notifyAllUsers } from '../services/notificationService.js';

// @desc    Get all offer deals
// @route   GET /api/admin/offers
export const getOfferDeals = async (req, res) => {
  try {
    let query = {};
    if (req.vendor) {
      query.vendor = req.vendor._id;
    }
    // If Admin (no req.vendor), query remains empty to see ALL offers
    const offers = await OfferDeal.find(query)
      .populate('products.productId', 'name image basePrice mrp sku variants subCategory')
      .sort({ displayOrder: 1, createdAt: -1 });
    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get offer deal by ID
export const getOfferDealById = async (req, res) => {
  try {
    const offer = await OfferDeal.findById(req.params.id)
      .populate('products.productId', 'name image basePrice mrp sku variants subCategory');
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    res.json(offer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new offer deal
export const createOfferDeal = async (req, res) => {
  try {
    const { title, subtitle, description, bgColor, textColor, accentColor, products, expiryDate, displayLocation, displayOrder, discountPercentage, animationType, backgroundEffect } = req.body;

    let parsedProducts = products;
    if (typeof products === 'string') {
      try {
        parsedProducts = JSON.parse(products);
      } catch (e) {
        parsedProducts = [];
      }
    }

    if (expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(expiryDate) <= today) {
        return res.status(400).json({ message: 'Expiry date must be in the future' });
      }
    }

    if (parsedProducts && parsedProducts.length > 0) {
      for (const p of parsedProducts) {
        if (p.basePrice !== undefined) {
          await Product.findByIdAndUpdate(p.productId, { basePrice: p.basePrice });
        }
      }
    }

    const offer = await OfferDeal.create({
      title,
      subtitle,
      description,
      bgColor,
      textColor,
      accentColor,
      products: parsedProducts,
      expiryDate,
      displayLocation,
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      discountPercentage: discountPercentage || 0,
      animationType: animationType || 'Default',
      backgroundEffect: backgroundEffect || 'None',
      bannerImage: req.file ? req.file.path : '',
      vendor: req.vendor ? req.vendor._id : null
    });

    // Notify users about new Offer/Deal
    if (offer.isActive) {
      notifyAllUsers({
        title: `🔥 New Deal: ${offer.title}`,
        body: offer.subtitle || 'Flash sale! Grab your favorites before they are gone.'
      }, { offerId: offer._id.toString(), type: 'offer' });
    }

    const populatedOffer = await offer.populate('products.productId', 'name image basePrice mrp sku variants subCategory');
    res.status(201).json(populatedOffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an offer deal
export const updateOfferDeal = async (req, res) => {
  try {
    const offer = await OfferDeal.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer deal not found' });
    }

    if (req.vendor && offer.vendor?.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this offer' });
    }

    // Admin cannot edit vendor deals (only vendors can edit their own)
    if (req.admin && offer.vendor) {
      return res.status(403).json({ message: 'Admin can only delete vendor deals, not edit them' });
    }

    const { title, subtitle, description, bgColor, textColor, accentColor, products, isActive, expiryDate, displayLocation, displayOrder, discountPercentage, animationType, backgroundEffect } = req.body;

    offer.title = title || offer.title;
    offer.subtitle = subtitle !== undefined ? subtitle : offer.subtitle;
    offer.description = description !== undefined ? description : offer.description;
    offer.bgColor = bgColor || offer.bgColor;
    offer.textColor = textColor || offer.textColor;
    offer.accentColor = accentColor || offer.accentColor;
    offer.isActive = isActive !== undefined ? isActive : offer.isActive;

    // Notify if becoming active
    const isNowActive = isActive === true || isActive === 'true';
    if (!offer.isActive && isNowActive) {
      notifyAllUsers({
        title: `🎇 ${offer.title} is now Live!`,
        body: offer.subtitle || 'Check out our latest flash deals.'
      }, { offerId: offer._id.toString(), type: 'offer' });
    }


    offer.expiryDate = expiryDate || offer.expiryDate;

    if (expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(expiryDate) <= today) {
        return res.status(400).json({ message: 'Expiry date must be in the future' });
      }
    }
    
    offer.displayLocation = displayLocation || offer.displayLocation;
    offer.displayOrder = displayOrder !== undefined ? Number(displayOrder) : offer.displayOrder;
    offer.discountPercentage = discountPercentage !== undefined ? discountPercentage : offer.discountPercentage;
    offer.animationType = animationType !== undefined ? animationType : offer.animationType;
    offer.backgroundEffect = backgroundEffect !== undefined ? backgroundEffect : offer.backgroundEffect;

    if (products) {
      const parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;
      offer.products = parsedProducts;

      if (parsedProducts && parsedProducts.length > 0) {
        for (const p of parsedProducts) {
          if (p.basePrice !== undefined) {
            await Product.findByIdAndUpdate(p.productId, { basePrice: p.basePrice });
          }
        }
      }
    }

    if (req.file) {
      offer.bannerImage = req.file.path;
    }

    await offer.save();
    const updated = await OfferDeal.findById(offer._id).populate('products.productId', 'name image basePrice mrp sku variants subCategory');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an offer deal
export const deleteOfferDeal = async (req, res) => {
  try {
    const offer = await OfferDeal.findById(req.params.id);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    if (req.vendor && offer.vendor?.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this offer' });
    }

    await offer.deleteOne();
    res.json({ message: 'Offer removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active offer deals for public (User app home screen + store pages)
export const getActiveOfferDeals = async (req, res) => {
  try {
    const { storeId, storeType } = req.query;
    const now = new Date();

    // Fetch ALL active offers (admin + all vendors) to show on home screen
    // Only show offers that are isActive AND (no expiry date OR expiry date in future)
    const result = await OfferDeal.aggregate([
      { 
        $match: { 
          isActive: true,
          $or: [
            { expiryDate: { $gt: now } },
            { expiryDate: { $exists: false } },
            { expiryDate: null }
          ]
        } 
      },
      { $addFields: { totalProducts: { $size: "$products" } } },
      { $sort: { displayOrder: 1, createdAt: -1 } },
      {
        $project: {
          title: 1, subtitle: 1, description: 1, bgColor: 1, textColor: 1, accentColor: 1,
          bannerImage: 1, isActive: 1, expiryDate: 1, displayLocation: 1,
          discountPercentage: 1, animationType: 1, backgroundEffect: 1, totalProducts: 1,
          products: { $slice: ["$products", 10] }
        }
      }
    ]);

    // Manually populate the sliced products since populate() doesn't work directly on aggregate result objects easily without more stages
    const offers = await OfferDeal.populate(result, {
      path: 'products.productId',
      select: 'name image basePrice mrp sku unitType unitValue status isVeg branchStocks vendor stock lowStockThreshold variants category subCategory'
    });

    // Decorate each product with isDeliverable flag when store context is provided
    if (storeId && storeType) {
      // Allow offers that have a bannerImage OR at least 1 product (banner-only offers should still show)
      const formattedOffers = offers.map(offer => {
        const offerObj = offer;
        offerObj.products = (offerObj.products || []).map(cp => {
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
        return offerObj;
      }).filter(offer => offer.bannerImage || (offer.products && offer.products.length > 0));
      return res.json(formattedOffers);
    }

    // Allow banner-only offers (with bannerImage but no products) to show on user side
    const filteredOffers = offers.filter(offer => offer.bannerImage || (offer.products && offer.products.length > 0));
    res.json(filteredOffers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

};

// @desc    Get offer products with pagination (Public)
// @route   GET /api/admin/offers/public/:id/products
export const getOfferProducts = async (req, res) => {
  try {
    const { page = 1, limit = 12, storeId, storeType } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const now = new Date();
    const offer = await OfferDeal.findOne({
      _id: req.params.id,
      isActive: true,
      $or: [
        { expiryDate: { $gt: now } },
        { expiryDate: { $exists: false } },
        { expiryDate: null }
      ]
    })
      .slice('products', [(pageNum - 1) * limitNum, limitNum])
      .populate('products.productId', 'name image basePrice mrp sku unitType unitValue status isVeg branchStocks vendor category subCategory stock lowStockThreshold variants');

    if (!offer) return res.status(404).json({ message: 'Offer not found or expired' });

    // Inject store context if available
    let products = offer.products || [];
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
      hasMore: (offer.products?.length || 0) === limitNum
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
