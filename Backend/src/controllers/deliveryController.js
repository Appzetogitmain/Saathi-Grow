import DeliveryPartner from '../models/DeliveryPartner.js';
import OrderDelivery from '../models/OrderDelivery.js'; // Legacy
import DeliveryRun from '../models/DeliveryRun.js';
import axios from 'axios';
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import DeliveryLocation from '../models/DeliveryLocation.js';
import { syncPartnerAssignmentState } from '../services/deliveryCapacityService.js';
import CashCollection from '../models/CashCollection.js';
import { findOptimalSource } from '../services/locationService.js';
import { creditVendorWallet, debitVendorWallet, creditAdminWallet, debitAdminWallet } from './orderController.js';
import { sendPushNotification, notifyByBranchAndPermission } from '../services/notificationService.js';
import { processOrderDeliveryReferral } from '../services/referralService.js';

// @desc    Get delivery partner profile
// @route   GET /api/delivery/profile
// @access  Private (Rider)
export const getProfile = async (req, res) => {
    try {
        const partner = req.partner;
        if (!partner) {
            return res.status(404).json({ message: 'Delivery partner profile not found' });
        }
        res.json(partner);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update partner status (online/offline)
// @route   PATCH /api/delivery/status
// @access  Private (Rider)
export const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const partner = await DeliveryPartner.findByIdAndUpdate(
            req.partner._id,
            { dutyStatus: status === 'online' ? 'Online' : 'Offline' },
            { new: true }
        );
        res.json(partner);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update partner location
// @route   POST /api/delivery/location
// @access  Private (Rider)
export const updateLocation = async (req, res) => {
    try {
        const { longitude, latitude, accuracy, heading } = req.body;
        const lng = Number(longitude);
        const lat = Number(latitude);
        if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            return res.status(400).json({ message: 'Valid longitude and latitude are required' });
        }
        const location = {
            type: 'Point',
            coordinates: [lng, lat]
        };

        const partner = await DeliveryPartner.findByIdAndUpdate(
            req.partner._id,
            {
                currentLocation: location,
                locationUpdatedAt: new Date(),
                currentLocationAccuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
                currentHeading: Number.isFinite(Number(heading)) ? Number(heading) : null
            },
            { new: true }
        );

        // Track history
        await DeliveryLocation.create({
            deliveryPartner: partner._id,
            location
        });

        res.json({ message: 'Location updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get active/pending runs/orders for partner
// @route   GET /api/delivery/orders
// @access  Private (Rider)
export const getOrders = async (req, res) => {
    try {
        const partner = req.partner;
        if (!partner) return res.status(404).json({ message: 'Partner not found' });

        const { type, runType } = req.query; // type: pending, active, completed; runType: delivery, return

        const query = {
            deliveryPartner: partner._id
        };

        if (runType) query.runType = runType;

        if (type === 'active') {
            query.status = { $in: ['assigned', 'in_progress'] };
            const activeRuns = await DeliveryRun.find(query).populate({
                path: 'orders.order',
                populate: [
                    { path: 'user', select: 'name phone' },
                    { path: 'branchId', select: 'name address' },
                    { path: 'vendor', select: 'storeName address phone' }
                ]
            }).populate('branchId');

            return res.json(activeRuns);

        } else if (type === 'history') {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const { search, date } = req.query;

            query.status = { $in: ['completed', 'partial_complete'] };
            
            // Search filter for inner orders
            let orderMatch = {};
            if (search) {
                orderMatch.$or = [
                    { orderId: { $regex: search, $options: 'i' } }
                ];
            }

            if (date) {
                // Parse local date strictly to avoid UTC shifting
                const [year, month, day] = date.split('-').map(Number);
                const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
                const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
                
                query.$or = [
                    { createdAt: { $gte: startOfDay, $lte: endOfDay } },
                    { completedAt: { $gte: startOfDay, $lte: endOfDay } }
                ];
            }

            const totalCount = await DeliveryRun.countDocuments(query);
            const history = await DeliveryRun.find(query)
                .populate({ 
                    path: 'orders.order',
                    match: orderMatch,
                    populate: [
                        { path: 'user', select: 'name phone' },
                        { path: 'branchId', select: 'name address' },
                        { path: 'vendor', select: 'storeName address phone' }
                    ]
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            // Filter out runs that might have empty orders due to match
            const filteredHistory = history.filter(run => run.orders.some(o => o.order));

            return res.json({
                history: filteredHistory,
                pagination: {
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                    currentPage: page,
                    limit
                }
            });
        }

        res.json([]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single delivery run detail
// @route   GET /api/delivery/orders/:id
// @access  Private (Rider)
export const getDeliveryDetail = async (req, res) => {
    try {
        const run = await DeliveryRun.findById(req.params.id)
            .populate({
                path: 'orders.order',
                populate: [
                    { path: 'user', select: 'name phone' },
                    { path: 'branchId', select: 'name address phone location' },
                    { path: 'vendor', select: 'storeName address phone location' },
                    { path: 'items.product', select: 'name images price' }
                ]
            })
            .populate('branchId')
            .populate('vendor');

        if (!run) return res.status(404).json({ message: 'Delivery run not found' });
        res.json(run);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update delivery run/stop status (start run, pick up, deliver stop)
// @route   PATCH /api/delivery/orders/:id/status
// @access  Private (Rider)
export const updateDeliveryStatus = async (req, res) => {
    try {
        // Here, 'id' is the DeliveryRun _id
        // We will pass stopOrderId and new stopStatus for individual stops
        const { status, stopOrderId, stopStatus, otp } = req.body;
        const run = await DeliveryRun.findById(req.params.id);

        if (!run) return res.status(404).json({ message: 'Delivery run not found' });

        const partner = req.partner;

        // Firebase RTDB Tracking setup
        const { db } = await import('../config/firebase.js');

        // 1. Run Level Status Update
        if (status === 'in_progress' || status === 'assigned') {
            run.status = status;
        }

        // 2. Individual Stop Status Updates
        if (stopOrderId && stopStatus) {
            const stopIndex = run.orders.findIndex(s => s.order.toString() === stopOrderId.toString());
            if (stopIndex === -1) return res.status(404).json({ message: 'Stop not found in run' });

            const stop = run.orders[stopIndex];
            const order = await Order.findById(stopOrderId);
            if (!order) return res.status(404).json({ message: 'Order not found' });

            // -- DELIVERY RUN LOGIC --
            if (run.runType === 'delivery') {
                if (stopStatus === 'delivered') {
                    if (stop.deliveryOTP && stop.deliveryOTP !== otp) {
                        stop.otpAttempts += 1;
                        await run.save();
                        return res.status(400).json({ message: 'Invalid OTP', attempts: stop.otpAttempts });
                    }
                    stop.status = 'delivered';
                    stop.deliveredAt = Date.now();
                    order.status = 'delivered';
                    order.deliveryTimestamps ||= {};
                    order.deliveryTimestamps.deliveredAt ||= new Date();
                    if (order.paymentMethod === 'cod') {
                        order.paymentStatus = 'paid';
                    }
                    await order.save();

                    // Notify Admin about Delivery
                    notifyByBranchAndPermission(
                        order.branchId,
                        'orders.view',
                        'Order Delivered! ✅',
                        `Order #${order.orderId} has been successfully delivered by ${partner.name}.`,
                        { orderId: order._id.toString(), type: 'delivery_status_update' }
                    );

                    // Notify User about Delivery
                    sendPushNotification(order.user, 'User', {
                        title: 'Order Delivered! 🛍️',
                        body: `Your order #${order.orderId} has been successfully delivered by ${partner.vehicleNumber}. Enjoy your purchase!`
                    }, { orderId: order._id.toString(), type: 'order_delivered' });
                    if (order.vendor) {
                        await creditVendorWallet(order);
                        await creditAdminWallet(order);
                    } else if (order.branchId) {
                        await creditAdminWallet(order);
                    }

                    try {
                        await processOrderDeliveryReferral(order);
                    } catch (refErr) {
                        console.error('[REFERRAL_DELIVERY_STOP_ERR]', refErr);
                    }

                    if (order.paymentMethod?.toLowerCase() === 'cod') {
                        partner.cashInHand = (partner.cashInHand || 0) + order.totalAmount;
                        await partner.save();
                        await CashCollection.create({
                            deliveryPartner: partner._id,
                            order: order._id,
                            amount: order.totalAmount,
                            status: 'collected'
                        });

                        // Notify Partner about Collection
                        sendPushNotification(partner._id, 'DeliveryPartner', {
                            title: 'Cash Collected! 💰',
                            body: `You have collected ₹${order.totalAmount} for Order #${order.orderId}.`
                        }, { orderId: order._id.toString(), type: 'cash_collection' });
                    }
                    partner.currentStopIndex += 1;
                    await partner.save();
                } else if (stopStatus === 'out_for_delivery') {
                    stop.status = 'out_for_delivery';
                    order.status = 'out_for_delivery';
                    await order.save();
                }
            } 
            // -- RETURN RUN LOGIC --
            else if (run.runType === 'return') {
                if (stopStatus === 'picked_up') {
                    // SECURE PICKUP: Verification OTP
                    if (order.returnRequest.returnOTP && order.returnRequest.returnOTP !== otp) {
                        return res.status(400).json({ message: 'Invalid Return OTP. Please ask the customer for the code.' });
                    }

                    stop.status = 'picked_up';
                    stop.pickedUpAt = Date.now();
                    order.status = 'return_picked_up';
                    order.returnRequest.status = 'PickedUp';
                    order.returnRequest.pickedUpAt = Date.now();
                    await order.save();

                    // Notify User about Pickup
                    sendPushNotification(order.user, 'User', {
                        title: 'Return Item Picked Up! 📦',
                        body: `Our partner has picked up your return request for order #${order.orderId}.`
                    }, { orderId: order._id.toString(), type: 'return_picked_up' });
                    partner.currentStopIndex += 1;
                    await partner.save();
                }
            }

            if (stopStatus === 'failed') {
                stop.status = 'failed';
                stop.failedAt = Date.now();
                partner.currentStopIndex += 1;
                await partner.save();
            }
        }

        const isReturnRun = run.runType === 'return';
        const allStopsDone = run.orders.length > 0 && run.orders.every(o => isReturnRun ? o.status === 'picked_up' : (o.status === 'delivered' || o.status === 'failed'));

        // Finalize completed run (All types)
        if (status === 'completed' || allStopsDone) {
            run.status = run.orders.some(o => o.status === 'failed') ? 'partial_complete' : 'completed';
            run.completedAt = Date.now();

            // Special logic for returns: Mark all successfully picked up orders as fully RETURNED
            if (run.runType === 'return') {
                // Import incrementStock from orderController
                const { incrementStock } = await import('./orderController.js');

                for (const stop of run.orders) {
                    if (stop.status === 'picked_up') {
                        const order = await Order.findById(stop.order);
                        if (order) {
                            order.status = 'returned';
                            order.returnRequest.status = 'Returned';
                            order.returnRequest.resolvedAt = new Date();
                            
                            // RESTORE STOCK (Now done here upon reaching store)
                            await incrementStock(order);

                            // REFUND LOGIC & VENDOR DEBIT
                            if (order.paymentStatus === 'paid') {
                                const User = (await import('../models/User.js')).default;
                                const user = await User.findById(order.user);
                                if (user) {
                                    user.walletBalance = (user.walletBalance || 0) + order.totalAmount;
                                    await user.save();
                                    const UserTransaction = (await import('../models/UserTransaction.js')).default;
                                    await UserTransaction.create({
                                        user: user._id,
                                        amount: order.totalAmount,
                                        type: 'credit',
                                        category: 'order_refund',
                                        status: 'completed',
                                        description: `Refund for Returned Order #${order.orderId}`,
                                        orderId: order._id
                                    });

                                    // Notify User about Refund
                                    sendPushNotification(user._id, 'User', {
                                        title: 'Refund Credited! 💸',
                                        body: `₹${order.totalAmount} has been credited to your wallet for returned order #${order.orderId}.`
                                    }, { orderId: order._id.toString(), type: 'refund_credited' });
                                }
                                order.paymentStatus = 'refunded';
                            }
                            if (order.vendor) {
                                await debitVendorWallet(order);
                                await debitAdminWallet(order);
                            } else if (order.branchId) {
                                await debitAdminWallet(order);
                            }
                            await order.save();
                        }
                    }
                }
            }

            if (db) {
                const trackingRef = db.ref(`active_trackings/${run._id}`);
                trackingRef.remove().catch(err => console.error('[FIREBASE] Error removing tracking ref:', err));
            }

            await syncPartnerAssignmentState(partner, null, run._id);
        }

        await run.save();
        res.json(run);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get cash collection and handover history
// @route   GET /api/delivery/wallet
// @access  Private (Rider)
export const getWallet = async (req, res) => {
    try {
        const partner = req.partner;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const totalCount = await CashCollection.countDocuments({ deliveryPartner: partner._id });
        const history = await CashCollection.find({ deliveryPartner: partner._id })
            .populate('order', 'orderId totalAmount')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            cashInHand: partner.cashInHand || 0,
            history,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create/Update delivery partner profile
// @route   POST /api/delivery/profile
// @access  Private (User with rider role)
export const createProfile = async (req, res) => {
    try {
        const { vehicleType, vehicleNumber, bankDetails } = req.body;

        let partner = await DeliveryPartner.findOne({ user: req.user._id });

        if (partner) {
            partner.vehicleType = vehicleType || partner.vehicleType;
            partner.vehicleNumber = vehicleNumber || partner.vehicleNumber;
            partner.bankDetails = bankDetails || partner.bankDetails;
            await partner.save();
        } else {
            partner = await DeliveryPartner.create({
                user: req.user._id,
                vehicleType,
                vehicleNumber,
                bankDetails
            });
        }

        res.status(201).json(partner);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get dashboard summary statistics
// @route   GET /api/delivery/stats
// @access  Private (Rider)
export const getDashboardStats = async (req, res) => {
    try {
        const partner = req.partner;
        if (!partner) return res.status(404).json({ message: 'Partner not found' });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [pendingDeliveries, pendingReturns, activeRuns] = await Promise.all([
            Order.countDocuments({ 
                status: 'ready_for_pickup', 
                deliveryRunId: { $exists: false } 
            }),
            Order.countDocuments({ 
                'returnRequest.isRequested': true, 
                'returnRequest.status': { $in: ['Accepted', 'Approved'] },
                'returnRequest.pickupPartnerId': { $exists: false }
            }),
            DeliveryRun.find({
                deliveryPartner: partner._id,
                status: { $in: ['assigned', 'in_progress'] }
            })
        ]);

        const pendingTotal = pendingDeliveries + pendingReturns;

        // Today's completed tasks (delivered orders + picked up returns)
        const completedRuns = await DeliveryRun.find({
            deliveryPartner: partner._id,
            status: { $in: ['completed', 'partial_complete'] },
            updatedAt: { $gte: today }
        });

        let todayDeliveries = 0;
        completedRuns.forEach(run => {
            todayDeliveries += run.orders.filter(o => ['delivered', 'picked_up'].includes(o.status)).length;
        });

        // Current active stops
        let activeOrders = 0;
        activeRuns.forEach(run => {
            activeOrders += run.orders.filter(o => ['pending', 'out_for_delivery'].includes(o.status)).length;
        });

        // Today's collected cash
        const todayEarnings = await CashCollection.aggregate([
            {
                $match: {
                    deliveryPartner: partner._id,
                    status: 'collected',
                    createdAt: { $gte: today }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        res.json({
            walletBalance: partner.cashInHand || 0, // Sending cashInHand as walletBalance for frontend compatibility
            totalEarnings: 0, // Earnings are handled physically by admin
            todayEarnings: todayEarnings[0]?.total || 0,
            pendingOrders: pendingTotal,
            todayDeliveries,
            status: partner.dutyStatus,
            activeOrders,
            returnPickups: pendingReturns 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Simulate a new order for testing notifications
// @route   POST /api/delivery/simulate-order
// @access  Public (For testing)
export const simulateOrder = async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return res.status(404).json({ message: 'Route not found' });
        }

        // Find a random user to be the customer
        const User = (await import('../models/User.js')).default;
        const customer = await User.findOne({ role: 'user' });

        if (!customer) return res.status(404).json({ message: 'No customer found to simulate order' });

        const shippingAddress = {
            street: 'Vijay Nagar, Scheme No. 54',
            city: 'Indore',
            state: 'MP',
            location: { type: 'Point', coordinates: [75.8948, 22.7533] } // Real Indore coordinates for test
        };

        // For simulation, find a real product to check stock against
        const Product = (await import('../models/Product.js')).default;
        const randomProduct = await Product.findOne({ status: 'Active' });
        const items = randomProduct ? [{ product: randomProduct._id, quantity: 1 }] : [];

        const optimalSource = await findOptimalSource(shippingAddress.location.coordinates, items);

        const newOrder = await Order.create({
            orderId: 'SIM-' + Math.floor(Math.random() * 10000),
            user: customer._id,
            totalAmount: 500,
            status: 'pending',
            paymentMethod: 'cod',
            shippingAddress,
            branchId: optimalSource?.type === 'branch' ? optimalSource.id : undefined,
            vendor: optimalSource?.type === 'vendor' ? optimalSource.id : undefined
        });

        const delivery = await OrderDelivery.create({
            order: newOrder._id,
            status: 'pending',
            deliveryFee: 45
        });

        // Emit socket event (io is exported from app.js)
        const { io } = await import('../app.js');
        io.emit('new_order', {
            id: delivery._id,
            orderId: newOrder.orderId,
            customerName: customer.name,
            amount: newOrder.totalAmount,
            address: newOrder.shippingAddress.street,
            branchLocation: optimalSource?.location,
            customerLocation: shippingAddress.location.coordinates
        });

        res.json({ message: 'Order simulated successfully', delivery });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Route Directions via Google Maps API
// @route   GET /api/delivery/route
// @access  Private (Rider)
export const getRouteDirections = async (req, res) => {
    try {
        const { origin, destination } = req.query;
        if (!origin || !destination) {
            return res.status(400).json({ message: 'Origin and destination coordinates are required' });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API;
        if (!apiKey) {
            return res.status(500).json({ message: 'Google Maps API is not configured on the server' });
        }

        console.log(`🗺️ Fetching Route: Origin ${origin}, Destination ${destination}`);
        const mapUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`;

        const response = await axios.get(mapUrl);

        if (response.data.status !== "OK") {
            console.error('❌ Google Maps Error:', response.data.status, response.data.error_message);
            return res.status(400).json({ message: response.data.error_message || "Failed to fetch directions" });
        }

        console.log(`✅ Route fetched successfully: ${response.data.routes.length} routes found`);
        res.json({ routes: response.data.routes });
    } catch (error) {
        console.error('getRouteDirections error:', error);
        res.status(500).json({ message: 'Error fetching directions from Google Maps' });
    }
};



// @desc    Export full delivery history as a pure CSV file (mobile-safe)
// @route   GET /api/delivery/history/export
// @access  Private (Rider) — token passed as query param for direct-URL downloads
export const exportHistory = async (req, res) => {
    try {
        const partner = req.partner;
        if (!partner) return res.status(404).json({ message: 'Partner not found' });

        const { date } = req.query;

        const query = {
            deliveryPartner: partner._id,
            status: { $in: ['completed', 'partial_complete'] }
        };

        if (date) {
            const [year, month, day] = date.split('-').map(Number);
            const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
            const endOfDay   = new Date(year, month - 1, day, 23, 59, 59, 999);
            query.$or = [
                { createdAt:   { $gte: startOfDay, $lte: endOfDay } },
                { completedAt: { $gte: startOfDay, $lte: endOfDay } }
            ];
        }

        const runs = await DeliveryRun.find(query)
            .populate({
                path: 'orders.order',
                populate: [{ path: 'user', select: 'name phone' }]
            })
            .sort({ createdAt: -1 });

        // Build pure CSV rows
        const header = 'Order ID,Date,Time,Customer,Phone,Location,Status,Amount (INR),Payment Method';
        const rows = [];

        for (const run of runs) {
            for (const stop of run.orders) {
                if (!stop.order) continue;
                const o = stop.order;
                const ts = new Date(stop.deliveredAt || stop.failedAt || run.completedAt || run.createdAt);
                const escape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
                rows.push([
                    escape(o.orderId || o._id),
                    escape(ts.toLocaleDateString('en-IN')),
                    escape(ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })),
                    escape(o.user?.name || 'Customer'),
                    escape(o.user?.phone || ''),
                    escape(o.shippingAddress?.street || ''),
                    escape(stop.status === 'delivered' ? 'Delivered' : (stop.status === 'failed' ? 'Failed' : stop.status)),
                    escape(o.totalAmount || 0),
                    escape((o.paymentMethod || 'online').toUpperCase())
                ].join(','));
            }
        }

        const csvBody = header + '\n' + rows.join('\n');

        // UTF-8 BOM + strict mobile headers
        const BOM = '\uFEFF';
        const fileName = `delivery_history_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.status(200).send(BOM + csvBody);
    } catch (error) {
        console.error('[exportHistory] error:', error);
        res.status(500).json({ message: error.message });
    }
};


// End of Delivery Controller

