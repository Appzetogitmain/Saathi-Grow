// public/firebase-messaging-sw.js

// 1. MUST register notificationclick BEFORE Firebase compat imports
// so our handler executes first and event.stopImmediatePropagation() prevents
// Firebase's internal handler from hijacking the click.
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();

  const rawData = event.notification?.data || {};
  const fcmMsg = rawData.FCM_MSG || {};
  const fcmData = fcmMsg.data || {};
  const fcmOptions = fcmMsg.fcmOptions || fcmMsg.fcm_options || {};
  const fcmNotif = fcmMsg.notification || {};
  const origin = self.location.origin;

  // 1. Prioritize canonical relative route if present
  let route = rawData.route || fcmData.route || '';

  // 2. Backward compatibility with entity keys
  const productId = rawData.productId || fcmData.productId;
  const categorySlug = rawData.categorySlug || fcmData.categorySlug;
  const orderId = rawData.orderId || fcmData.orderId;
  const customLink = rawData.customLink || fcmData.customLink;

  if (!route) {
    if (productId) {
      route = `/product/${productId}`;
    } else if (categorySlug) {
      route = `/category/${categorySlug}`;
    } else if (orderId) {
      route = `/orders/${orderId}`;
    } else if (customLink) {
      route = customLink;
    }
  }

  // 3. Fallback to raw link / url / click_action fields if route still not resolved
  if (!route) {
    const rawLink =
      rawData.clickUrl ||
      rawData.link ||
      rawData.url ||
      fcmOptions.link ||
      fcmData.link ||
      fcmData.url ||
      fcmData.click_action ||
      fcmNotif.click_action ||
      rawData.click_action ||
      '';

    if (rawLink) {
      try {
        if (rawLink.startsWith('http://') || rawLink.startsWith('https://')) {
          const parsed = new URL(rawLink);
          if (parsed.origin === origin || parsed.hostname.includes('vercel.app') || parsed.hostname.includes('saathigro.in')) {
            route = parsed.pathname + parsed.search + parsed.hash;
          } else {
            route = rawLink;
          }
        } else {
          route = rawLink;
        }
      } catch {
        route = rawLink;
      }
    }
  }

  if (!route) {
    route = '/';
  }

  // Determine full targetUrl
  let targetUrl = '';
  if (route.startsWith('http://') || route.startsWith('https://')) {
    targetUrl = route;
  } else {
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
    route = normalizedRoute;
    targetUrl = `${origin}${normalizedRoute}`;
  }

  console.log("[SW NOTIFICATION CLICK] raw event data:", event.notification?.data);
  console.log("[SW NOTIFICATION CLICK] notification:", event.notification);
  console.log("[SW NOTIFICATION CLICK] extracted route:", route);
  console.log("[SW NOTIFICATION CLICK] target URL:", targetUrl);

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    console.log("[SW NOTIFICATION CLICK] matched clients count:", allClients.length);

    // Check if an existing tab or installed PWA window is already open on this origin
    const existingClient = allClients.find((c) => {
      try {
        return new URL(c.url).origin === origin;
      } catch {
        return false;
      }
    });

    console.log("[SW NOTIFICATION CLICK] existing client:", existingClient?.url);

    if (existingClient) {
      console.log("[SW] EXISTING CLIENT branch taken - posting message & focusing");
      // Post notification click message to client and focus tab without hard reloading
      existingClient.postMessage({
        type: 'NOTIFICATION_CLICK_NAVIGATE',
        route: route,
        url: targetUrl
      });
      return existingClient.focus();
    }

    console.log("[SW] COLD START branch taken - calling openWindow with:", targetUrl);
    // When no window client exists (Cold Start), open directly to target route
    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }
  })());
});

// 2. Activate new service worker immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 3. Load Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyC75GkUogpq7NA2JYKmnFcBPvhtqSNdWqI",
  authDomain: "saathigro-ea378.firebaseapp.com",
  databaseURL: "https://saathigro-ea378-default-rtdb.firebaseio.com",
  projectId: "saathigro-ea378",
  storageBucket: "saathigro-ea378.firebasestorage.app",
  messagingSenderId: "730414099137",
  appId: "1:730414099137:web:93d03d9d73ed01f25b4240",
  measurementId: "G-WHGN82T3LV"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const title =
    payload.notification?.title ||
    payload.data?.title ||
    'SaathiGro';

  const origin = self.location.origin;
  const defaultIcon = `${origin}/assets/logo_fav.png`;
  const route = payload.data?.route || (payload.data?.productId ? `/product/${payload.data.productId}` : (payload.data?.categorySlug ? `/category/${payload.data.categorySlug}` : ''));
  const deepLink = payload.fcmOptions?.link || payload.data?.link || payload.data?.url || (route ? `${origin}${route.startsWith('/') ? '' : '/'}${route}` : '');

  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || payload.data?.icon || defaultIcon,
    badge: payload.notification?.badge || payload.data?.badge || defaultIcon,
    vibrate: [200, 100, 200],
    data: {
      ...payload.data,
      route: route,
      clickUrl: deepLink || `${origin}/`
    },
  };

  self.registration.showNotification(title, options);
});
