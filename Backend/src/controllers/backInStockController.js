import mongoose from 'mongoose';
import Product from '../models/Product.js';
import BackInStockSubscription from '../models/BackInStockSubscription.js';
import { stockForSubscription, storeIsActive } from '../services/backInStockService.js';

const parseRequest = (req) => {
  const storeId = req.body?.storeId || req.query?.storeId;
  const storeType = req.body?.storeType || req.query?.storeType;
  const variantValue = String(req.body?.variantValue || req.query?.variantValue || '').trim().slice(0, 100);
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(storeId) || !['branch', 'vendor'].includes(storeType)) return null;
  return { storeId, storeType, variantValue };
};

export const getBackInStockSubscription = async (req, res) => {
  const scope = parseRequest(req);
  if (!scope) return res.status(400).json({ message: 'Valid product and store are required' });
  const subscription = await BackInStockSubscription.findOne({ user: req.user._id, product: req.params.id, ...scope, status: 'pending' }).select('_id').lean();
  return res.json({ subscribed: Boolean(subscription) });
};

export const subscribeBackInStock = async (req, res) => {
  try {
    const scope = parseRequest(req);
    if (!scope) return res.status(400).json({ message: 'Valid product and store are required' });
    const product = await Product.findById(req.params.id).select('name vendor branchStocks stock variants status isAllBranches');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!await storeIsActive(scope)) return res.status(400).json({ message: 'Store is unavailable' });
    if (scope.variantValue && !product.variants?.some(item => item.value === scope.variantValue)) {
      return res.status(400).json({ message: 'Product variant not found' });
    }
    if (scope.storeType === 'vendor' && String(product.vendor) !== String(scope.storeId)) {
      return res.status(400).json({ message: 'Product is not sold by this store' });
    }
    if (scope.storeType === 'branch' && !product.vendor && !product.isAllBranches && !product.branchStocks?.some(item => String(item.branchId) === String(scope.storeId))) {
      return res.status(400).json({ message: 'Product is not sold by this store' });
    }
    if (stockForSubscription(product, scope) > 0) {
      return res.status(409).json({ message: 'This product is already in stock' });
    }
    const identity = { user: req.user._id, product: product._id, ...scope };
    await BackInStockSubscription.findOneAndUpdate(identity, {
      $setOnInsert: { ...identity, status: 'pending' }
    }, { upsert: true, new: true });
    return res.json({ subscribed: true });
  } catch (error) {
    if (error.code === 11000) return res.json({ subscribed: true });
    return res.status(500).json({ message: 'Could not save stock alert' });
  }
};

export const unsubscribeBackInStock = async (req, res) => {
  const scope = parseRequest(req);
  if (!scope) return res.status(400).json({ message: 'Valid product and store are required' });
  await BackInStockSubscription.deleteOne({ user: req.user._id, product: req.params.id, ...scope, status: 'pending' });
  return res.json({ subscribed: false });
};
