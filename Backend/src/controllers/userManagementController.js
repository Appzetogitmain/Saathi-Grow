import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import { cloudinary } from '../config/cloudinary.js';
import { sendPushNotification } from '../services/notificationService.js';
import { sendSystemNotificationEmail } from '../services/emailService.js';

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin/Manager)
export const getAllUsers = async (req, res) => {
  try {
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const includeMeta = req.query.includeMeta === 'true';
    const pageNumber = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const search = (req.query.search || '').trim();
    const status = req.query.status;
    const city = req.query.city;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const admin = req.admin;
    let query = {};

    // Branch Scoping: If not Super Admin, filter users who have interacted with this specific branch
    if (admin && admin.role !== 'Admin' && admin.branchId) {
      // Find IDs of users who have placed orders in this branch
      const customerIdsInBranch = await Order.find({ branchId: admin.branchId }).distinct('user');
      query._id = { $in: customerIdsInBranch };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (status !== undefined && status !== '') {
      query.isActive = status === 'active' || status === 'true';
    }

    if (city) {
      query['addresses.city'] = { $regex: city, $options: 'i' };
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const usersQuery = User.find(query)
      .select('name email phone profileImage walletBalance isActive addresses.city createdAt')
      .sort({ createdAt: -1 })
      .lean();

    if (hasPagination) {
      const total = await User.countDocuments(query);
      const users = await usersQuery
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(pageNumber));
      res.set('X-Limit', String(limitNumber));
      res.set('X-Total-Pages', String(Math.ceil(total / limitNumber) || 1));
      if (includeMeta) {
        return res.json({
          success: true,
          users,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber) || 1
          }
        });
      }
      return res.json({ success: true, users });
    }

    const users = await usersQuery;
    if (includeMeta) {
      return res.json({ success: true, users });
    }
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private (Admin)
export const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Build match condition for orders (App orders + POS orders)
    const orderMatchCondition = {
      $or: [
        { user: user._id }
      ]
    };
    if (user.phone) orderMatchCondition.$or.push({ 'posCustomer.phone': user.phone });
    if (user.email) orderMatchCondition.$or.push({ 'posCustomer.email': user.email });

    // Fetch Statistics
    const [stats] = await Order.aggregate([
      {
        $match: {
          $and: [
            orderMatchCondition,
            {
              $or: [
                { paymentMethod: 'cod', status: 'delivered' },
                {
                  paymentMethod: { $ne: 'cod' },
                  status: { $nin: ['cancelled', 'returned', 'return_picked_up'] }
                }
              ]
            }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    // Fetch Total Orders (all statuses)
    const totalOrdersCount = await Order.countDocuments(orderMatchCondition);

    // Fetch Last 3 Orders
    const recentOrders = await Order.find(orderMatchCondition)
      .sort({ createdAt: -1 })
      .limit(3)
      .select('orderId totalAmount status createdAt')
      .lean();

    res.json({
      success: true,
      user: {
        ...user,
        stats: {
          totalSpent: stats?.totalSpent || 0,
          totalOrders: totalOrdersCount || 0
        },
        recentOrders
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile details' });
  }
};

// @desc    Create user (by admin)
// @route   POST /api/admin/users
// @access  Private (Admin)
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;

    const userExists = await User.findOne({ phone });
    if (userExists) return res.status(400).json({ message: 'User already exists with this phone number' });

    if (name) {
      const nameRegex = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
      if (!nameRegex.test(name.trim())) {
        return res.status(400).json({ message: 'Full name should only contain letters and spaces, without numbers or special characters' });
      }
    }

    const user = new User({
      name,
      email,
      phone,
      role: role || 'user',
      isActive: true,
      isRegistrationComplete: true
    });

    if (req.file) {
      user.profileImage = req.file.path;
      user.profileImagePublicId = req.file.filename;
    }

    await user.save();
    res.status(201).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user' });
  }
};

// @desc    Update user (by admin)
// @route   PUT /api/admin/users/:id
// @access  Private (Admin)
export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.body.name) {
      const nameRegex = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
      if (!nameRegex.test(req.body.name.trim())) {
        return res.status(400).json({ message: 'Full name should only contain letters and spaces, without numbers or special characters' });
      }
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    user.role = req.body.role || user.role;
    user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;

    if (req.file) {
      if (user.profileImagePublicId) {
        await cloudinary.uploader.destroy(user.profileImagePublicId);
      }
      user.profileImage = req.file.path;
      user.profileImagePublicId = req.file.filename;
    }

    const updatedUser = await user.save();
    res.json({ success: true, user: updatedUser });

    // Notify User on Status Change (Deactivation/Activation)
    if (req.body.isActive !== undefined) {
      const title = 'Account Status Updated';
      const body = `Your user account has been ${updatedUser.isActive ? 'activated' : 'deactivated'}. Please contact support for any queries.`;

      await sendSystemNotificationEmail(updatedUser.email, `Account Notice: ${updatedUser.isActive ? 'Activated' : 'Deactivated'}`, title, body);
      await sendPushNotification(updatedUser._id, 'User', { title, body }, { type: 'account_status', status: updatedUser.isActive ? 'active' : 'inactive' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating user' });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.profileImagePublicId) {
      await cloudinary.uploader.destroy(user.profileImagePublicId);
    }

    await user.deleteOne();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user' });
  }
};

// @desc    Bulk delete users
// @route   DELETE /api/admin/users/bulk
// @access  Private (Admin)
export const bulkDeleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No user ids provided' });
    }

    const objectIds = ids
      .map((id) => String(id || '').trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (objectIds.length === 0) {
      return res.status(400).json({ message: 'No valid user ids provided' });
    }

    const users = await User.find({ _id: { $in: objectIds } }).select('profileImagePublicId');
    for (const user of users) {
      if (user.profileImagePublicId) {
        try {
          await cloudinary.uploader.destroy(user.profileImagePublicId);
        } catch (_) { /* ignore image cleanup failures */ }
      }
    }

    const result = await User.deleteMany({ _id: { $in: objectIds } });
    res.json({
      success: true,
      message: `${result.deletedCount} user(s) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting users' });
  }
};

// @desc    Send custom email to user
// @route   POST /api/admin/users/:id/email
// @access  Private (Admin/Manager)
export const sendEmailToUser = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.email) return res.status(400).json({ message: 'User does not have an email address' });

    const emailSent = await sendSystemNotificationEmail(
      user.email,
      subject,
      'Admin Message 🏮',
      message
    );

    if (!emailSent) {
      return res.status(500).json({ message: 'Email sending failed. Please check backend logs / SMTP credentials.' });
    }

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send custom message (Push + In-app) to user
// @route   POST /api/admin/users/:id/message
// @access  Private (Admin/Manager)
export const sendMessageToUser = async (req, res) => {
  try {
    const { title, body, data = {} } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 1. Save In-app Notification
    await Notification.create({
      recipient: user._id,
      recipientModel: 'User',
      title,
      body,
      data,
      sentBy: req.admin._id,
      type: 'admin_message'
    });

    // 2. Send Push Notification (skipSave = true because we manually created the Notification doc above)
    data.type = 'admin_message';
    await sendPushNotification(user._id, 'User', { title, body }, data, true);

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
