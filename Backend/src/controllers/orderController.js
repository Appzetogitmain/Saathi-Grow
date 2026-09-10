import axios from 'axios';
import Order from '../models/Order.js';
import User from '../models/User.js';
import UserTransaction from '../models/UserTransaction.js';
import GlobalSetting from '../models/GlobalSetting.js';
import Product from '../models/Product.js';
import OrderDelivery from '../models/OrderDelivery.js';
import InventoryLog from '../models/InventoryLog.js';
import Branch from '../models/Branch.js';
import Vendor from '../models/Vendor.js';
import DeliverySlot from '../models/DeliverySlot.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';
import DeliveryPartner from '../models/DeliveryPartner.js';
import DeliveryRun from '../models/DeliveryRun.js';
import { findOptimalSource, geocodeAddress, calculateDistance } from '../services/locationService.js';
import PromoCode from '../models/PromoCode.js';
import PromoUsage from '../models/PromoUsage.js';
import { sendPushNotification, notifyByBranchAndPermission, notifySuperAdmins } from '../services/notificationService.js';
import { sendSystemNotificationEmail } from '../services/emailService.js';
import { buildRouteCacheKey, getCachedRoute, setCachedRoute } from '../services/routeCacheService.js';
import razorpayInstance, {
  PaymentVerificationError,
  fetchAndValidateRazorpayPayment,
  parseRupeesToPaise,
  verifyCheckoutSignature
} from '../services/razorpayVerificationService.js';
import { validateAndBuildDeliveryTiming } from '../services/deliveryTimingService.js';
import { assertPartnerCapacity } from '../services/deliveryCapacityService.js';
// import { triggerAutoAssignmentForOrder } from './adminDeliveryController.js';

/**
 * Enrich order items with physicalLocation from the product document.
 * This ensures receivers/pickers can locate products in the warehouse/store.
 */
export const enrichItemsWithLocations = async (items) => {
  return Promise.all(items.map(async (item) => {
    try {
      const productId = item.product?._id || item.product;
      const product = await Product.findById(productId).select('physicalLocation unitValue unitType').lean();
      const variantValue = item.selectedVariant?.value || '';
      const weight =
        item.weight ||
        variantValue ||
        (product?.unitValue != null
          ? `${product.unitValue} ${product.unitType || ''}`.trim()
          : '') ||
        null;

      return {
        ...item,
        weight,
        selectedVariant: item.selectedVariant?.value
          ? {
              type: item.selectedVariant.type || '',
              value: item.selectedVariant.value,
              price: item.selectedVariant.price,
              stock: item.selectedVariant.stock
            }
          : undefined,
        physicalLocation: product?.physicalLocation || item.physicalLocation || null
      };
    } catch (_) {
      return item;
    }
  }));
};

const validateStoreDistance = async (storeId, storeType, userLocation) => {
  if (!storeId || !userLocation || !userLocation.coordinates || userLocation.coordinates.length < 2) return true;

  try {
    let store;
    if (storeType === 'branch') {
      store = await Branch.findById(storeId);
    } else {
      store = await Vendor.findById(storeId);
    }

    if (!store || !store.address?.location?.coordinates) return true;

    const storeCoords = store.address.location.coordinates;
    const distance = calculateDistance(
      userLocation.coordinates[1], userLocation.coordinates[0],
      storeCoords[1], storeCoords[0]
    );

    // Per-store radius set by admin (fallback to global max)
    const settings = await GlobalSetting.findOne();
    const globalDefault = settings?.maxDeliveryRadius || 20;
    const configured = Number(store.deliveryRadius);
    const maxRadius = Number.isFinite(configured) && configured > 0 ? configured : globalDefault;

    if (distance > maxRadius) {
      throw new Error(`Store range validation failed. Distance: ${distance.toFixed(1)}km exceeds this store's ${maxRadius}km delivery area.`);
    }
  } catch (error) {
    throw error;
  }
  return true;
};

const resolveItemVariant = (product, item) => {
  const variantValue = item?.selectedVariant?.value;
  if (!variantValue) return null;
  const variants = product?.variants || [];
  return variants.find((v) => v?.value === variantValue) || null;
};

const validateStockAvailability = async (items, storeId, storeType) => {
  if (!items || items.length === 0) return true;

  for (const item of items) {
    const productId = item.product._id || item.product;
    const requestedQty = parseInt(item.quantity) || 0;
    
    const product = await Product.findById(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);

    const selectedVariant = resolveItemVariant(product, item);
    let availableStock = selectedVariant?.stock ?? 0;
    let threshold = 10; // Default threshold

    if (!selectedVariant && storeType === 'branch') {
      const branchStock = product.branchStocks?.find(bs => (bs.branchId?._id || bs.branchId)?.toString() === storeId?.toString());
      
      if (!branchStock) {
        if (product.vendor) {
          availableStock = product.stock || 0;
          threshold = product.lowStockThreshold || 10;
        } else if (product.isAllBranches) {
          // If available to all branches but not yet initialized for this branch, assume 0 stock
          availableStock = 0;
          threshold = product.lowStockThreshold || 10;
        } else {
          throw new Error(`Product ${product.name} is not available at the selected branch.`);
        }
      } else {
        availableStock = branchStock.stock || 0;
        threshold = branchStock.lowStockThreshold || 10;
      }
    } else if (!selectedVariant && storeType === 'vendor') {
      // For vendor, check if product belongs to this vendor
      if (product.vendor?.toString() !== storeId?.toString()) {
        throw new Error(`Product ${product.name} is not available at the selected vendor.`);
      }
      availableStock = product.stock || 0;
      threshold = product.lowStockThreshold || 10;
    } else if (!selectedVariant) {
      // Global fallback (if no store context, though unlikely in Store-First)
      availableStock = product.stock || 0;
      threshold = product.lowStockThreshold || 10;
    }

    const remaining = availableStock - requestedQty;
    if (availableStock <= 0) {
      throw new Error(`${product.name} is currently out of stock.`);
    }
    if (remaining < 0) {
      throw new Error(`Only ${availableStock} unit(s) of ${product.name} are currently available.`);
    }
  }
  return true;
};

