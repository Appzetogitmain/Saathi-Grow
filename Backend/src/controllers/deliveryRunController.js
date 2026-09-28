import DeliveryRun from '../models/DeliveryRun.js';
import Order from '../models/Order.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import DeliverySlot from '../models/DeliverySlot.js';
import mongoose from 'mongoose';
import { sendPushNotification } from '../services/notificationService.js';
import { assertPartnerCapacity, syncPartnerAssignmentState } from '../services/deliveryCapacityService.js';
import { getZonedDateParts, DEFAULT_DELIVERY_TIMEZONE, isValidDeliveryDate, getDeliverySettings } from '../services/deliveryTimingService.js';

// Google Maps setup for route optimization
import axios from 'axios';

/**
 * @desc    Get unassigned orders grouped by Slot (and Immediate)
 * @route   GET /api/admin/delivery/run/orders-by-slot
 * @access  Private (Admin/Manager)
 */
export const getOrdersBySlot = async (req, res) => {
  try {
    const admin = req.admin;
    const vendor = req.vendor;
    const { date, branchId } = req.query;

    // Delivery dates are calendar dates in the configured delivery timezone.
    const settings = await getDeliverySettings();
    const timezone = settings.deliveryTimezone || DEFAULT_DELIVERY_TIMEZONE;
    const queryDate = date || getZonedDateParts(new Date(), timezone).date;
    if (!isValidDeliveryDate(queryDate)) {
      return res.status(400).json({ message: 'Date must be a valid date in YYYY-MM-DD format.' });
    }
    const startOfDay = new Date(`${queryDate}T00:00:00.000Z`);
    const endOfDay = new Date(startOfDay.getTime() + 86400000 - 1);

    // Build base query for orders
    const orderQuery = {
      status: { $in: ['confirmed', 'preparing', 'pending', 'ready_for_pickup'] },
      deliveryPartnerId: null, // Unassigned
    };
    const todayDate = getZonedDateParts(new Date(), timezone).date;
    if (queryDate === todayDate) {
      // Include pre-migration orders without a saved date in today's dispatch list.
      orderQuery.$or = [
        { 'deliveryWindowSnapshot.scheduledDate': queryDate },
        { 'deliveryWindowSnapshot.scheduledDate': null },
        { 'deliveryWindowSnapshot.scheduledDate': { $exists: false } }
      ];
    } else {
      orderQuery['deliveryWindowSnapshot.scheduledDate'] = queryDate;
    }

    if (vendor) {
      orderQuery.vendor = vendor._id;
    } else if (admin && admin.role !== 'Admin') {
      if (!admin.branchId) return res.status(403).json({ message: 'No branch assigned' });
      orderQuery.branchId = admin.branchId;
    } else if (branchId) {
      orderQuery.branchId = branchId;
    }

    // 1. Fetch unassigned orders matching criteria
    const orders = await Order.find(orderQuery)
      .populate('user', 'name phone')
      .populate('deliverySlotId')
      .sort({ createdAt: 1 });

    // 2. Fetch all active slots for the display
    const activeSlots = await DeliverySlot.find({ isActive: true }).sort({ startTime: 1 });

    // 3. Fetch existing Runs for today to show assignment progress
    const runQuery = {
      slotDate: { $gte: startOfDay, $lte: endOfDay }
    };
    if (orderQuery.vendor) runQuery.vendor = orderQuery.vendor;
    if (orderQuery.branchId) runQuery.branchId = orderQuery.branchId;

    const existingRuns = await DeliveryRun.find(runQuery)
      .populate('deliveryPartner', 'name phone vehicleType')
      .populate('deliverySlot');

    // 4. Grouping Data Structure
    const grouped = {
      immediate: {
        orders: [],
        count: 0,
        runs: existingRuns.filter(r => r.isImmediate)
      },
      slots: activeSlots.map(slot => ({
        slot: slot,
        orders: [],
        count: 0,
        runs: existingRuns.filter(r => r.deliverySlot && r.deliverySlot._id.toString() === slot._id.toString())
      }))
    };

    // 5. Populate groups
    orders.forEach(order => {
      // If no slot is selected, it's considered immediate
      if (order.isImmediate || !order.deliverySlotId) {
        grouped.immediate.orders.push(order);
        grouped.immediate.count++;
      } else {
        const slotGroup = grouped.slots.find(s => s.slot._id.toString() === order.deliverySlotId._id.toString());
        if (slotGroup) {
          slotGroup.orders.push(order);
          slotGroup.count++;
        }
      }
    });

    res.json(grouped);
  } catch (error) {
    console.error('getOrdersBySlot error:', error);
    res.status(500).json({ message: error.message || 'Error fetching grouped orders' });
  }
};

