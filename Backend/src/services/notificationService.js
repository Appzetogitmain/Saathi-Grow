import { admin as firebaseAdmin, isFirebaseInitialized } from '../config/firebase.js';
import User from '../models/User.js';
import DeliveryPartner from '../models/DeliveryPartner.js';
import Vendor from '../models/Vendor.js';
import Branch from '../models/Branch.js';
import Admin from '../models/Admin.js';
import Notification from '../models/Notification.js';

// Simple in-memory deduplication cache (store message + recipient for 10 seconds)
const sentCache = new Map();
const CACHE_TTL = 10000; // 10 seconds

const BASE_CLIENT_URL = process.env.CLIENT_URL || 'https://saathigro.in';

const buildDeepLink = (recipientModel, data = {}) => {
  const baseUrl = BASE_CLIENT_URL;
  const orderId = data?.orderId;
  const ticketId = data?.ticketId;

  if (orderId) {
    if (recipientModel === 'User') return `${baseUrl}/orders/${orderId}`;
    if (recipientModel === 'DeliveryPartner') return `${baseUrl}/delivery/dashboard`;
    if (recipientModel === 'Vendor') return `${baseUrl}/vendor/orders`;
    if (recipientModel === 'Admin') return `${baseUrl}/admin/orders`;
  }

  if (ticketId && recipientModel === 'User') {
    return `${baseUrl}/my-complaints`;
  }

  return baseUrl;
};

/**
 * Send push notification to a specific user/partner
 * @param {string} recipientId - MongoDB ID of the recipient
 * @param {string} recipientModel - Model name ('User', 'DeliveryPartner', 'Vendor', 'Branch', 'Admin')
 * @param {object} notification - { title: string, body: string }
 * @param {object} data - Optional extra data payload
 */
export const sendPushNotification = async (recipientId, recipientModel, notification, data = {}, skipSave = false) => {
  try {
    if (!isFirebaseInitialized) {
      // Allow the API to keep working even if Firebase credentials are missing/misconfigured.
      // In that case we just skip push delivery.
      return false;
    }

    // Deduplication check
    const cacheKey = `${recipientId}_${notification.title}_${notification.body}`;
    if (sentCache.has(cacheKey)) {
      console.log(`Notification already sent to ${recipientId} recently. Skipping.`);
      return true;
    }
    sentCache.set(cacheKey, Date.now());
    setTimeout(() => sentCache.delete(cacheKey), CACHE_TTL);

    let recipient;
    switch (recipientModel) {
      case 'User': recipient = await User.findById(recipientId); break;
      case 'DeliveryPartner': recipient = await DeliveryPartner.findById(recipientId); break;
      case 'Vendor': recipient = await Vendor.findById(recipientId); break;
      case 'Branch': recipient = await Branch.findById(recipientId); break;
      case 'Admin': recipient = await Admin.findById(recipientId); break;
      default: throw new Error('Invalid recipient model');
    }

    // PERSISTENCE: Save to database for history (Save even if no token for in-app history)
    if (!skipSave) {
      try {
        await Notification.create({
          recipient: recipientId,
          recipientModel: recipientModel === 'Admin' || recipientModel === 'Branch' ? 'Staff' : recipientModel,
          title: notification.title,
          body: notification.body,
          data: data,
          type: data.type || 'general'
        });
      } catch (saveError) {
        console.error('Error saving notification to DB:', saveError.message);
      }
    }

    if (!recipient || !recipient.fcmToken) {
      console.log(`No recipient or FCM tokens found for: ${recipientId}`);
      return false;
    }

    const tokens = [];
    if (recipient.fcmToken.app) tokens.push(recipient.fcmToken.app);
    if (recipient.fcmToken.web) tokens.push(recipient.fcmToken.web);

    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) return false;

    const messages = uniqueTokens.map(token => {
      console.log('Sending notification to token:', token);
      const deepLink = buildDeepLink(recipientModel, data);
      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
        },
        data: {
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          ),
          title: notification.title,
          body: notification.body,
          icon: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
          badge: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
          link: deepLink,
          url: deepLink,
          click_action: deepLink,
        },
        // ✅ Web push config (Windows Notification Center + browser)
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            title: notification.title,
            body: notification.body,
            icon: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
            badge: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
            requireInteraction: true, // Keep notification until user clicks or dismisses it
            vibrate: [200, 100, 200, 100, 200, 100, 200],
          },
          fcmOptions: {
            link: deepLink,
          },
        },
        // ✅ Android config
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'high_importance_channel',
            priority: 'high',
            visibility: 'public',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        // ✅ iOS config
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
              contentAvailable: true,
            },
          },
        },
      };
      console.log('Payload:', JSON.stringify(message, null, 2));
      return message;
    });

    // sendEach is the replacement for sendAll in firebase-admin 12.x
    const response = await firebaseAdmin.messaging().sendEach(messages);
    console.log(`[FCM Diagnostic] Results for recipient ${recipientId} (${recipientModel}):`);
    console.log(`  Success count: ${response.successCount}`);
    console.log(`  Failure count: ${response.failureCount}`);

    let saveNeeded = false;
    response.responses.forEach((res, index) => {
      const token = uniqueTokens[index];
      if (res.success) {
        console.log(`  [Success] Token index ${index} (ends with ...${token.slice(-8)}): Message ID ${res.messageId}`);
      } else {
        console.error(`  [Failure] Token index ${index} (ends with ...${token.slice(-8)}): Error Code: ${res.error.code}, Message: ${res.error.message}`);
        
        // Clean up invalid / unregistered tokens
        if (res.error.code === 'messaging/registration-token-not-registered' || res.error.code === 'messaging/invalid-argument') {
          if (recipient.fcmToken) {
            if (recipient.fcmToken.app === token) {
              console.log(`  [Cleanup] Clearing invalid app token for ${recipientId}`);
              recipient.fcmToken.app = '';
              saveNeeded = true;
            }
            if (recipient.fcmToken.web === token) {
              console.log(`  [Cleanup] Clearing invalid web token for ${recipientId}`);
              recipient.fcmToken.web = '';
              saveNeeded = true;
            }
          }
        }
      }
    });

    if (saveNeeded) {
      await recipient.save();
      console.log(`  [Cleanup] Recipient document updated with cleared tokens`);
    }

    return response.successCount > 0;

  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};

