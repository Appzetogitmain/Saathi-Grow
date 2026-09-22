import { resolveRelativeRoute } from '../src/services/notificationService.js';

const recipientModel = 'User';
const data = {
  type: 'individual',
  entityType: 'product',
  entityId: 'prod_test_123',
  route: '/product/prod_test_123',
  productId: 'prod_test_123'
};
const notification = { title: 'Flash Sale', body: '50% off shoes' };

const BASE_CLIENT_URL = 'https://saathigro.in';
const relRoute = resolveRelativeRoute(recipientModel, data);
const deepLink = `${BASE_CLIENT_URL}${relRoute}`;
const entityType = data?.entityType || 'product';
const entityId = data?.entityId || 'prod_test_123';

const message = {
  token: 'sample_token',
  notification: {
    title: notification.title,
    body: notification.body,
    imageUrl: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
  },
  data: {
    ...Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    entityType: String(entityType),
    entityId: String(entityId),
    route: String(relRoute),
    title: notification.title,
    body: notification.body,
    icon: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
    badge: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
    link: deepLink,
    url: deepLink,
    click_action: deepLink,
  },
  webpush: {
    headers: {
      Urgency: 'high'
    },
    notification: {
      title: notification.title,
      body: notification.body,
      icon: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
      badge: `${BASE_CLIENT_URL}/assets/logo_fav.png`,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200, 100, 200],
    },
    fcmOptions: {
      link: deepLink,
    },
  },
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

console.log('=== FULL FCM MESSAGE PAYLOAD ===');
console.log('notification:\n', JSON.stringify(message.notification, null, 2));
console.log('data:\n', JSON.stringify(message.data, null, 2));
console.log('android:\n', JSON.stringify(message.android, null, 2));
console.log('android.notification:\n', JSON.stringify(message.android.notification, null, 2));
console.log('webpush:\n', JSON.stringify(message.webpush, null, 2));
console.log('webpush.fcmOptions:\n', JSON.stringify(message.webpush.fcmOptions, null, 2));
console.log('=== CONFIRMATIONS ===');
console.log('data.route is present:', message.data.route);
console.log('android.notification.clickAction exists:', 'clickAction' in message.android.notification);
