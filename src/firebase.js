import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getDatabase, ref, set, get, update, remove, onValue, off,
} from "firebase/database";
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

let app, db, auth, messaging;

function getApp() {
  if (!app) {
    app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db   = getDatabase(app);
    auth = getAuth(app);
    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        messaging = getMessaging(app);
      }
    } catch (e) {
      console.warn("FCM not available:", e.message);
    }
  }
  return { app, db, auth, messaging };
}

/* ════════════════════════════════════════════════════════════════════
   AUTH
   - signInAnon(): resolves with a uid (anonymous)
   - watchAuth(cb): subscribes to auth state; cb(uid|null)
   - getCurrentUid(): synchronous accessor after auth has resolved once
════════════════════════════════════════════════════════════════════ */
let _currentUid = null;

export function getCurrentUid() {
  return _currentUid;
}

export async function signInAnon() {
  if (!isConfigured()) return null;
  const { auth } = getApp();
  if (auth.currentUser) {
    _currentUid = auth.currentUser.uid;
    return _currentUid;
  }
  const cred = await signInAnonymously(auth);
  _currentUid = cred.user.uid;
  return _currentUid;
}

export function watchAuth(cb) {
  if (!isConfigured()) { cb(null); return () => {}; }
  const { auth } = getApp();
  return onAuthStateChanged(auth, user => {
    _currentUid = user ? user.uid : null;
    cb(_currentUid);
  });
}

/* ════════════════════════════════════════════════════════════════════
   ALLOWLIST
   - isUidAllowed(uid): one-shot check
   - requestAccess(uid, label): writes to wh/pendingAccess/{uid}
════════════════════════════════════════════════════════════════════ */
export async function isUidAllowed(uid) {
  if (!uid || !isConfigured()) return false;
  try {
    const { db } = getApp();
    const snap = await get(ref(db, `wh/allowedUids/${uid}`));
    return snap.exists();
  } catch (e) {
    // Rules will reject read if uid is not in allowlist — that's expected
    // for unapproved devices. Treat any error as "not allowed".
    console.warn("Allowlist check denied:", e.message);
    return false;
  }
}

export async function requestAccess(uid, label) {
  if (!uid || !isConfigured()) return false;
  const { db } = getApp();
  await set(ref(db, `wh/pendingAccess/${uid}`), {
    uid,
    label: label || "Unnamed device",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
    requestedAt: Date.now(),
  });
  return true;
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

    const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    if (token) {
      // Store token keyed by the domain userId (parent/kid id) AND the auth uid.
      // Cloud Functions look up by userId; we also record which device it came from.
      await dbWrite(`wh/fcmTokens/${userId}`, {
        token,
        authUid: _currentUid || null,
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
