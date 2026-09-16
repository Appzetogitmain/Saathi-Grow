import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getMessaging, getToken, onMessage } from "firebase/messaging"; // for web push

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC75GkUogpq7NA2JYKmnFcBPvhtqSNdWqI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "saathigro-ea378.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://saathigro-ea378-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "saathigro-ea378",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "saathigro-ea378.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "730414099137",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:730414099137:web:93d03d9d73ed01f25b4240",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-WHGN82T3LV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getDatabase(app);

let messaging = null;

try {
  messaging = getMessaging(app);
} catch (error) {
  console.log("Firebase Messaging not supported or not configured securely from this host", error);
}

export const generateToken = async () => {
  if (!messaging) return null;
  try {
    if (typeof Notification === 'undefined') {
      console.log('Notification API not supported in this environment');
      return null;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // ✅ Explicitly register service worker so token is tied to it
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration, // ✅ CRITICAL: links token to SW
    });

    if (currentToken) {
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token:', err);
    return null;
  }
};

export const onMessageListener = (callback) => {
  if (!messaging) return;
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};

// ✅ Show native Notification in foreground (Firebase suppresses these by default)
export const setupForegroundNotification = () => {
  if (!messaging || typeof Notification === 'undefined') return;
  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    if (Notification.permission === 'granted') {
      new Notification(
        payload.notification?.title || payload.data?.title || 'New Notification',
        {
          body: payload.notification?.body || payload.data?.body || '',
          icon: '/favicon.png',
          data: payload.data,
        }
      );
    }
  });
};


export { app, analytics, db, messaging };