/**
 * Send notification to all admins/staff based on role and branch scope
 */
export const notifyAdmins = async (notification, data = {}) => {
  try {
    const admins = await Admin.find({ role: 'Admin', isActive: true });
    for (const admin of admins) {
      await sendPushNotification(admin._id, 'Admin', notification, data, true);
    }
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
};

/**
 * Send notification ONLY to Super Admins (role: 'Admin')
 */
export const notifySuperAdmins = async (notification, data = {}) => {
  try {
    const superAdmins = await Admin.find({ role: 'Admin', isActive: true });
    for (const admin of superAdmins) {
      await sendPushNotification(admin._id, 'Admin', notification, data, true);
    }
  } catch (error) {
    console.error('Error notifying super admins:', error);
  }
};

/**
 * Notify staff members with specific permissions, optionally scoped to a branch
 * @param {string} permission - Required permission string (e.g., 'MANAGE_ORDERS')
 * @param {string|null} branchId - Mongo ID of the branch (null for across all)
 * @param {object} notification - Title and Body
 * @param {object} data - Payload
 */
export const notifyByBranchAndPermission = async (permission, branchId, notification, data = {}) => {
  try {
    const query = { isActive: true };
    if (permission) query.permissions = permission;
    if (branchId) query.branchId = branchId;

    // Admin role always gets notifications if it matches branch or is global (role: 'Admin')
    // We fetch matching Staff and Branch Managers
    const staff = await Admin.find(query);
    
    // Always include Super Admins so they can monitor all activities
    const superAdmins = await Admin.find({ role: 'Admin', isActive: true });
    
    // Union both lists avoiding duplicates
    const allRecipients = [...new Map([...staff, ...superAdmins].map(item => [item._id.toString(), item])).values()];
    
    for (const recipient of allRecipients) {
      await sendPushNotification(recipient._id, 'Admin', notification, data, true);
    }
  } catch (error) {
    console.error('Error in notifyByBranchAndPermission:', error);
  }
};

/**
 * Send notification to multiple users (e.g., promotional)
 */
export const notifyUsers = async (userIds, notification, data = {}) => {
  try {
    for (const id of userIds) {
      await sendPushNotification(id, 'User', notification, data, true);
    }
  } catch (error) {
    console.error('Error notifying users:', error);
  }
};

/**
 * Notify ALL active users (Marketing/Campaigns)
 */
export const notifyAllUsers = async (notification, data = {}) => {
  try {
    const users = await User.find({ isActive: { $ne: false } }, '_id');
    for (const user of users) {
      await sendPushNotification(user._id, 'User', notification, data, true);
    }
  } catch (error) {
    console.error('Error in notifyAllUsers:', error);
  }
};