/**
 * @desc    Create a new Delivery Run (Batch Assignment)
 * @route   POST /api/admin/delivery/run/create
 * @access  Private (Admin)
 */
export const createDeliveryRun = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const admin = req.admin;
    const vendor = req.vendor;
    const { partnerId, slotId, slotDate, orderIds, branchId, optimizeRoute } = req.body;

    if (!partnerId || !orderIds || orderIds.length === 0) {
      throw new Error('Partner ID and Order IDs are required');
    }

    // 1. Validate Partner
    const partner = await DeliveryPartner.findById(partnerId).session(session);
    if (!partner) throw new Error('Delivery Partner not found');
    if (partner.authStatus !== 'Active') throw new Error('Partner is not active');
    if (partner.dutyStatus !== 'Online') throw new Error('Partner is currently offline');
    await assertPartnerCapacity(partner, orderIds.length, session);

    // 2. Validate Orders
    const orders = await Order.find({ _id: { $in: orderIds } })
      .populate('vendor', 'address')
      .populate('branchId', 'address')
      .session(session);

    if (orders.length !== orderIds.length) {
      throw new Error('One or more orders not found');
    }

    const scheduledDate = typeof slotDate === 'string' ? slotDate.slice(0, 10) : '';
    if (!isValidDeliveryDate(scheduledDate)) {
      throw new Error('A valid scheduled delivery date is required.');
    }
    const deliverySettings = await getDeliverySettings();
    const deliveryTimezone = deliverySettings.deliveryTimezone || DEFAULT_DELIVERY_TIMEZONE;
    const todayDate = getZonedDateParts(new Date(), deliveryTimezone).date;
    for (const order of orders) {
      const orderDate = order.deliveryWindowSnapshot?.scheduledDate;
      if (orderDate ? orderDate !== scheduledDate : scheduledDate !== todayDate) {
        throw new Error('All selected orders must be scheduled for the selected delivery date. Refresh the dispatch list and try again.');
      }
      const orderSlotId = order.deliverySlotId?._id || order.deliverySlotId;
      const orderIsImmediate = order.isImmediate || !orderSlotId;
      if (slotId ? (orderIsImmediate || String(orderSlotId) !== String(slotId)) : !orderIsImmediate) {
        throw new Error('All selected orders must belong to the selected delivery window. Refresh the dispatch list and try again.');
      }
    }

    // 2.1 Determine Start Point (Origin)
    // Runs usually start from a Branch or the first Vendor
    let origin = "";
    if (branchId) {
      const branch = await mongoose.model('Branch').findById(branchId);
      if (branch?.address?.location?.coordinates) {
        origin = `${branch.address.location.coordinates[1]},${branch.address.location.coordinates[0]}`;
      }
    }

    if (!origin && orders[0]) {
      const firstPickup = orders[0].vendor?.address?.location || orders[0].branchId?.address?.location;
      if (firstPickup?.coordinates) {
        origin = `${firstPickup.coordinates[1]},${firstPickup.coordinates[0]}`;
      }
    }

    // Build waypoints (destinations)
    const destinations = orders.map(o => {
      const loc = o.shippingAddress?.location;
      return loc?.coordinates ? `${loc.coordinates[1]},${loc.coordinates[0]}` : null;
    }).filter(Boolean);

    // Build a unique RUN ID
    const safeUniqueId = partner.uniqueId || partner._id.toString();
    const runIdString = `RUN-${Date.now().toString().slice(-6)}-${safeUniqueId.slice(-4)}`;

    // Build stops
    let waypointOrderArray = orders.map((_, i) => i); 
    let polyline = null;
    let totalDist = 0;
    let totalDur = 0;

    // 2.2 Call Google Maps API for optimization
    if (optimizeRoute && origin && destinations.length > 0) {
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API;
        if (apiKey) {
          const waypointsParam = destinations.slice(0, -1).join('|');
          const destinationParam = destinations[destinations.length - 1];
          const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destinationParam}&waypoints=optimize:true|${waypointsParam}&key=${apiKey}`;
          
          const response = await axios.get(url);
          if (response.data.status === 'OK' && response.data.routes.length > 0) {
            const route = response.data.routes[0];
            waypointOrderArray = route.waypoint_order; 
            // waypoint_order doesn't include origin/destination. 
            // Google's optimize:true reorders waypoints.
            // We need to adjust our orders list based on this.
            polyline = route.overview_polyline.points;
            
            // Calculate totals
            route.legs.forEach(leg => {
              totalDist += leg.distance.value;
              totalDur += leg.duration.value;
            });
          }
        }
      } catch (err) {
        console.error('Google Route Optimization Failed:', err.message);
        // Fallback to default order
      }
    }

    // If waypointOrderArray is empty or mismatched (e.g. single order), fall back to default sequence
    const safeWaypointOrder = (waypointOrderArray && waypointOrderArray.length === orders.length)
      ? waypointOrderArray
      : orders.map((_, i) => i);

    const orderedStops = safeWaypointOrder.map((originalIndex, seqIndex) => {
      const orderDoc = orders[originalIndex];
      return {
        order: orderDoc._id,
        stopSequence: seqIndex + 1,
        status: 'pending',
        deliveryOTP: Math.floor(1000 + Math.random() * 9000).toString()
      };
    });

    // 3. Create the DeliveryRun
    const run = new DeliveryRun({
      runId: runIdString,
      deliveryPartner: partner._id,
      deliverySlot: slotId || null,
      slotDate: new Date(`${scheduledDate}T00:00:00.000Z`),
      isImmediate: !slotId,
      branchId: branchId || null,
      vendor: vendor ? vendor._id : null,
      orders: orderedStops,
      status: 'assigned',
      assignedAt: new Date(),
      optimizedRoute: {
        waypointOrder: waypointOrderArray,
        encodedPolyline: polyline,
        totalDistanceMeters: totalDist,
        totalDurationSeconds: totalDur
      }
    });

    await run.save({ session });

    // 4. Update Orders
    for (const order of orders) {
      const stopConfig = orderedStops.find(s => s.order.toString() === order._id.toString());

      order.deliveryRunId = run._id;
      order.deliveryPartnerId = partner._id;
      order.stopSequence = stopConfig.stopSequence;
      order.deliveryOTP = stopConfig.deliveryOTP;

      if (['pending', 'confirmed'].includes(order.status)) {
        order.status = 'preparing';
      }

      order.deliveryTimestamps = { assignedAt: new Date(), pickedUpAt: null, deliveredAt: null };

      await order.save({ session });
    }

    // 5. Update Partner
    partner.assignmentStatus = 'Busy';
    partner.activeRun = run._id;
    partner.currentStopIndex = 0;
    await partner.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Calculate total amount and payment method label for the run
    const totalRunAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const codCount = orders.filter(o => o.paymentMethod?.toLowerCase() === 'cod').length;
    const onlineCount = orders.length - codCount;
    const paymentMethodLabel = codCount > 0 ? (onlineCount > 0 ? 'Mixed' : 'COD') : 'Online';

    // Notify the Delivery Partner (Push)
    sendPushNotification(partner._id, 'DeliveryPartner', {
      title: 'New Delivery Run Assigned! 🛵',
      body: `You have been assigned a new delivery run ${run.runId} with ${orders.length} orders.`
    }, { 
      runId: run._id.toString(), 
      type: 'run_assignment',
      totalAmount: totalRunAmount.toString(),
      paymentMethod: paymentMethodLabel
    });

    res.status(201).json({ message: 'Delivery Run created successfully', run });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      console.error('Abort transaction error:', abortErr);
    }
    session.endSession();
    console.error('Create run error:', error);
    res.status(400).json({ message: error.message || 'Transaction Failed' });
  }
};

/**
 * @desc    Get all Delivery Runs
 * @route   GET /api/admin/delivery/run
 * @access  Private
 */
export const getAllDeliveryRuns = async (req, res) => {
  try {
    const admin = req.admin;
    const vendor = req.vendor;
    const { status, date } = req.query;

    let query = {};
    if (vendor) {
      query.vendor = vendor._id;
    } else if (admin && admin.role !== 'Admin') {
      if (admin.branchId) query.branchId = admin.branchId;
    }

    if (status) query.status = status;
    if (date) {
      if (!isValidDeliveryDate(date)) return res.status(400).json({ message: 'Date must be a valid date in YYYY-MM-DD format.' });
      const d = new Date(`${date}T00:00:00.000Z`);
      const e = new Date(d.getTime() + 86400000 - 1);
      query.slotDate = { $gte: d, $lte: e };
    }

    const runs = await DeliveryRun.find(query)
      .populate('deliveryPartner', 'name phone vehicleType profileImage')
      .populate('deliverySlot')
      .populate({
        path: 'orders.order',
        select: 'orderId totalAmount status shippingAddress'
      })
      .sort({ createdAt: -1 });

    res.json(runs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Get Single Run details
 * @route   GET /api/admin/delivery/run/:id
 * @access  Private
 */
export const getDeliveryRunById = async (req, res) => {
  try {
    const run = await DeliveryRun.findById(req.params.id)
      .populate('deliveryPartner')
      .populate('deliverySlot')
      .populate({
        path: 'orders.order',
        populate: [
          { path: 'user', select: 'name phone email' },
          { path: 'branchId' },
          { path: 'vendor' }
        ]
      });

    if (!run) return res.status(404).json({ message: 'Run not found' });

    res.json(run);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Cancel an entire run and unassign orders
 * @route   DELETE /api/admin/delivery/run/:id
 * @access  Private
 */
export const cancelDeliveryRun = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const run = await DeliveryRun.findById(req.params.id).session(session);
    if (!run) throw new Error('Run not found');

    if (['completed', 'partial_complete'].includes(run.status)) {
      throw new Error('Cannot cancel a completed run');
    }

    // Remove run links from orders
    for (const stop of run.orders) {
      if (stop.status === 'pending') {
        await Order.findByIdAndUpdate(stop.order, {
          deliveryRunId: null,
          deliveryPartnerId: null,
          stopSequence: null,
          deliveryOTP: null,
          status: 'confirmed'
        }, { session });
      }
    }

    // Keep another active run focused when this partner has multiple assignments.
    const partner = await DeliveryPartner.findById(run.deliveryPartner).session(session);
    // Update run status
    run.status = 'cancelled';
    run.cancelledAt = new Date();
    run.cancelledBy = req.admin ? req.admin._id : (req.vendor ? req.vendor._id : null);
    await run.save({ session });
    if (partner) await syncPartnerAssignmentState(partner, session, run._id);

    await session.commitTransaction();
    session.endSession();

    // Notify the Delivery Partner (Push)
    if (partner) {
      sendPushNotification(partner._id, 'DeliveryPartner', {
        title: 'Delivery Run Cancelled ❌',
        body: `Your delivery run ${run.runId} has been cancelled.`
      }, { runId: run._id.toString(), type: 'run_cancelled' });
    }

    res.json({ message: 'Delivery run cancelled and orders freed up' });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      console.error('Abort transaction error:', abortErr);
    }
    session.endSession();
    res.status(400).json({ message: err.message });
  }
};
