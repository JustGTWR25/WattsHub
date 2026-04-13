import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, get, update, remove, onValue, off } from "firebase/database";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

/* ── Config (injected by Vite env vars) ── */
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isConfigured() {
  return !!(firebaseConfig.apiKey && firebaseConfig.databaseURL);
}

let app, db, messaging;

function getApp() {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db = getDatabase(app);
    // Messaging only available in secure contexts
    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        messaging = getMessaging(app);
      }
    } catch (e) {
      console.warn("FCM not available:", e.message);
    }
  }
  return { app, db, messaging };
}

/* ── RTDB helpers ── */
export async function dbWrite(path, value) {
  if (!isConfigured()) return null;
  const { db } = getApp();
  await set(ref(db, path), value);
  return value;
}

export async function dbMerge(path, value) {
  if (!isConfigured()) return null;
  const { db } = getApp();
  await update(ref(db, path), value);
  return value;
}

export async function dbDelete(path) {
  if (!isConfigured()) return null;
  const { db } = getApp();
  await remove(ref(db, path));
}

export async function dbGet(path) {
  if (!isConfigured()) return null;
  const { db } = getApp();
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

export function dbListen(path, cb) {
  if (!isConfigured()) return () => {};
  const { db } = getApp();
  const r = ref(db, path);
  onValue(r, snap => cb(snap.val()));
  return () => off(r);
}

/* ── FCM: request permission + get token ── */
export async function registerFCMToken(userId) {
  if (!isConfigured()) return null;
  const { messaging } = getApp();
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    // Register the service worker first
    const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    if (token) {
      // Store token in RTDB keyed by userId so Cloud Functions can look it up
      await dbWrite(`wh/fcmTokens/${userId}`, {
        token,
        updatedAt: Date.now(),
        userAgent: navigator.userAgent.slice(0, 120),
      });
    }
    return token;
  } catch (e) {
    console.warn("FCM token registration failed:", e.message);
    return null;
  }
}

/* ── FCM: foreground message handler ── */
export function onFCMMessage(cb) {
  if (!isConfigured()) return () => {};
  const { messaging } = getApp();
  if (!messaging) return () => {};
  return onMessage(messaging, cb);
}