export const computeBillDetails = async (items, options = {}) => {
  const { promoId = null, userId = null, orderSource = null, isImmediate = false } = options;
  let subTotal = 0;

  // Validate each item against the actual database to prevent frontend price manipulation
  for (const item of items) {
    const productId = item.product._id || item.product;
    const product = await Product.findById(productId);
    if (!product) throw new Error(`Product mapping failed for identifier: ${productId}`);

    const selectedVariant = resolveItemVariant(product, item);
    const verifiedPrice = selectedVariant?.price ?? product.basePrice ?? product.price ?? 0;
    subTotal += verifiedPrice * item.quantity;
  }

  // Get live global settings
  let settings = await GlobalSetting.findOne() || new GlobalSetting();

  const taxAmount = (subTotal * settings.defaultTaxRate) / 100;

  // Base standard delivery fee
  let baseDeliveryFee = settings.baseDeliveryFee * settings.surgeMultiplier;
  if (subTotal >= settings.freeDeliveryThreshold) {
    baseDeliveryFee = 0;
  }

  // Immediate delivery surcharge (Option A: remains applicable even if base fee is waived)
  let immediateDeliveryFee = 0;
  if (isImmediate === true && settings.immediateDeliveryEnabled === true && orderSource !== 'pos') {
    immediateDeliveryFee = Number(settings.immediateDeliveryFee) || 0;
  }

  // Combined delivery fee
  let deliveryFee = baseDeliveryFee + immediateDeliveryFee;
  let handlingFee = settings.handlingFee;

  // POS orders do not incur delivery or handling fees
  if (orderSource === 'pos') {
    baseDeliveryFee = 0;
    immediateDeliveryFee = 0;
    deliveryFee = 0;
    handlingFee = 0;
  }
  
  // Base total without discount
  let totalAmount = subTotal + taxAmount + deliveryFee + handlingFee;
  let discountAmount = 0;
  let appliedPromo = null;

  // Promo Calculation
  let targetPromoId = promoId;

  // If no promoId provided, look for Auto-Apply promos
  if (!targetPromoId && userId) {
      const now = new Date();
      const autoPromos = await PromoCode.find({
          isActive: true,
          isAutoApply: true,
          validFrom: { $lte: now },
          validUntil: { $gte: now },
          minOrderValue: { $lte: subTotal }
      }).sort({ discountValue: -1 }); // Sort by best discount (naive, but common)

      if (autoPromos.length > 0) {
          // Find the first one user is eligible for
          for (const ap of autoPromos) {
              const usage = await PromoUsage.findOne({ user: userId, promoCode: ap._id });
              if (!usage || usage.usageCount < ap.usageLimitPerUser) {
                  targetPromoId = ap._id;
                  break;
              }
          }
      }
  }

  if (targetPromoId) {
    const promo = await PromoCode.findById(targetPromoId);
    if (promo && promo.isActive) {
      const now = new Date();
      const fromDate = new Date(promo.validFrom);
      const untilDate = new Date(promo.validUntil);
      if (untilDate.getHours() === 0 && untilDate.getMinutes() === 0 && untilDate.getSeconds() === 0) {
        untilDate.setHours(23, 59, 59, 999);
      }
      if (now >= fromDate && now <= untilDate) {
        // Double check per-user limit if userId is provided
        let canApply = true;
        if (userId) {
          const usage = await PromoUsage.findOne({ user: userId, promoCode: promo._id });
          if (usage && usage.usageCount >= promo.usageLimitPerUser) {
            canApply = false;
          }
        }

        if (canApply && subTotal >= promo.minOrderValue) {
          if (promo.discountType === 'Percentage') {
            discountAmount = (subTotal * promo.discountValue) / 100;
            if (promo.maxDiscountAmount > 0 && discountAmount > promo.maxDiscountAmount) {
              discountAmount = promo.maxDiscountAmount;
            }
          } else if (promo.discountType === 'Fixed') {
            discountAmount = promo.discountValue;
          } else if (promo.discountType === 'FreeShipping') {
            discountAmount = baseDeliveryFee; // Option A: Discount waives only the base standard delivery fee
          }

          // Ensure discount doesn't exceed total
          discountAmount = Math.min(discountAmount, totalAmount);
          totalAmount -= discountAmount;
          appliedPromo = promo;
        }
      }
    }
  }

  // Vendor Commission logic (Note: Vendor payout is unaffected by promo)
  const platformCommission = (subTotal * settings.platformCommissionRate) / 100;
  const vendorPayoutAmount = (subTotal + taxAmount) - platformCommission;

  return {
    subTotal: parseFloat(subTotal.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    baseDeliveryFee: parseFloat(baseDeliveryFee.toFixed(2)),
    immediateDeliveryFee: parseFloat(immediateDeliveryFee.toFixed(2)),
    deliveryFee: parseFloat(deliveryFee.toFixed(2)),
    handlingFee: parseFloat(handlingFee.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    platformCommission: parseFloat(platformCommission.toFixed(2)),
    vendorPayoutAmount: parseFloat(vendorPayoutAmount.toFixed(2)),
    promoId: appliedPromo?._id || null,
    promoCode: appliedPromo?.code || null,
    freeGift: (appliedPromo?.discountType === 'FreeGift') ? appliedPromo.freeGift : null,
    discountType: appliedPromo?.discountType || null
  };
};

// @desc    Initiate an online order via Razorpay
export const createRazorpayOrder = async (req, res) => {
  try {
    const { items, promoId, deliverySlotId, isImmediate } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required to calculate bill' });
    }

    const deliveryTiming = await validateAndBuildDeliveryTiming(deliverySlotId, isImmediate);

    // 1. Stock Guard (Sprint 2: enforcing safety stock threshold)
    const { storeId, storeType } = req.body;
    try {
      await validateStockAvailability(items, storeId, storeType);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    // Always recompute on backend. NEVER trust frontend amount.
    const computedBill = await computeBillDetails(items, { promoId, userId: req.user._id, isImmediate: deliveryTiming.isImmediate });

    const options = {
      amount: parseRupeesToPaise(computedBill.totalAmount),
      currency: 'INR',
      receipt: `sg_rcpt_${Date.now()}`,
      notes: {
        purpose: 'order_payment',
        userId: String(req.user._id),
        deliveryMode: deliveryTiming.isImmediate ? 'immediate' : 'scheduled',
        deliverySlotId: deliveryTiming.deliverySlotId ? String(deliveryTiming.deliverySlotId) : ''
      }
    };

    const order = await razorpayInstance.orders.create(options);

    if (!order) {
      return res.status(500).json({ message: 'Failed to negotiate with Razorpay Server' });
    }

    res.status(200).json({
      success: true,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Issue: ' + error.message });
  }
};

// @desc    Finalize and Verify Payment, Then save exact order items to MongoDB
// @route   POST /api/orders/verify
// @access  Private
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      orderData
    } = req.body;

    if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    // 0. ACCOUNT SECURITY SHIELD: Verify user is not blocked before finalization
    const currentUser = await User.findById(req.user._id);
    if (!currentUser || currentUser.isActive === false) {
        return res.status(403).json({ 
            message: "Purchase blocked: Your account is no longer active. Please contact support." 
        });
    }

    verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });

    const existingPaidOrder = await Order.findOne({ razorpayPaymentId });
    if (existingPaidOrder) {
      if (
        String(existingPaidOrder.user) !== String(req.user._id)
        || String(existingPaidOrder.razorpayOrderId) !== String(razorpayOrderId)
      ) {
        throw new PaymentVerificationError('Payment has already been used', 409, 'PAYMENT_ALREADY_USED');
      }
      return res.status(200).json({ success: true, order: existingPaidOrder, replayed: true });
    }

    // Strip empty location bounds so the 2dsphere index doesn't explode
    if (orderData.shippingAddress && (!orderData.shippingAddress.location || !orderData.shippingAddress.location.coordinates || orderData.shippingAddress.location.coordinates.length < 2)) {
      delete orderData.shippingAddress.location;
    }

    // RANGE VALIDATION (Store-First Architecture Safeguard)
    if (orderData.storeId) {
      await validateStoreDistance(orderData.storeId, orderData.storeType, orderData.shippingAddress.location);
    }

    // SLOT VALIDATION
    const deliveryTiming = await validateAndBuildDeliveryTiming(orderData.deliverySlotId, orderData.isImmediate);

    // STOCK VALIDATION (Double Check)
    await validateStockAvailability(orderData.items, orderData.storeId, orderData.storeType);

    // Recompute bill to guarantee no manipulation during payment verify leap
    const computedBill = await computeBillDetails(orderData.items, { promoId: orderData.promoId, userId: req.user._id, isImmediate: deliveryTiming.isImmediate });

    const paymentVerification = await fetchAndValidateRazorpayPayment({
      razorpayOrderId,
      razorpayPaymentId,
      expectedAmountPaise: parseRupeesToPaise(computedBill.totalAmount),
      expectedCurrency: 'INR'
    });

    const providerPurpose = paymentVerification.order?.notes?.purpose;
    const providerUserId = paymentVerification.order?.notes?.userId;
    const providerDeliveryMode = paymentVerification.order?.notes?.deliveryMode;
    const providerDeliverySlotId = paymentVerification.order?.notes?.deliverySlotId;
    const providerReceipt = String(paymentVerification.order?.receipt || '');
    if (providerPurpose && providerPurpose !== 'order_payment') {
      throw new PaymentVerificationError('Razorpay order is not an order payment', 409, 'PAYMENT_PURPOSE_MISMATCH');
    }
    if (!providerPurpose && !providerReceipt.startsWith('sg_rcpt_')) {
      throw new PaymentVerificationError('Razorpay order is not an order payment', 409, 'PAYMENT_PURPOSE_MISMATCH');
    }
    if (providerUserId && String(providerUserId) !== String(req.user._id)) {
      throw new PaymentVerificationError('Payment was initiated by a different customer', 403, 'PAYMENT_OWNERSHIP_MISMATCH');
    }
    const requestedMode = deliveryTiming.isImmediate ? 'immediate' : 'scheduled';
    if (providerDeliveryMode && providerDeliveryMode !== requestedMode) {
      throw new PaymentVerificationError('Delivery choice does not match the paid checkout', 409, 'DELIVERY_TIMING_MISMATCH');
    }
    if (providerDeliverySlotId && String(providerDeliverySlotId) !== String(deliveryTiming.deliverySlotId || '')) {
      throw new PaymentVerificationError('Delivery slot does not match the paid checkout', 409, 'DELIVERY_TIMING_MISMATCH');
    }

    // Enrich items with physicalLocation for receiver picking
    const enrichedItems = await enrichItemsWithLocations(orderData.items);

    // Setup Document safely
    const order = new Order({
      orderId: 'SG-' + Math.floor(10000000 + Math.random() * 90000000).toString(),
      user: req.user._id,
      items: enrichedItems,
      shippingAddress: orderData.shippingAddress,
      paymentMethod: 'online',
      paymentStatus: 'paid', // Mark as paid for razorpay
      status: 'confirmed',
      orderSource: 'online',
      totalAmount: computedBill.totalAmount, // Securely injected
      subTotal: computedBill.subTotal,
      taxAmount: computedBill.taxAmount,
      deliveryFee: computedBill.deliveryFee,
      immediateDeliveryFee: computedBill.immediateDeliveryFee,
      handlingFee: computedBill.handlingFee,
      platformCommission: computedBill.platformCommission,
      vendorPayoutAmount: computedBill.vendorPayoutAmount,
      appliedPromo: computedBill.promoId,
      promoCode: computedBill.promoCode,
      discountAmount: computedBill.discountAmount,
      vendor: orderData.vendorId,
      ...deliveryTiming,
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId,
      razorpaySignature: razorpaySignature
    });

    // Dynamic Order Routing: Check if the order contains a vendor product first
    const firstProductIdForRoute = orderData.items[0]?.product?._id || orderData.items[0]?.product;
    const firstProductForRoute = await Product.findById(firstProductIdForRoute).select('vendor').lean();

    if (firstProductForRoute && firstProductForRoute.vendor) {
      order.vendor = firstProductForRoute.vendor;
      order.branchId = undefined;
    }
    // Priority 1: Use specific Store if provided by Frontend (Store-First Architecture)
    else if (orderData.storeId && orderData.storeType) {
      if (orderData.storeType === 'branch') {
        order.branchId = orderData.storeId;
      } else {
        order.vendor = orderData.storeId;
      }
    }
    // Legacy/Fallback Logic
    else {
      const coords = orderData.shippingAddress?.location?.coordinates;
      if (coords) {
        const optimalSource = await findOptimalSource(coords, orderData.items);
        if (optimalSource) {
          if (optimalSource.type === 'branch') {
            order.branchId = optimalSource.id;
          } else {
            order.vendor = optimalSource.id;
          }
        }
      } else if (orderData.branchId) {
        order.branchId = orderData.branchId;
      }
    }

    const createdOrder = await order.save();

    // Deduct Stock immediately after successful order placement
    await decrementStock(createdOrder);

    // Update Promo Usage
    if (computedBill.promoId) {
      await updatePromoUsage(createdOrder._id, computedBill.promoId, req.user._id);
    }
    res.status(201).json({ success: true, order: createdOrder });

    // --- Production Notifications ---
    // 1. Notify Customer
    sendPushNotification(req.user._id, 'User', {
      title: 'Order Placed!',
      body: `Your order ${createdOrder.orderId} was successful and is being processed.`
    }, { orderId: createdOrder.orderId, status: 'confirmed' });

    // Auto-assign to nearest delivery partner if applicable - DISABLED for manual assignment
    /*
    triggerAutoAssignmentForOrder(createdOrder._id).catch(err => {
      console.error('[AutoAssign] Error in verifyRazorpayPayment background trigger:', err);
    });
    */

    // 2. Notify Staff/Admin/Vendor based on product ownership
    if (createdOrder.vendor) {
      sendPushNotification(createdOrder.vendor, 'Vendor', {
        title: 'New Online Order',
        body: `Order ${createdOrder.orderId} for ₹${createdOrder.totalAmount} is ready for processing.`
      }, { orderId: createdOrder.orderId, action: 'VIEW_ORDER' });
      
      notifyAdmins({
        title: 'New Online Order (Vendor)',
        body: `Order ${createdOrder.orderId} placed for vendor for ₹${createdOrder.totalAmount}.`
      }, { orderId: createdOrder.orderId, action: 'VIEW_ORDER' });
    } else if (createdOrder.branchId) {
      notifyByBranchAndPermission('MANAGE_ORDERS', createdOrder.branchId, {
        title: 'New Online Order',
        body: `Order ${createdOrder.orderId} for ₹${createdOrder.totalAmount} is ready for processing.`
      }, { orderId: createdOrder.orderId, action: 'VIEW_ORDER' });
    } else {
      notifyAdmins({
        title: 'New Online Order',
        body: `Order ${createdOrder.orderId} for ₹${createdOrder.totalAmount} is ready for processing.`
      }, { orderId: createdOrder.orderId, action: 'VIEW_ORDER' });
    }

    // 3. Send Transactional Email to User
    if (req.user.email) {
      await sendSystemNotificationEmail(
        req.user.email,
        `Order Confirmed: #${createdOrder.orderId}`,
        'Order Received! 🏮',
        `Hi ${req.user.name}, your order #${createdOrder.orderId} for ₹${createdOrder.totalAmount} was successful. We are preparing it for delivery!`
      );
    }
  } catch (error) {
    console.error('Verify Payment Error:', error);
    if (error?.code === 11000 && req.body?.razorpayPaymentId) {
      const existingOrder = await Order.findOne({ razorpayPaymentId: req.body.razorpayPaymentId }).catch(() => null);
      if (existingOrder && String(existingOrder.user) === String(req.user?._id)) {
        return res.status(200).json({ success: true, order: existingOrder, replayed: true });
      }
    }
    const statusCode = error instanceof PaymentVerificationError ? error.statusCode : 500;
    res.status(statusCode).json({
      message: error instanceof PaymentVerificationError
        ? error.message
        : (error.message || 'Internal Verification Error'),
      code: error.code || 'ORDER_PAYMENT_VERIFICATION_FAILED'
    });
  }
};

