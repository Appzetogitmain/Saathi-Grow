// public/firebase-messaging-sw.js
// ✅ Updated to firebase-compat 10.x for consistency + safe fallback handling
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

// Activate new service worker immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const title =
    payload.notification?.title ||
    payload.data?.title ||
    'SaathiGro';

  const origin = self.location.origin;
  const defaultIcon = `${origin}/assets/logo_fav.png`;

  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || payload.data?.icon || defaultIcon,
    badge: payload.notification?.badge || payload.data?.badge || defaultIcon,
    vibrate: [200, 100, 200],
    data: {
      ...payload.data,
      clickUrl: payload.fcmOptions?.link || payload.data?.link || payload.data?.url || `${origin}/`
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const origin = self.location.origin;
  let targetUrl = data.clickUrl || data.link || data.url || `${origin}/`;

  if (!data.clickUrl && data.orderId) {
    targetUrl = `${origin}/orders/${data.orderId}`;
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
      await existingClient.focus();
      if ('navigate' in existingClient && existingClient.url !== targetUrl) {
        return existingClient.navigate(targetUrl);
      }
      return;
    }

    // No window open: open targetUrl (which launches the installed PWA on Android)
    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }
  })());
});
