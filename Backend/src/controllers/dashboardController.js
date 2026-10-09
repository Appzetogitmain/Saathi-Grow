import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import Wallet from '../models/Wallet.js';
import mongoose from 'mongoose';

// @desc    Get dashboard analytics (Global or Branch-scoped)
// @route   GET /api/dashboard/stats
// @access  Private (Admin, Store Manager, Staff)
export const getDashboardStats = async (req, res) => {
  try {
    const { role, branchId } = req.admin;
    let query = {};

    // For staff/managers, ensure branchId is an ObjectId for direct queries
    const branchObjectId = (role !== 'Admin' && branchId) ? new mongoose.Types.ObjectId(branchId) : null;

    // Branch Scoping: If not Super Admin, strictly filter by branchId
    if (role !== 'Admin') {
      if (!branchId) {
        return res.status(403).json({ success: false, message: 'You are not assigned to any branch. Access denied to dashboard.' });
      }
      query.branchId = branchObjectId; // Use ObjectId for all queries
    }

    const complaintStoreFilterForCount = role === 'Admin' ? {} : { store: branchObjectId };

    // 1. STATS: Revenue, Orders, Products, Users, Low Stock, Riders
    const [
      revenueResult,
      prevRevenueResult,
      totalOrders,
      prevTotalOrders,
      pendingOrders,
      totalProducts,
      totalUsers,
      recentOrders,
      pendingTickets,
      lowStockCount,
      activeRiders,
      channelSplit
    ] = await Promise.all([
      // Total Revenue (Current 30 Days)
      Order.aggregate([
        { $match: { ...query, $or: [{ paymentStatus: 'paid' }, { status: 'delivered' }], createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // Prev Revenue (Previous 30 Days)
      Order.aggregate([
        { $match: { ...query, $or: [{ paymentStatus: 'paid' }, { status: 'delivered' }], createdAt: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      // Total Orders (Current 30 Days)
      Order.countDocuments({ ...query, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      // Prev Total Orders
      Order.countDocuments({ ...query, createdAt: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      // Pending Orders (Current 30 Days - aligned with totalOrders window)
      Order.countDocuments({ ...query, status: 'pending', createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      // Total Products
      role === 'Admin' ? Product.countDocuments() : Product.countDocuments({ 'branchStocks.branchId': branchObjectId }),
      // Users (Scoped to branch customers if not Admin)
      role === 'Admin'
        ? User.countDocuments({ role: 'user' })
        : Order.distinct('user', { branchId: branchObjectId, user: { $ne: null } }).then(users => users.length),
      // Recent Orders
      Order.find(query)
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .limit(5),
      // Tickets - Detailed Breakdown
      Complaint.aggregate([
        { $match: { ...complaintStoreFilterForCount, status: { $ne: 'CLOSED' } } },
        {
          $group: {
            _id: null,
            actionRequired: {
              $sum: { $cond: [{ $in: ["$status", ["ESCALATED_TO_STORE", "OVERDUE"]] }, 1, 0] }
            },
            totalActive: { $sum: 1 }
          }
        }
      ]),
      // Low Stock
      role === 'Admin'
        ? Product.aggregate([
          { $match: { status: { $ne: 'Draft' } } },
          {
            $project: {
              isLow: {
                $or: [
                  {
                    $and: [
                      { $gt: ["$vendor", null] },
                      { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 10] }] }
                    ]
                  },
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: { $ifNull: ["$branchStocks", []] },
                            as: "bs",
                            cond: { $lte: ["$$bs.stock", { $ifNull: ["$$bs.lowStockThreshold", 10] }] }
                          }
                        }
                      }, 0
                    ]
                  }
                ]
              }
            }
          },
          { $match: { isLow: true } },
          { $count: "count" }
        ])
        : Product.aggregate([
          { $match: { status: { $ne: 'Draft' } } },
          { $unwind: "$branchStocks" },
          {
            $match: {
              "branchStocks.branchId": branchObjectId,
              $expr: { $lte: ["$branchStocks.stock", { $ifNull: ["$branchStocks.lowStockThreshold", 10] }] }
            }
          },
          { $count: "count" }
        ]),
      // Active Riders (Hiding for non-admin/managers as they are global)
      role === 'Admin' || role === 'Store Manager'
        ? DeliveryPartner.countDocuments({ status: 'Online', assignmentStatus: 'Free' })
        : Promise.resolve(0),
      // Channel Split
      Order.aggregate([
        { $match: { ...query, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: '$orderSource', count: { $sum: 1 } } }
      ])
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    const prevRevenue = prevRevenueResult.length > 0 ? prevRevenueResult[0].total : 0;

    // Growth Calculations (Prevent NaN by checking zero cases)
    const revenueGrowth = prevRevenue <= 0 ? (totalRevenue > 0 ? 100 : 0) : ((totalRevenue - prevRevenue) / prevRevenue) * 100;
    const orderGrowth = prevTotalOrders <= 0 ? (totalOrders > 0 ? 100 : 0) : ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100;

    // 2. REVENUE CHART DATA (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const revenueHistory = await Order.aggregate([
      {
        $match: {
          ...query,
          $or: [{ paymentStatus: 'paid' }, { status: 'delivered' }],
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const finalRevenueHistory = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const match = revenueHistory.find(h => h._id === dateStr);
      finalRevenueHistory.push({
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dateStr,
        revenue: match ? match.revenue : 0,
        orders: match ? match.orders : 0
      });
    }

    const finalLowStockCount = lowStockCount[0]?.count || 0;

    const permissions = req.admin.permissions || [];
    const isSuperAdmin = role === 'Admin';
    const isStoreManager = role === 'Store Manager';

    const canViewOrders = isSuperAdmin || isStoreManager || permissions.includes('VIEW_ORDERS');
    const canViewRevenue = isSuperAdmin || isStoreManager || permissions.includes('MANAGE_POS_BILLING');
    const canViewProducts = isSuperAdmin || isStoreManager || permissions.includes('VIEW_PRODUCTS') || permissions.includes('MANAGE_PRODUCTS');
    const canViewInventory = isSuperAdmin || isStoreManager || permissions.includes('MANAGE_INVENTORY');
    const canViewCustomers = isSuperAdmin || isStoreManager || permissions.includes('VIEW_CUSTOMERS');

    const supportStats = pendingTickets[0] || { actionRequired: 0, totalActive: 0 };

    let outOfStockItems = [];
    if (canViewInventory) {
      const oosQuery = {
        status: { $ne: 'Draft' },
        $or: [
          { status: 'Out of Stock' },
          { stock: { $lte: 0 }, vendor: { $exists: true } },
          { 'branchStocks.stock': { $lte: 0 } }
        ]
      };
      if (role !== 'Admin' && req.admin.branchId) {
        oosQuery['branchStocks.branchId'] = req.admin.branchId;
      }
      outOfStockItems = await Product.find(oosQuery)
        .select('name image gallery sku variants branchStocks stock vendor status unitType unitValue category')
        .populate('vendor', 'storeName name')
        .populate('branchStocks.branchId', 'name branchName')
        .limit(10)
        .lean();
    }

    res.json({
      success: true,
      stats: {
        totalRevenue: canViewRevenue ? parseFloat(totalRevenue.toFixed(2)) : null,
        revenueGrowth: canViewRevenue ? parseFloat(revenueGrowth.toFixed(1)) : null,
        totalOrders: canViewOrders ? totalOrders : null,
        orderGrowth: canViewOrders ? parseFloat(orderGrowth.toFixed(1)) : null,
        pendingOrders: canViewOrders ? pendingOrders : null,
        totalProducts: canViewProducts ? totalProducts : null,
        totalUsers: canViewCustomers ? totalUsers : null,
        pendingTickets: supportStats.actionRequired,
        supportStats: supportStats,
        lowStockCount: canViewInventory ? finalLowStockCount : null,
        activeRiders: role === 'Admin' || role === 'Store Manager' ? activeRiders : null
      },
      outOfStockItems,
      channels: canViewOrders ? {
        pos: channelSplit.find(c => c._id === 'pos')?.count || 0,
        online: channelSplit.find(c => c._id === 'online')?.count || 0
      } : null,
      recentOrders: canViewOrders ? recentOrders.map(o => ({
        id: o.orderId,
        customer: o.user?.name || o.posCustomer?.name || 'Guest',
        amount: o.totalAmount,
        status: o.status,
        date: o.createdAt
      })) : [],
      revenueData: canViewRevenue ? finalRevenueHistory : []
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get detailed dashboard stats for a specific vendor
// @route   GET /api/vendors/dashboard/stats
// @access  Private (Vendor)
export const getVendorDashboardStats = async (req, res) => {
  try {
    const vendorId = req.vendor._id;

    const vendorProducts = await Product.find({ vendor: vendorId }).select('_id').lean();
    const vendorProductIds = vendorProducts.map(p => p._id);

    const vendorOrderQuery = {
      $or: [
        { vendor: vendorId },
        { 'items.product': { $in: vendorProductIds } }
      ]
    };

    // 1. Core Summary Stats
    const [
      totalProducts,
      totalOrders,
      pendingOrders,
      wallet,
      recentOrders,
      lowStockProducts,
      pendingReturns,
      pendingTickets
    ] = await Promise.all([
      Product.countDocuments({ vendor: vendorId }),
      Order.countDocuments(vendorOrderQuery),
      Order.countDocuments({ ...vendorOrderQuery, status: { $in: ['pending', 'confirmed', 'preparing'] } }),
      Wallet.findOne({ owner: vendorId, ownerModel: 'Vendor' }),
      Order.find(vendorOrderQuery)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name'),
      Product.aggregate([
        { $match: { vendor: vendorId, status: { $ne: 'Draft' } } },
        { $match: { $expr: { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 10] }] } } },
        { $limit: 5 }
      ]),
      Order.countDocuments({ ...vendorOrderQuery, 'returnRequest.isRequested': true, status: 'confirmed' }),
      Complaint.countDocuments({ store: vendorId, status: 'ESCALATED_TO_STORE' })
    ]);

    // 2. 7-Day Revenue & Order Flow
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const analyticsData = await Order.aggregate([
      {
        $match: {
          ...vendorOrderQuery,
          status: { $ne: 'cancelled' },
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
          revenue: { $sum: { $cond: [{ $gt: ["$vendorPayoutAmount", 0] }, "$vendorPayoutAmount", "$totalAmount"] } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const finalAnalytics = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      // Format as YYYY-MM-DD in local time
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const match = analyticsData.find(h => h._id === dateStr);
      finalAnalytics.push({
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dateStr,
        revenue: match ? match.revenue : 0,
        orders: match ? match.orders : 0
      });
    }

    res.json({
      success: true,
      stats: {
        totalProducts,
        totalOrders,
        pendingOrders,
        pendingReturns,
        pendingTickets,
        balance: wallet?.balance || 0,
        totalEarnings: wallet?.totalEarnings || 0,
        pendingPayouts: wallet?.pendingPayouts || 0
      },
      analytics: finalAnalytics,
      recentOrders: recentOrders.map(o => ({
        id: o._id,
        orderId: o.orderId,
        customer: o.user?.name || 'Guest',
        amount: o.totalAmount,
        status: o.status,
        date: o.createdAt,
        itemsCount: o.items?.length || 0
      })),
      inventoryAlerts: lowStockProducts.map(p => ({
        id: p._id,
        name: p.name,
        stock: p.stock,
        image: p.gallery && p.gallery.length > 0 ? p.gallery[0] : null
      }))
    });

  } catch (error) {
    console.error('Vendor Dashboard Stats Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