// Unified Stock Helpers for Branch & Vendor
export const decrementStock = async (order) => {
  const { branchId, vendor, items } = order;
  console.log(`[STOCK-DEBUG] Starting decrement for Order: ${order.orderId}, Source: ${branchId ? 'Branch ' + branchId : 'Vendor ' + vendor}`);

  for (const item of items) {
    try {
      const productId = item.product._id || item.product;
      const quantity = parseInt(item.quantity) || 0;
      console.log(`[STOCK-DEBUG] Processing Product: ${productId}, Qty: ${quantity}`);

      const prodData = await Product.findById(productId);
      if (!prodData) {
        console.warn(`[STOCK-WARN] Product not found: ${productId}`);
        continue;
      }

      if (!prodData.vendor && branchId) {
        // Logic for Branch Stock
        // Try to update existing entry
        let updatedProduct = await Product.findOneAndUpdate(
          { _id: productId, 'branchStocks.branchId': branchId },
          { $inc: { 'branchStocks.$.stock': -quantity } },
          { new: true }
        );

        // If no branch entry found, but it's a valid product, we need to initialize this branch entry
        // This handles "isAllBranches" or newly assigned products
        if (!updatedProduct) {
          updatedProduct = await Product.findOneAndUpdate(
            { _id: productId },
            { 
              $push: { 
                branchStocks: { 
                  branchId: branchId, 
                  stock: -quantity,
                  lowStockThreshold: 10 
                } 
              } 
            },
            { new: true }
          );
        }

        if (updatedProduct) {
          console.log(`[STOCK-SUCCESS] Deducted ${quantity} from Branch ${branchId} for Product ${productId}`);
          const currentBS = updatedProduct.branchStocks.find(bs => bs.branchId.toString() === branchId.toString());
          await InventoryLog.create({
            product: productId,
            branchId: branchId,
            changeAmount: -quantity,
            previousStock: (currentBS?.stock || 0) + quantity,
            newStock: currentBS?.stock || 0,
            type: 'Removal',
            reason: `Order Placement #${order.orderId}`,
            orderId: order._id
          });

          // --- Production Stock Alert ---
          const threshold = currentBS?.lowStockThreshold || 10;
          if (currentBS?.stock <= threshold) {
            notifyByBranchAndPermission('MANAGE_INVENTORY', branchId, {
              title: 'Low Stock Alert!',
              body: `Product ${updatedProduct.name} is low at your branch (${currentBS.stock} left).`
            }, { productId: updatedProduct._id.toString(), type: 'inventory_alert' });
          }
        } else {
          console.warn(`[STOCK-WARN] No match found for Product: ${productId} even after attempt to initialize Branch: ${branchId}`);
        }
      } else if (prodData.vendor) {
        // Logic for Vendor Stock (Deduct from top-level stock atomically)
        const targetVendor = prodData.vendor;
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: productId },
          { $inc: { stock: -quantity } },
          { new: true }
        );

        if (updatedProduct) {
          console.log(`[STOCK-SUCCESS] Deducted ${quantity} from Vendor ${targetVendor} for Product ${productId}`);
          await InventoryLog.create({
            product: productId,
            vendorId: targetVendor,
            changeAmount: -quantity,
            previousStock: (updatedProduct.stock || 0) + quantity,
            newStock: updatedProduct.stock || 0,
            type: 'Removal',
            reason: `Order Placement #${order.orderId}`,
            orderId: order._id
          });

          // --- Production Vendor Stock Alert ---
          if (updatedProduct.stock <= (updatedProduct.lowStockThreshold || 10)) {
            await sendPushNotification(targetVendor, 'Vendor', {
              title: 'Low Stock Alert!',
              body: `Your product '${updatedProduct.name}' is running low (${updatedProduct.stock} items left).`
            }, { productId: updatedProduct._id.toString(), type: 'inventory_alert' });
          }
        } else {
          console.warn(`[STOCK-WARN] No match found for Product: ${productId} at Vendor: ${targetVendor}`);
        }
      }
    } catch (err) {
      console.error(`[STOCK-DECREMENT-FAIL] Order: ${order.orderId}, Product: ${item.product}`, err);
    }
  }
};

/**
 * HELPER: Update Promo Usage after successful order
 */
export const updatePromoUsage = async (orderId, promoId, userId) => {
  if (!promoId) return;

  try {
    // 1. Increment global count
    await PromoCode.findByIdAndUpdate(promoId, { $inc: { usedCount: 1 } });

    // 2. Increment user specific count
    await PromoUsage.findOneAndUpdate(
      { user: userId, promoCode: promoId },
      { 
        $inc: { usageCount: 1 },
        $push: { orders: orderId }
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Error updating promo usage:', error);
  }
};

export const incrementStock = async (order) => {
  const { branchId, vendor, items } = order;
  for (const item of items) {
    try {
      const productId = item.product._id || item.product;
      const quantity = parseInt(item.quantity) || 0;

      const prodData = await Product.findById(productId);
      if (!prodData) continue;

      if (!prodData.vendor && branchId) {
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: productId, 'branchStocks.branchId': branchId },
          { $inc: { 'branchStocks.$.stock': quantity } },
          { new: true }
        );

        if (updatedProduct) {
          const currentBS = updatedProduct.branchStocks.find(bs => bs.branchId.toString() === branchId.toString());
          await InventoryLog.create({
            product: productId,
            branchId: branchId,
            changeAmount: quantity,
            previousStock: (currentBS?.stock || 0) - quantity,
            newStock: currentBS?.stock || 0,
            type: 'Addition',
            reason: `Order Reversal (Cancel/Return) #${order.orderId}`,
            orderId: order._id
          });
        }
      } else if (prodData.vendor) {
        // Restore to top-level stock
        const targetVendor = prodData.vendor;
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: productId },
          { $inc: { stock: quantity } },
          { new: true }
        );

        if (updatedProduct) {
          await InventoryLog.create({
            product: productId,
            vendorId: targetVendor,
            changeAmount: quantity,
            previousStock: (updatedProduct.stock || 0) - quantity,
            newStock: updatedProduct.stock || 0,
            type: 'Addition',
            reason: `Order Reversal (Cancel/Return) #${order.orderId}`,
            orderId: order._id
          });
        }
      }
    } catch (err) {
      console.error(`[STOCK-INCREMENT-FAIL] Order: ${order.orderId}, Product: ${item.product}`, err);
    }
  }
};

/**
 * HELPER: Credit Vendor Wallet on Delivery
 */
