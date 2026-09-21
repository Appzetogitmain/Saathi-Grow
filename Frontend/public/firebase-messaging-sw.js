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
  const fcmOptions = fcmMsg.fcmOptions || {};
  const fcmNotif = fcmMsg.notification || {};
  const origin = self.location.origin;

  let targetUrl =
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

  const productId = rawData.productId || fcmData.productId;
  const categorySlug = rawData.categorySlug || fcmData.categorySlug;
  const orderId = rawData.orderId || fcmData.orderId;
  const customLink = rawData.customLink || fcmData.customLink;

  if (!targetUrl && productId) {
    targetUrl = `${origin}/product/${productId}`;
  } else if (!targetUrl && categorySlug) {
    targetUrl = `${origin}/category/${categorySlug}`;
  } else if (!targetUrl && orderId) {
    targetUrl = `${origin}/orders/${orderId}`;
  } else if (!targetUrl && customLink) {
    targetUrl = customLink.startsWith('http') ? customLink : `${origin}${customLink.startsWith('/') ? '' : '/'}${customLink}`;
  }

  if (!targetUrl) {
    targetUrl = `${origin}/`;
  }

  // If link points to outdated Vercel domain, rewrite to current origin
  if (targetUrl.includes('vercel.app')) {
    try {
      const parsed = new URL(targetUrl);
      targetUrl = `${origin}${parsed.pathname}${parsed.search}`;
    } catch {
      targetUrl = `${origin}/`;
    }
  }

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    // Check if an existing tab or installed PWA window is already open on this origin
    const existingClient = allClients.find((c) => {
      try {
        return new URL(c.url).origin === origin;
      } catch {
        return false;
      }
    });

    if (existingClient) {
      existingClient.postMessage({ type: 'NOTIFICATION_CLICK_NAVIGATE', url: targetUrl });
      let navigated = false;
      if ('navigate' in existingClient && existingClient.url !== targetUrl) {
        try {
          const navClient = await existingClient.navigate(targetUrl);
          if (navClient) {
            navigated = true;
            return navClient.focus();
          }
        } catch (e) {
          console.warn('[SW] existingClient.navigate failed:', e);
        }
      }
      await existingClient.focus();
      if (navigated) return;
    }

    // Always fallback to openWindow so targetUrl is loaded directly
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
  const deepLink = payload.fcmOptions?.link || payload.data?.link || payload.data?.url || '';

  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || payload.data?.icon || defaultIcon,
    badge: payload.notification?.badge || payload.data?.badge || defaultIcon,
    vibrate: [200, 100, 200],
    data: {
      ...payload.data,
      clickUrl: deepLink || `${origin}/`
    },
  };

  self.registration.showNotification(title, options);
});
