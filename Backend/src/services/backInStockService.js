import Product from '../models/Product.js';
import Branch from '../models/Branch.js';
import Vendor from '../models/Vendor.js';
import Notification from '../models/Notification.js';
import BackInStockSubscription from '../models/BackInStockSubscription.js';
import { sendPushNotification } from './notificationService.js';

export const stockForSubscription = (product, { storeId, storeType, variantValue = '' }) => {
  if (!product || product.status === 'Draft' || product.status === 'Inactive') return 0;
  let stock = 0;
  if (storeType === 'vendor') {
    if (String(product.vendor?._id || product.vendor) !== String(storeId)) return 0;
    stock = Number(product.stock) || 0;
  } else if (storeType === 'branch') {
    const branchStock = product.branchStocks?.find(item => String(item.branchId?._id || item.branchId) === String(storeId));
    stock = branchStock ? Number(branchStock.stock) || 0 : product.vendor ? Number(product.stock) || 0 : 0;
  }
  if (variantValue) {
    const variant = product.variants?.find(item => item.value === variantValue);
    stock = Math.min(stock, Number(variant?.stock) || 0);
  }
  return Math.max(0, stock);
};

export const storeIsActive = async ({ storeId, storeType }) => {
  if (storeType === 'vendor') return Boolean(await Vendor.exists({ _id: storeId, status: 'Active' }));
  if (storeType === 'branch') return Boolean(await Branch.exists({ _id: storeId, isActive: true }));
  return false;
};

let scanRunning = false;
export const sendBackInStockNotifications = async () => {
  if (scanRunning) return;
  scanRunning = true;
  try {
    const expiredClaim = new Date(Date.now() - 5 * 60 * 1000);
    const subscriptions = BackInStockSubscription.find({
      $or: [{ status: 'pending' }, { status: 'processing', claimedAt: { $lt: expiredClaim } }]
    }).sort({ createdAt: 1 }).lean().cursor();

    for await (const subscription of subscriptions) {
      try {
      const [product, activeStore] = await Promise.all([
        Product.findById(subscription.product).lean(),
        storeIsActive(subscription)
      ]);
      if (!product) {
        await BackInStockSubscription.deleteOne({ _id: subscription._id });
        continue;
      }
      if (!activeStore || stockForSubscription(product, subscription) <= 0) continue;
      const claimFilter = subscription.status === 'pending'
        ? { _id: subscription._id, status: 'pending' }
        : { _id: subscription._id, status: 'processing', claimedAt: subscription.claimedAt };
      const claimed = await BackInStockSubscription.findOneAndUpdate(
        claimFilter,
        { $set: { status: 'processing', claimedAt: new Date() } },
        { new: true }
      );
      if (!claimed) continue;

      const name = subscription.variantValue ? `${product.name} (${subscription.variantValue})` : product.name;
      const data = { type: 'back_in_stock', productId: String(product._id), storeId: String(subscription.storeId), storeType: subscription.storeType };
      const notification = {
        title: `${name} is back in stock`,
        body: `${name} is available for purchase now.`
      };
      // Save in-app history even when the customer has no FCM token.
      await Notification.updateOne(
        { sourceKey: `back-in-stock:${subscription._id}` },
        { $setOnInsert: { ...notification, sourceKey: `back-in-stock:${subscription._id}`, recipient: subscription.user, recipientModel: 'User', type: 'back_in_stock', data } },
        { upsert: true }
      );
      await sendPushNotification(subscription.user, 'User', notification, data, true);
      // A future stockout can create a fresh subscription and notification.
      await BackInStockSubscription.deleteOne({ _id: subscription._id, status: 'processing' });
      } catch (error) {
        console.error('[BACK-IN-STOCK] Notification failed:', error);
        await BackInStockSubscription.updateOne({ _id: subscription._id, status: 'processing' }, { $set: { status: 'pending' }, $unset: { claimedAt: '' } });
      }
    }
  } finally {
    scanRunning = false;
  }
};