export const creditVendorWallet = async (order) => {
  if (!order.vendor || order.status !== 'delivered') return;

  try {
    const payoutAmount = order.vendorPayoutAmount || 0;
    if (payoutAmount <= 0) return;

    // Atomically upsert vendor wallet (safe from duplicate-key errors)
    const wallet = await Wallet.findOneAndUpdate(
      { owner: order.vendor, ownerModel: 'Vendor' },
      { $setOnInsert: { balance: 0, totalEarnings: 0, pendingPayouts: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Check if transaction already exists to prevent double credit
    const existingTx = await Transaction.findOne({
      wallet: wallet._id,
      referenceId: order._id,
      category: 'order_revenue'
    });

    if (existingTx) return;

    // Atomically increment the balance
    await Wallet.findByIdAndUpdate(wallet._id, {
      $inc: { balance: payoutAmount, totalEarnings: payoutAmount }
    });

    await Transaction.create({
      wallet: wallet._id,
      amount: payoutAmount,
      type: 'credit',
      category: 'order_revenue',
      referenceId: order._id,
      referenceModel: 'Order',
      description: `Revenue for Order #${order.orderId} (Net of commission)`
    });
  } catch (error) {
    console.error('Error crediting vendor wallet:', error);
  }
};

/**
 * HELPER: Debit Vendor Wallet on Return
 */
export const debitVendorWallet = async (order) => {
  if (!order.vendor || order.status !== 'returned') return;

  try {
    const payoutAmount = order.vendorPayoutAmount || 0;
    if (payoutAmount <= 0) return;

    let wallet = await Wallet.findOne({ owner: order.vendor, ownerModel: 'Vendor' });
    if (!wallet) return; // No wallet, nothing to debit (shouldn't happen if delivered)

    // Check if debit transaction already exists to prevent double debit
    const existingTx = await Transaction.findOne({
      wallet: wallet._id,
      referenceId: order._id,
      type: 'debit',
      category: 'adjustment'
    });

    if (existingTx) return;

    wallet.balance -= payoutAmount;
    // We also reduce totalEarnings to keep stats accurate for the period
    wallet.totalEarnings = Math.max(0, wallet.totalEarnings - payoutAmount);
    await wallet.save();

    await Transaction.create({
      wallet: wallet._id,
      amount: payoutAmount,
      type: 'debit',
      category: 'adjustment',
      referenceId: order._id,
      referenceModel: 'Order',
      description: `Refund Debit for Return #${order.orderId}`
    });
  } catch (error) {
    console.error('Error debiting vendor wallet:', error);
  }
};

/**
 * HELPER: Credit Admin Wallet on Delivery
 */
export const creditAdminWallet = async (order) => {
  if (order.status !== 'delivered') return;

  try {
    let creditAmount = 0;
    if (order.branchId) {
      creditAmount = order.totalAmount;
    } else if (order.vendor) {
      // Admin gets platform commission + delivery fees + handling fees
      creditAmount = (order.platformCommission || 0) + (order.deliveryFee || 0) + (order.handlingFee || 0);
    }

    if (creditAmount <= 0) return;

    // Find a Super Admin for the wallet owner
    const superAdmin = await mongoose.model('Admin').findOne({ role: 'Admin' });
    if (!superAdmin) return;

    const wallet = await Wallet.findOneAndUpdate(
      { owner: superAdmin._id, ownerModel: 'Admin' },
      { $setOnInsert: { balance: 0, totalEarnings: 0, pendingPayouts: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const existingTx = await Transaction.findOne({
      wallet: wallet._id,
      referenceId: order._id,
      category: 'order_revenue'
    });
    if (existingTx) return;

    await Wallet.findByIdAndUpdate(wallet._id, {
      $inc: { balance: creditAmount, totalEarnings: creditAmount }
    });

    await Transaction.create({
      wallet: wallet._id,
      amount: creditAmount,
      type: 'credit',
      category: 'order_revenue',
      referenceId: order._id,
      referenceModel: 'Order',
      description: `Revenue and Fees share for Order #${order.orderId}`
    });
  } catch (error) {
    console.error('Error crediting admin wallet:', error);
  }
};

/**
 * HELPER: Debit Admin Wallet on Return
 */
export const debitAdminWallet = async (order) => {
  if (order.status !== 'returned') return;

  try {
    let debitAmount = 0;
    if (order.branchId) {
      debitAmount = order.totalAmount;
    } else if (order.vendor) {
      debitAmount = (order.platformCommission || 0) + (order.deliveryFee || 0) + (order.handlingFee || 0);
    }

    if (debitAmount <= 0) return;

    const superAdmin = await mongoose.model('Admin').findOne({ role: 'Admin' });
    if (!superAdmin) return;

    const wallet = await Wallet.findOne({ owner: superAdmin._id, ownerModel: 'Admin' });
    if (!wallet) return;

    const existingTx = await Transaction.findOne({
      wallet: wallet._id,
      referenceId: order._id,
      type: 'debit',
      category: 'adjustment'
    });
    if (existingTx) return;

    await Wallet.findByIdAndUpdate(wallet._id, {
      $inc: { balance: -debitAmount }
    });

    await Transaction.create({
      wallet: wallet._id,
      amount: debitAmount,
      type: 'debit',
      category: 'adjustment',
      referenceId: order._id,
      referenceModel: 'Order',
      description: `Revenue Reversal for Return #${order.orderId}`
    });
  } catch (error) {
    console.error('Error debiting admin wallet:', error);
  }
};

// @desc    Save exact Order items via normal Cash on Delivery
// @route   POST /api/orders/cod
// @access  Private
export const createCODOrder = async (req, res) => {
  try {
    const { orderData } = req.body;

    // 0. ACCOUNT SECURITY SHIELD: Verify user is not blocked before finalization
    const currentUser = await User.findById(req.user._id);
    if (!currentUser || currentUser.isActive === false) {
        return res.status(403).json({ 
            message: "Order failed: Your account is deactivated. Please contact support." 
        });
    }

    // Strip empty location bounds so the 2dsphere index doesn't explode
    if (orderData.shippingAddress && (!orderData.shippingAddress.location || !orderData.shippingAddress.location.coordinates || orderData.shippingAddress.location.coordinates.length < 2)) {
      delete orderData.shippingAddress.location;
    }

    // RANGE VALIDATION (Store-First Architecture Safeguard)
    if (orderData.storeId) {
      await validateStoreDistance(orderData.storeId, orderData.storeType, orderData.shippingAddress.location);
    }

    // SLOT VALIDATION
    const deliveryTiming = await validateAndBuildDeliveryTiming(orderData.deliverySlotId, orderData.isImmediate);

    // STOCK VALIDATION
    await validateStockAvailability(orderData.items, orderData.storeId, orderData.storeType);

    // Always recompute on backend. NEVER trust frontend amount
    const computedBill = await computeBillDetails(orderData.items, {
      promoId: orderData.promoId,
      userId: req.user._id,
      isImmediate: deliveryTiming.isImmediate
    });

    // Enrich items with physicalLocation for receiver picking
    const enrichedCODItems = await enrichItemsWithLocations(orderData.items);

    const order = new Order({
      orderId: 'SG-' + Math.floor(10000000 + Math.random() * 90000000).toString(),
      user: req.user._id,
      items: enrichedCODItems,
      shippingAddress: orderData.shippingAddress,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      status: 'pending',
      orderSource: 'online',
      totalAmount: computedBill.totalAmount, // Securely injected
      subTotal: computedBill.subTotal,
      taxAmount: computedBill.taxAmount,
      deliveryFee: computedBill.deliveryFee,
      immediateDeliveryFee: computedBill.immediateDeliveryFee,
      handlingFee: computedBill.handlingFee,
      platformCommission: computedBill.platformCommission,
      vendorPayoutAmount: computedBill.vendorPayoutAmount,
      appliedPromo: computedBill.promoId,
      promoCode: computedBill.promoCode,
      discountAmount: computedBill.discountAmount,
      vendor: orderData.vendorId,
      ...deliveryTiming,
    });

    // Dynamic Order Routing: Check if the order contains a vendor product first
    const firstProductIdForRoute = orderData.items[0]?.product?._id || orderData.items[0]?.product;
    const firstProductForRoute = await Product.findById(firstProductIdForRoute).select('vendor').lean();

    if (firstProductForRoute && firstProductForRoute.vendor) {
      order.vendor = firstProductForRoute.vendor;
      order.branchId = undefined;
    }
    // Priority 1: Use specific Store if provided by Frontend (Store-First Architecture)
    else if (orderData.storeId && orderData.storeType) {
      if (orderData.storeType === 'branch') {
        order.branchId = orderData.storeId;
      } else {
        order.vendor = orderData.storeId;
      }
    }
    // Legacy/Fallback Logic
    else {
      const coords = orderData.shippingAddress?.location?.coordinates;
      if (coords) {
        const optimalSource = await findOptimalSource(coords, orderData.items);
        if (optimalSource) {
          if (optimalSource.type === 'branch') {
            order.branchId = optimalSource.id;
          } else {
            order.vendor = optimalSource.id;
          }
        }
      } else if (orderData.branchId) {
        order.branchId = orderData.branchId;
      }
    }

    const createdOrder = await order.save();

    // Deduct Stock immediately after successful order placement
    await decrementStock(createdOrder);

    // Update Promo Usage
    if (computedBill.promoId) {
      await updatePromoUsage(createdOrder._id, computedBill.promoId, req.user._id);
    }
    res.status(201).json({ success: true, order: createdOrder });

    // --- Production Notifications ---
    // 1. Notify Customer
    sendPushNotification(req.user._id, 'User', {
      title: 'Order Placed (COD)',
      body: `Order ${createdOrder.orderId} placed successfully. Please keep ₹${createdOrder.totalAmount} ready for delivery.`
    }, { orderId: createdOrder.orderId, status: 'pending' });

    // 2. Notify Staff/Admin/Vendor based on product ownership
    if (createdOrder.vendor) {
      sendPushNotification(createdOrder.vendor, 'Vendor', {
        title: 'New COD Order',
        body: `A new COD order ${createdOrder.orderId} needs confirmation.`
      }, { orderId: createdOrder.orderId, action: 'CONFIRM_ORDER' });
      
      notifySuperAdmins({
        title: 'New COD Order (Vendor)',
        body: `A new COD order ${createdOrder.orderId} placed for vendor.`
      }, { orderId: createdOrder.orderId, action: 'CONFIRM_ORDER' });
    } else if (createdOrder.branchId) {
      notifyByBranchAndPermission('MANAGE_ORDERS', createdOrder.branchId, {
        title: 'New COD Order',
        body: `A new COD order ${createdOrder.orderId} needs confirmation.`
      }, { orderId: createdOrder.orderId, action: 'CONFIRM_ORDER' });
    } else {
      notifySuperAdmins({
        title: 'New COD Order',
        body: `A new COD order ${createdOrder.orderId} needs confirmation.`
      }, { orderId: createdOrder.orderId, action: 'CONFIRM_ORDER' });
    }

    // 3. Status Change Email
    if (req.user.email) {
      await sendSystemNotificationEmail(
        req.user.email,
        `Order Placed: #${createdOrder.orderId}`,
        'Order Confirmed! 📦',
        `Hi ${req.user.name}, your COD order #${createdOrder.orderId} for ₹${createdOrder.totalAmount} is confirmed. Please keep the cash ready!`
      );
    }
  } catch (error) {
    console.error('COD Order Error:', error);
    res.status(500).json({ message: error.message || 'Internal COD Error' });
  }
};

// @desc    Create Order using Wallet Balance
// @route   POST /api/orders/wallet
// @access  Private
export const createWalletOrder = async (req, res) => {
  try {
    const { orderData } = req.body;
    const user = await User.findById(req.user._id);

    // SLOT VALIDATION
    const deliveryTiming = await validateAndBuildDeliveryTiming(orderData.deliverySlotId, orderData.isImmediate);
    // Recompute bill to guarantee security
    const computedBill = await computeBillDetails(orderData.items, {
      promoId: orderData.promoId,
      userId: req.user._id,
      isImmediate: deliveryTiming.isImmediate
    });

    // Strip empty location bounds
    if (orderData.shippingAddress && (!orderData.shippingAddress.location || !orderData.shippingAddress.location.coordinates || orderData.shippingAddress.location.coordinates.length < 2)) {
      delete orderData.shippingAddress.location;
    }

    // RANGE VALIDATION (Store-First Architecture Safeguard)
    if (orderData.storeId) {
      await validateStoreDistance(orderData.storeId, orderData.storeType, orderData.shippingAddress.location);
    }

    if (user.walletBalance < computedBill.totalAmount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Enrich items with physicalLocation for picking
    const enrichedWalletItems = await enrichItemsWithLocations(orderData.items);

    const order = new Order({
      orderId: 'SG-' + Math.floor(10000000 + Math.random() * 90000000).toString(),
      user: req.user._id,
      items: enrichedWalletItems,
      shippingAddress: orderData.shippingAddress,
      paymentMethod: 'wallet',
      paymentStatus: 'paid',
      status: 'confirmed',
      orderSource: 'online',
      totalAmount: computedBill.totalAmount,
      subTotal: computedBill.subTotal,
      taxAmount: computedBill.taxAmount,
      deliveryFee: computedBill.deliveryFee,
      immediateDeliveryFee: computedBill.immediateDeliveryFee,
      handlingFee: computedBill.handlingFee,
      platformCommission: computedBill.platformCommission,
      vendorPayoutAmount: computedBill.vendorPayoutAmount,
      appliedPromo: computedBill.promoId,
      promoCode: computedBill.promoCode,
      discountAmount: computedBill.discountAmount,
      vendor: orderData.vendorId,
      ...deliveryTiming,
    });

    // Dynamic Order Routing: Check if the order contains a vendor product first
    const firstProductIdForRoute = orderData.items[0]?.product?._id || orderData.items[0]?.product;
    const firstProductForRoute = await Product.findById(firstProductIdForRoute).select('vendor').lean();

    if (firstProductForRoute && firstProductForRoute.vendor) {
      order.vendor = firstProductForRoute.vendor;
      order.branchId = undefined;
    }
    // Priority 1: Use specific Store if provided by Frontend (Store-First Architecture)
    else if (orderData.storeId && orderData.storeType) {
      if (orderData.storeType === 'branch') {
        order.branchId = orderData.storeId;
      } else {
        order.vendor = orderData.storeId;
      }
    }
    // Legacy/Fallback Logic
    else {
      let coords = orderData.shippingAddress?.location?.coordinates;
      if (coords) {
        const optimalSource = await findOptimalSource(coords, orderData.items);
        if (optimalSource) {
          if (optimalSource.type === 'branch') {
            order.branchId = optimalSource.id;
          } else {
            order.vendor = optimalSource.id;
          }
        }
      } else if (orderData.branchId) {
        order.branchId = orderData.branchId;
      }
    }

    // Deduct from User Wallet immediately
    user.walletBalance -= computedBill.totalAmount;
    await user.save();

    const createdOrder = await order.save();

    // Log Transaction
    await UserTransaction.create({
      user: req.user._id,
      amount: computedBill.totalAmount,
      type: 'debit',
      category: 'order_payment',
      status: 'completed',
      description: `Payment for Order #${createdOrder.orderId}`,
      orderId: createdOrder._id
    });

    // Deduct Stock
    await decrementStock(createdOrder);

    // Update Promo Usage
    if (computedBill.promoId) {
      await updatePromoUsage(createdOrder._id, computedBill.promoId, req.user._id);
    }

    res.status(201).json({ success: true, order: createdOrder });

    // --- Production Notifications ---
    // 1. Notify Customer
    sendPushNotification(req.user._id, 'User', {
      title: 'Order Placed (Wallet)!',
      body: `Order ${createdOrder.orderId} was successful using your wallet balance.`
    }, { orderId: createdOrder.orderId, status: 'confirmed' });

    // Auto-assign to nearest delivery partner if applicable - DISABLED for manual assignment
    /*
    triggerAutoAssignmentForOrder(createdOrder._id).catch(err => {
      console.error('[AutoAssign] Error in createWalletOrder background trigger:', err);
    });
    */

    // 2. Notify Staff/Admin/Vendor
    if (createdOrder.vendor) {
      sendPushNotification(createdOrder.vendor, 'Vendor', {
        title: 'New Prepaid Order',
        body: `Digital order ${createdOrder.orderId} for ₹${createdOrder.totalAmount} is confirmed.`
      }, { orderId: createdOrder.orderId, action: 'PROCESS_ORDER' });
      
      notifySuperAdmins({
        title: 'New Prepaid Order (Vendor)',
        body: `Digital order ${createdOrder.orderId} placed for vendor.`
      }, { orderId: createdOrder.orderId, action: 'PROCESS_ORDER' });
    } else if (createdOrder.branchId) {
      notifyByBranchAndPermission('MANAGE_ORDERS', createdOrder.branchId, {
        title: 'New Prepaid Order',
        body: `Digital order ${createdOrder.orderId} for ₹${createdOrder.totalAmount} is confirmed.`
      }, { orderId: createdOrder.orderId, action: 'PROCESS_ORDER' });
    } else {
      notifySuperAdmins({
        title: 'New Prepaid Order',
        body: `Digital order ${createdOrder.orderId} for ₹${createdOrder.totalAmount} is confirmed.`
      }, { orderId: createdOrder.orderId, action: 'PROCESS_ORDER' });
    }

    // 3. User Wallet Order Email
    if (req.user.email) {
      await sendSystemNotificationEmail(
        req.user.email,
        `Payment Success: #${createdOrder.orderId}`,
        'Order Received! 🏮',
        `Hi ${req.user.name}, your order #${createdOrder.orderId} was paid via wallet (₹${createdOrder.totalAmount}). We're on it!`
      );
    }
  } catch (error) {
    console.error('Wallet Order Error:', error);
    res.status(500).json({ message: error.message || 'Internal Wallet Error' });
  }
};

// @desc    Cancel Order logic for User (Before Out for Delivery)
// @route   POST /api/orders/:id/cancel
// @access  Private
export const cancelOrderUser = async (req, res) => {
  try {
    const { reason } = req.body;
    const orderId = req.params.id;
    console.log(`[CANCELLATION_DEBUG] HIT! Order: ${orderId}, User: ${req.user?._id}, Reason: ${reason}`);

    const id = req.params.id;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderId: id };
    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order strictly not found' });
    }

    // Security check - String conversion for safety
    if (String(order.user) !== String(req.user?._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    // Normalize and check status
    const currentStatus = (order.status || 'pending').toLowerCase();
    const restricted = ['out_for_delivery', 'delivered', 'cancelled', 'returned'];
    if (restricted.includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cancellation window closed. Current status: ${currentStatus.replace(/_/g, ' ')}`
      });
    }

    // Primitive property updates + save() which is higher reliability in some Mongoose versions
    order.status = 'cancelled';
    const oldPaymentStatus = order.paymentStatus;

    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded';

      // Auto-refund to wallet if it was paid online or via wallet
      const refundAmount = order.totalAmount;
      const user = await User.findById(order.user);
      user.walletBalance += refundAmount;
      await user.save();

      // Log Transaction
      await UserTransaction.create({
        user: order.user,
        amount: refundAmount,
        type: 'credit',
        category: 'order_refund',
        status: 'completed',
        description: `Refund for Cancelled Order #${order.orderId}`,
        orderId: order._id
      });
    }

    order.cancellation = {
      isCancelled: true,
      reason: reason || 'Cancelled by user',
      cancelledAt: new Date()
    };

    const updatedOrder = await order.save();

    // Restore Stock (Works for both Branch and Vendor sources)
    await incrementStock(updatedOrder);

    res.json({ success: true, order: updatedOrder });

    // Notify Branch Staff of User Cancellation
    if (updatedOrder.branchId) {
      notifyByBranchAndPermission('MANAGE_ORDERS', updatedOrder.branchId, {
        title: 'Order Cancelled by User',
        body: `Order #${updatedOrder.orderId} was cancelled by the customer.`
      }, { orderId: updatedOrder.orderId, type: 'user_cancellation' });
    }
  } catch (error) {
    console.error('Cancellation Endpoint Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    User requests a return for a delivered order
// @route   POST /api/orders/:id/return
// @access  Private (User)
export const requestReturn = async (req, res) => {
  try {
    const { reason, description } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Return reason is required' });
    }

    const id = req.params.id;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderId: id };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only the order owner can request a return
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Only delivered orders can be returned
    if (order.status !== 'delivered') {
      return res.status(400).json({ message: 'Only delivered orders can be returned' });
    }

    // Prevent duplicate return requests
    if (order.returnRequest.isRequested) {
      return res.status(400).json({ message: 'A return request already exists for this order' });
    }

    const imageProof = req.files ? req.files.map(file => file.path) : [];

    order.returnRequest = {
      isRequested: true,
      reason,
      description: description || null,
      images: imageProof,
      status: 'Pending',
      requestDate: new Date()
    };

    order.status = 'return_requested';
    const updatedOrder = await order.save();
    res.json({ success: true, order: updatedOrder });

    // Notify Super Admins of Return Request
    notifySuperAdmins({
      title: 'New Return Request',
      body: `Customer requested a return for Order #${updatedOrder.orderId}. Reason: ${reason}`
    }, { orderId: updatedOrder.orderId, action: 'VIEW_RETURN_REQUEST' });

    // Notify Branch Staff (Store Manager and Staff) of Return Request
    if (updatedOrder.branchId) {
      notifyByBranchAndPermission('MANAGE_REFUNDS_RETURNS', updatedOrder.branchId, {
        title: 'New Return Request',
        body: `Customer requested a return for Order #${updatedOrder.orderId}. Reason: ${reason}`
      }, { orderId: updatedOrder.orderId, type: 'return_request' });
    }

    // Notify Vendor of Return Request
    if (updatedOrder.vendor) {
      sendPushNotification(updatedOrder.vendor, 'Vendor', {
        title: '🔄 New Return Request',
        body: `A customer has requested a return for Order #${updatedOrder.orderId}. Reason: ${reason}`
      }, { orderId: updatedOrder.orderId, type: 'return_request' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Calculate Bill Summary to display securely to User 
// @route   POST /api/orders/calculate-bill
// @access  Private
export const calculateBill = async (req, res) => {
  try {
    const { items, storeId, storeType, promoId, isImmediate } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ message: 'Cart is empty' });

    const bill = await computeBillDetails(items, {
      storeId,
      storeType,
      promoId,
      userId: req.user?._id,
      isImmediate: isImmediate === true || isImmediate === 'true'
    });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's historic orders
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .select('orderId status items totalAmount createdAt paymentStatus cancellation paymentMethod deliveryOTP returnRequest branchId vendor isImmediate deliverySlot deliveryWindowSnapshot deliveryFee immediateDeliveryFee baseDeliveryFee')
      .populate('items.product', 'name images basePrice stock branchStocks lowStockThreshold')
      .populate('branchId', 'name')
      .populate('vendor', 'storeName')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single order detail
// @route   GET /api/orders/:id
// @access  Private
// Allows getting standard order info fully populated
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    let order;

    // Logic: Try Mongo _id first if valid, else fallback to custom SG-... orderId
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id)
        .populate('user', 'name email phone')
        .populate('items.product', 'name category image unitValue unitType branchStocks stock lowStockThreshold')
        .populate('deliveryPartnerId', 'name phone profileImage vehicleType vehicleNumber currentLocation locationUpdatedAt currentHeading')
        .populate('branchId', 'name address location')
        .populate('vendor', 'storeName address location');
    } else {
      order = await Order.findOne({ orderId: id })
        .populate('user', 'name email phone')
        .populate('items.product', 'name category image unitValue unitType branchStocks stock lowStockThreshold')
        .populate('deliveryPartnerId', 'name phone profileImage vehicleType vehicleNumber currentLocation locationUpdatedAt currentHeading')
        .populate('branchId', 'name address location')
        .populate('vendor', 'storeName address location');
    }

    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: 'Order strictly not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Route Directions via Google Maps for order tracking (User/Rider)
// @route   GET /api/orders/:id/route
// @access  Private (Customer - own orders only)
export const getOrderRoute = async (req, res) => {
  try {
    const { lat, lng, origin: legacyOrigin } = req.query;
    const id = req.params.id;

    // Ownership check: customer can only fetch route for their own order
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id, user: req.user._id }
      : { orderId: id, user: req.user._id };

    const order = await Order.findOne(query)
      .populate('deliveryPartnerId', 'currentLocation')
      .populate('branchId', 'address.location')
      .populate('vendor', 'address.location');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Block route fetch for terminal statuses
    if (['delivered', 'cancelled', 'returned'].includes(order.status)) {
      return res.status(400).json({ message: 'Tracking not available for this order status' });
    }

    // Destination from shipping address (GeoJSON: [lng, lat])
    const destCoords = order.shippingAddress?.location?.coordinates;
    if (!destCoords || destCoords.length !== 2) {
      return res.status(400).json({ message: 'Target destination missing for this order' });
    }
    const [destLng, destLat] = destCoords;
    const destination = `${destLat},${destLng}`;

    // Origin priority:
    // 1. lat/lng query params (preferred - sent by frontend throttle logic)
    // 2. Legacy 'origin' string param
    // 3. Rider DB location
    // 4. Store/branch fallback
    let originStr = '';
    let originLat = null;
    let originLng = null;

    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      originLat = parseFloat(lat);
      originLng = parseFloat(lng);
      originStr = `${originLat},${originLng}`;
    } else if (legacyOrigin) {
      originStr = legacyOrigin;
      const parts = legacyOrigin.split(',');
      if (parts.length === 2) { originLat = parseFloat(parts[0]); originLng = parseFloat(parts[1]); }
    } else if (order.deliveryPartnerId?.currentLocation?.coordinates) {
      const riderLoc = order.deliveryPartnerId.currentLocation.coordinates;
      originLat = riderLoc[1]; originLng = riderLoc[0];
      originStr = `${originLat},${originLng}`;
    } else {
      const storeLoc = order.branchId?.address?.location?.coordinates || order.vendor?.address?.location?.coordinates;
      if (storeLoc) { originLat = storeLoc[1]; originLng = storeLoc[0]; originStr = `${originLat},${originLng}`; }
    }

    if (!originStr) return res.status(400).json({ message: 'Rider or Store location not detected' });

    // Cache check - skip Directions API if we have a fresh cached response
    if (originLat !== null && originLng !== null) {
      const cacheKey = buildRouteCacheKey(order._id, originLat, originLng, destLat, destLng);
      const cached = getCachedRoute(cacheKey);
      if (cached) {
        console.log(`[ROUTE-CACHE] HIT for order ${order._id}`);
        return res.json({ routes: cached });
      }
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API;
    if (!apiKey) return res.status(500).json({ message: 'Maps logic restricted on server currently' });

    console.log(`[ROUTE] Fetching from Google: Origin ${originStr} -> ${destination}`);
    const mapUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destination}&key=${apiKey}`;
    const response = await axios.get(mapUrl);

    if (response.data.status !== 'OK') {
      console.error('[ROUTE] Google Maps error:', response.data.status, response.data.error_message);
      return res.status(400).json({ message: response.data.error_message || 'Maps engine responded with error' });
    }

    // Cache the result for 90 seconds
    if (originLat !== null && originLng !== null) {
      const cacheKey = buildRouteCacheKey(order._id, originLat, originLng, destLat, destLng);
      setCachedRoute(cacheKey, response.data.routes);
      console.log(`[ROUTE-CACHE] SET for order ${order._id}`);
    }

    res.json({ routes: response.data.routes });
  } catch (error) {
    console.error('getOrderRoute issue:', error);
    res.status(500).json({ message: 'Server Issue: Maps logic failed' });
  }
};

// --- ADMIN / STAFF ORDER MANAGEMENT ---

// @desc    Get all orders for Admin/Staff (Branch-scoped)
// @route   GET /api/admin/orders
// @access  Private (Admin/Staff)
export const getAllOrdersAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      paymentMethod,
      paymentStatus,
      startDate,
      endDate,
      branchId,
      deliverySlotId,
      isImmediate,
      orderSource
    } = req.query;

    let query = {};

    // Branch Scoping: If not Super Admin, only show orders for their branch
    if (req.admin.role !== 'Admin') {
      if (!req.admin.branchId) {
        return res.status(403).json({ message: 'No branch assigned' });
      }
      query.branchId = req.admin.branchId;
    } else if (branchId) {
      // Super Admin filtering by branch
      query.branchId = branchId;
    }

    if (deliverySlotId && deliverySlotId !== '') query.deliverySlotId = deliverySlotId;
    if (isImmediate !== undefined && isImmediate !== '') {
      query.isImmediate = isImmediate === 'true';
    }

    if (orderSource && orderSource !== '') {
      if (orderSource === 'pos') {
        query.orderSource = 'pos';
      } else if (orderSource === 'online') {
        // Treat "online" as any non-POS order (legacy orders often have no orderSource)
        query.orderSource = { $ne: 'pos' };
      } else {
        query.orderSource = orderSource;
      }
    }

    // Search logic
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');

      // We need to search by orderId and also by user name/email.
      // Since user is a ref, we first find matching users.
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      }).select('_id').lean();
      const userIds = matchingUsers.map(user => user._id);

      query.$or = [
        { orderId: searchRegex },
        { user: { $in: userIds } },
        { 'posCustomer.name': searchRegex },
        { 'posCustomer.email': searchRegex },
        { 'posCustomer.phone': searchRegex }
      ];
    }

    // Filters
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Pagination
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Run paginated results, total count, AND full-dataset aggregate stats in parallel
    const [orders, totalOrders, statsAgg] = await Promise.all([
      Order.find(query)
        .select('orderId user posCustomer totalAmount status createdAt paymentMethod paymentStatus branchId vendor deliverySlot deliverySlotId deliveryWindowSnapshot isImmediate orderSource promoCode discountAmount items subTotal taxAmount deliveryFee immediateDeliveryFee baseDeliveryFee handlingFee')
        .populate('user', 'name email phone')
        .populate('branchId', 'name')
        .populate('vendor', 'storeName')
        .populate('deliverySlotId', 'label startTime endTime')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Order.countDocuments(query),
      // Aggregate across ALL matching docs (no pagination) for accurate stats
      Order.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalPaid: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
            },
            totalPendingPayment: {
              $sum: { $cond: [{ $ne: ['$paymentStatus', 'paid'] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    const aggResult = statsAgg[0] || {};

    res.json({
      orders,
      pagination: {
        total: totalOrders,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalOrders / limitNumber)
      },
      stats: {
        totalOrders,
        totalPaid: aggResult.totalPaid || 0,
        totalPendingPayment: aggResult.totalPendingPayment || 0,
        totalRevenue: parseFloat((aggResult.totalRevenue || 0).toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Order Status (Confirm, Pakk, Ship, Deliver, Cancel)
// @route   PUT /api/admin/orders/:id/status
// @access  Private (Admin/Staff)
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedOrderStatuses = Order?.schema?.path('status')?.enumValues || [
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'return_requested',
      'return_pickup_scheduled',
      'return_picked_up',
      'returned'
    ];

    if (!status) {
      return res.status(400).json({ message: 'Order status is required' });
    }

    if (!allowedOrderStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const id = req.params.id;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderId: id };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Branch Security
    if (req.admin.role !== 'Admin' && order.branchId?.toString() !== req.admin.branchId?.toString()) {
      return res.status(403).json({ message: 'Not authorized to manage orders from other branches' });
    }

    // Role-based Status Security
    if (req.admin.role === 'Store Manager' || req.admin.role === 'Staff') {
      const allowedRolesStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'cancelled'];
      if (!allowedRolesStatuses.includes(status)) {
        return res.status(403).json({ message: 'Managers and Staff can only mark orders as confirmed, preparing, ready for pickup, or cancelled.' });
      }
    }

    const oldStatus = order.status;
    if (oldStatus === status) {
      return res.json(order);
    }

    order.status = status;
    if (status === 'delivered') {
      order.paymentStatus = 'paid';
    }

    // Refund logic for User if status becomes 'returned' or 'cancelled' and it was paid
    if ((status === 'returned' || status === 'cancelled') && oldStatus !== 'returned' && oldStatus !== 'cancelled' && order.paymentStatus === 'paid') {
      const refundAmount = order.totalAmount;
      const user = await User.findById(order.user);
      if (user) {
        user.walletBalance = (user.walletBalance || 0) + refundAmount;
        await user.save();
        
        order.paymentStatus = 'refunded';
        
        // Log Transaction for User
        await UserTransaction.create({
          user: order.user,
          amount: refundAmount,
          type: 'credit',
          category: 'order_refund',
          status: 'completed',
          description: `Refund for Order #${order.orderId} (${status})`,
          orderId: order._id
        });
      }
    }

    if ((status === 'cancelled' || status === 'returned') && oldStatus !== 'cancelled' && oldStatus !== 'returned') {
      order.cancellation = {
        isCancelled: true,
        reason: status === 'cancelled' ? 'Cancelled by Admin/Staff' : 'Returned',
        cancelledAt: new Date()
      };
      // Restore Stock
      await incrementStock(order);
    }

    const updatedOrder = await order.save();

    // Trigger Wallet Credit if status is delivered
    if (status === 'delivered') {
      await creditVendorWallet(updatedOrder);
      await creditAdminWallet(updatedOrder);
    }

    if (status === 'returned') {
      await debitVendorWallet(updatedOrder);
      await debitAdminWallet(updatedOrder);
    }

    res.json(updatedOrder);

    // Auto-assign to delivery partner if status is confirmed or preparing - DISABLED for manual assignment
    /*
    if (status === 'confirmed' || status === 'preparing') {
      triggerAutoAssignmentForOrder(updatedOrder._id).catch(err => {
        console.error('[AutoAssign] Error in updateOrderStatus background trigger:', err);
      });
    }
    */

    // --- Production Notifications ---
    // Notify Customer of Status Update
    sendPushNotification(updatedOrder.user, 'User', {
      title: `Order ${updatedOrder.status.charAt(0).toUpperCase() + updatedOrder.status.slice(1)}`,
      body: `Your order ${updatedOrder.orderId} status has been updated to ${updatedOrder.status}.`
    }, { orderId: updatedOrder.orderId, status: updatedOrder.status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete Order entirely
// @route   DELETE /api/admin/orders/:id
// @access  Private (Admin only)
export const deleteOrder = async (req, res) => {
  try {
    const id = req.params.id;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderId: id };
    
    if (mongoose.Types.ObjectId.isValid(id)) {
      await Order.findByIdAndDelete(id);
    } else {
      await Order.findOneAndDelete({ orderId: id });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete multiple orders at once (Admin/Staff)
// @route   DELETE /api/orders/admin/bulk
// @access  Private (Admin/Staff with MANAGE_ORDERS)
export const bulkDeleteOrders = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No order ids provided' });
    }

    const objectIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const orderIds = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));

    const query = { $or: [] };
    if (objectIds.length) query.$or.push({ _id: { $in: objectIds } });
    if (orderIds.length) query.$or.push({ orderId: { $in: orderIds } });

    if (query.$or.length === 0) {
      return res.status(400).json({ message: 'No valid order ids provided' });
    }

    // Branch Security: non-admins can only delete orders from their own branch
    if (req.admin?.role !== 'Admin') {
      if (!req.admin?.branchId) return res.status(403).json({ message: 'No branch assigned' });
      query.branchId = req.admin.branchId;
    }

    const result = await Order.deleteMany(query);

    res.json({
      message: `${result.deletedCount} order(s) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get return requests for Admin/Staff (Central control)
// @route   GET /api/orders/admin/returns
// @access  Private (Admin/Staff)
export const getReturnRequests = async (req, res) => {
  try {
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const pageNumber = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();
    const includeStats = req.query.includeStats === 'true';
    let query = { 'returnRequest.isRequested': true };

    // Branch Security: Staff only see their branch returns
    if (req.admin?.role !== 'Admin') {
      if (!req.admin?.branchId) return res.status(403).json({ message: 'No branch assigned' });
      query.branchId = req.admin.branchId;
    }

    if (status && status.toLowerCase() !== 'all') {
      const rawStatuses = status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const normalizedStatuses = rawStatuses.map(
        (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
      );

      const expandedStatuses = normalizedStatuses.flatMap((s) => {
        if (s === 'Approved') return ['Approved', 'Accepted'];
        if (s === 'Accepted') return ['Accepted', 'Approved'];
        return [s];
      });

      const uniqueStatuses = [...new Set(expandedStatuses)];
      query['returnRequest.status'] = uniqueStatuses.length === 1
        ? uniqueStatuses[0]
        : { $in: uniqueStatuses };
    }

    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { user: { $in: matchingUsers } }
      ];
    }

    const returnsQuery = Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name category image')
      .populate('branchId', 'name address')
      .populate('vendor', 'storeName address')
      .sort({ 'returnRequest.requestDate': -1 })
      .lean();

    if (hasPagination) {
      const total = await Order.countDocuments(query);
      const returns = await returnsQuery
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(pageNumber));
      res.set('X-Limit', String(limitNumber));
      res.set('X-Total-Pages', String(Math.ceil(total / limitNumber) || 1));

      if (includeStats) {
        const baseStatsQuery = { 'returnRequest.isRequested': true };
        if (req.admin.role !== 'Admin') {
          baseStatsQuery.branchId = req.admin.branchId;
        }
        if (search) {
          const matchingUsers = await User.find({
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } }
            ]
          }).distinct('_id');
          baseStatsQuery.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { user: { $in: matchingUsers } }
          ];
        }

        const [pending, accepted, approved, rejected, finalRejected] = await Promise.all([
          Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': 'Pending' }),
          Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': 'Accepted' }),
          Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': 'Approved' }),
          Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': 'Rejected' }),
          Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': 'FinalRejected' })
        ]);

        return res.json({
          returns,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber) || 1
          },
          stats: {
            total: pending + accepted + approved + rejected + finalRejected,
            pending,
            approved: accepted + approved,
            rejected: rejected + finalRejected
          }
        });
      }

      return res.json(returns);
    }

    const returns = await returnsQuery;

    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all orders for a specific vendor
// @route   GET /api/vendors/orders
// @access  Private (Vendor)
export const getVendorOrders = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const { status, search } = req.query;

    let query = { vendor: vendorId };

    if (status && status !== 'All') {
      query.status = status.toLowerCase();
    }

    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'shippingAddress.name': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('deliveryPartnerId', 'name phone profileImage vehicleType vehicleNumber')
      .populate('items.product', 'name image unitValue unitType')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Lookup a single vendor order by tracking / order ID
// @route   GET /api/vendors/orders/lookup?trackingId=SG-xxx
// @access  Private (Vendor)
export const lookupVendorOrder = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const raw = (req.query.trackingId || req.query.search || '').trim();
    if (!raw) {
      return res.status(400).json({ message: 'Tracking ID is required' });
    }

    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const buildQuery = (filter) =>
      Order.findOne({ vendor: vendorId, ...filter })
        .populate('user', 'name email phone')
        .populate('deliveryPartnerId', 'name phone profileImage vehicleType vehicleNumber')
        .populate('items.product', 'name image unitValue unitType');

    let order = await buildQuery({ orderId: new RegExp(`^${escaped}$`, 'i') });
    if (!order) {
      order = await buildQuery({ orderId: new RegExp(escaped, 'i') });
    }
    if (!order && mongoose.Types.ObjectId.isValid(raw)) {
      order = await buildQuery({ _id: raw });
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update order status by vendor
// @route   PUT /api/vendors/orders/:id/status
// @access  Private (Vendor)
export const updateVendorOrderStatus = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const { status } = req.body;

    const allowedStatuses = ['preparing', 'ready_for_pickup', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update for vendor' });
    }

    const order = await Order.findOne({ _id: req.params.id, vendor: vendorId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    await order.save();

    res.json({ message: `Order status updated to ${status}`, order });

    // Auto-assign to nearest delivery partner if order is ready or preparing and lacks partner - DISABLED for manual assignment
    /*
    if (status === 'preparing' || status === 'ready_for_pickup') {
      triggerAutoAssignmentForOrder(order._id).catch(err => {
        console.error('[AutoAssign] Error in updateVendorOrderStatus background trigger:', err);
      });
    }
    */
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get return requests for vendor's own store orders ONLY
// @route   GET /api/vendor/returns
// @access  Private (Vendor)
export const getVendorReturnRequests = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();
    const includeStats = req.query.includeStats === 'true';

    // Find all vendor's product IDs for a broader product-level match
    const vendorProducts = await Product.find({ vendor: vendorId }).select('_id').lean();
    const vendorProductIds = vendorProducts.map(p => p._id);

    let query = {
      'returnRequest.isRequested': true,
      $or: [
        { vendor: vendorId },
        { 'items.product': { $in: vendorProductIds } }
      ]
    };

    if (status && status.toLowerCase() !== 'all') {
      const rawStatuses = status.split(',').map(s => s.trim()).filter(Boolean);
      const normalizedStatuses = rawStatuses.map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
      
      const expandedStatuses = normalizedStatuses.flatMap(s => {
        if (s === 'Approved') return ['Approved', 'Accepted'];
        if (s === 'Accepted') return ['Accepted', 'Approved'];
        return [s];
      });
      
      const uniqueStatuses = [...new Set(expandedStatuses)];
      query['returnRequest.status'] = uniqueStatuses.length === 1 
        ? uniqueStatuses[0] 
        : { $in: uniqueStatuses };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      }).select('_id').lean();
      const userIds = matchingUsers.map(user => user._id);

      query.$or = [
        { orderId: searchRegex },
        { user: { $in: userIds } }
      ];
    }

    const total = await Order.countDocuments(query);
    const returns = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name category image')
      .sort({ 'returnRequest.requestDate': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    let stats = null;
    if (includeStats) {
      const baseStatsQuery = { 'returnRequest.isRequested': true, vendor: vendorId };
      const [pending, approved, rejected, completed] = await Promise.all([
        Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': 'Pending' }),
        Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': { $in: ['Accepted', 'Approved'] } }),
        Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': { $in: ['Rejected', 'FinalRejected'] } }),
        Order.countDocuments({ ...baseStatsQuery, 'returnRequest.status': 'Returned' })
      ]);
      stats = { total: pending + approved + rejected + completed, pending, approved, rejected, completed };
    }

    res.json({
      returns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const handleStoreReturnAction = async (req, res) => {
  try {
    const { action, rejectionReason } = req.body; // accepts "Accepted" or "Rejected"
    const allowedActions = ['Accepted', 'Rejected'];
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Use Accepted or Rejected.' });
    }
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Auth: Vendor owns order OR Staff belongs to the branch
    const isVendorOwner = req.vendor && order.vendor?.toString() === req.vendor._id?.toString();
    const isStaffForBranch = req.admin && (order.branchId?.toString() === req.admin.branchId?.toString() || req.admin.role === 'Admin');
    const isAdmin = req.admin?.role === "Admin";

    if (!isVendorOwner && !isStaffForBranch && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to manage returns for this store" });
    }

    // Role-based logic
    if (isAdmin) {
      // Admin makes the final call
      if (action === 'Accepted') {
        order.returnRequest.status = 'Approved';
        order.returnRequest.returnOTP = Math.floor(1000 + Math.random() * 9000).toString();
      } else {
        order.returnRequest.status = 'FinalRejected';
        order.status = 'delivered';
        order.returnRequest.rejectionReason = rejectionReason || "Rejected by admin";
        order.returnRequest.resolvedAt = new Date();
      }
    } else {
      // Store/Vendor/Staff makes a recommendation
      order.returnRequest.status = action; // "Accepted" or "Rejected"
      
      if (action === "Accepted") {
        // Generate OTP early if store accepts, or wait for admin approval?
        // Let's generate it now so it's ready, but admin still needs to assign partner.
        order.returnRequest.returnOTP = Math.floor(1000 + Math.random() * 9000).toString();
      } else {
        // If store rejects, we just keep the status as "Rejected"
        // Admin will see this and decide.
        order.returnRequest.rejectionReason = rejectionReason || "Rejected by store";
      }
    }

    await order.save();

    res.json({ 
      message: `Return ${action} successfully`, 
      order: {
        ...order.toObject(),
        returnOTP: (order.returnRequest.status === "Accepted" || order.returnRequest.status === "Approved") ? order.returnRequest.returnOTP : null
      } 
    });

    // Notify User of Return Action
    sendPushNotification(order.user, 'User', {
      title: `Return Request ${action === 'Approved' || action === 'Accepted' ? 'Accepted' : 'Rejected'}`,
      body: action === 'Rejected' 
        ? `Your return request for Order #${order.orderId} was rejected. Note: ${rejectionReason || 'Contact support for details.'}`
        : `Your return request for Order #${order.orderId} has been accepted. We will schedule a pickup shortly.`
    }, { orderId: order.orderId, status: order.returnRequest.status, type: 'return_update' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin batch creates a Return Pickup Run
// @route   POST /api/admin/returns/batch-schedule
// @access  Private (Admin)
export const createReturnBatch = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { partnerId, orderIds, destinationType, destinationId } = req.body;
    const normalizedOrderIds = Array.isArray(orderIds)
      ? [...new Set(orderIds.map((id) => String(id)))]
      : [];
    if (!partnerId || normalizedOrderIds.length === 0 || !destinationType || !destinationId) {
      return res.status(400).json({ message: 'partnerId, orderIds, destinationType, and destinationId are required' });
    }

    let createdRun = null;
    let totalRefundAmount = 0;

    await session.withTransaction(async () => {
      const partner = await DeliveryPartner.findById(partnerId).session(session);
      if (!partner || partner.authStatus !== 'Active' || partner.dutyStatus !== 'Online') {
        const err = new Error('Partner not found, inactive, or offline');
        err.statusCode = 400;
        throw err;
      }
      await assertPartnerCapacity(partner, normalizedOrderIds.length, session);

      const orders = await Order.find({ _id: { $in: normalizedOrderIds } }).session(session);
      if (orders.length !== normalizedOrderIds.length) {
        const err = new Error('Some orders not found');
        err.statusCode = 400;
        throw err;
      }

      totalRefundAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const ineligibleOrders = orders.filter((order) => {
        if (!order.returnRequest?.isRequested) return true;
        return !['Accepted', 'Approved'].includes(order.returnRequest.status);
      });

      if (ineligibleOrders.length > 0) {
        const err = new Error('Only accepted return requests can be batch scheduled');
        err.statusCode = 400;
        throw err;
      }

      const runId = `RET-RUN-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
      const now = new Date();
      const stops = orders.map((order, index) => ({
        order: order._id,
        stopSequence: index + 1,
        status: 'pending',
        pickupPoint: {
          street: order.shippingAddress?.street,
          city: order.shippingAddress?.city,
          location: order.shippingAddress?.location
        }
      }));

      const run = await DeliveryRun.create([{
        runId,
        deliveryPartner: partnerId,
        runType: 'return',
        destinationType,
        destinationId,
        destinationTypeModel: destinationType === 'branch' ? 'Branch' : 'Vendor',
        slotDate: now,
        orders: stops,
        status: 'assigned',
        assignedAt: now
      }], { session });

      for (const order of orders) {
        order.returnRequest.status = 'Scheduled';
        order.returnRequest.pickupPartnerId = partnerId;
        order.returnRequest.pickupScheduledAt = now;
        order.status = 'return_pickup_scheduled';
        await order.save({ session });
      }

      partner.activeRun = run[0]._id;
      partner.assignmentStatus = 'Busy';
      await partner.save({ session });
      createdRun = run[0];
    });

    res.json({ success: true, run: createdRun, scheduledCount: normalizedOrderIds.length });

    // Notify Partner of Return Batch
    if (createdRun) {
      sendPushNotification(partnerId, 'DeliveryPartner', {
        title: 'New Return Pickup Batch',
        body: `You have been assigned ${normalizedOrderIds.length} return pickups.`
      }, { 
        runId: createdRun._id.toString(), 
        type: 'return_batch',
        totalAmount: totalRefundAmount.toString(),
        paymentMethod: 'Return (Prepaid)'
      });
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};


// ─── ORDER TAGGING ────────────────────────────────────────────────────────────

const sanitizeTag = (tag) => tag.trim().replace(/\s+/g, ' ').toLowerCase();
const isValidTag = (tag) => /^[a-z0-9 -]+$/.test(tag) && tag.length >= 1 && tag.length <= 30;

// @desc    Set or update tag on an order
// @route   PUT /api/orders/:id/tag
// @access  Private (User)
export const setOrderTag = async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) return res.status(400).json({ message: 'Tag is required' });

    const sanitized = sanitizeTag(tag);
    if (!isValidTag(sanitized)) {
      return res.status(400).json({ message: 'Tag must be 1-30 characters and contain only letters, numbers, spaces, or hyphens' });
    }

    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.tag = sanitized;
    await order.save();
    res.json({ tag: order.tag });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove tag from an order
// @route   DELETE /api/orders/:id/tag
// @access  Private (User)
export const removeOrderTag = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.tag = null;
    await order.save();
    res.json({ message: 'Tag removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all unique tags for the logged-in user with order counts
// @route   GET /api/orders/tags
// @access  Private (User)
export const getUserTags = async (req, res) => {
  try {
    const results = await Order.aggregate([
      { $match: { user: req.user._id, tag: { $exists: true, $ne: null } } },
      { $group: { _id: { $toLower: '$tag' }, displayName: { $first: '$tag' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json(results.map(r => ({ tagName: r.displayName, orderCount: r.count })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get orders filtered by tag
// @route   GET /api/orders/by-tag/:tag
// @access  Private (User)
export const getOrdersByTag = async (req, res) => {
  try {
    const tag = req.params.tag;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { user: req.user._id, tag: { $regex: `^${tag}$`, $options: 'i' } };
    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('items.product', 'name images basePrice stock branchStocks lowStockThreshold')
        .populate('branchId', 'name')
        .populate('vendor', 'storeName')
        .lean(),
      Order.countDocuments(query)
    ]);

    res.json({ orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit feedback/rating for a completed order
// @route   POST /api/orders/:id/feedback
// @access  Private (User)
export const submitOrderFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({ message: 'Feedback can only be submitted for delivered orders.' });
    }

    if (order.feedback && order.feedback.rating) {
      return res.status(400).json({ message: 'Feedback has already been submitted for this order.' });
    }

    order.feedback = {
      rating: Number(rating),
      comment: comment || null,
      submittedAt: new Date()
    };

    await order.save();

    res.json({ message: 'Feedback submitted successfully', feedback: order.feedback });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
