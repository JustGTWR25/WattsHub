/**
 * firebase.js
 *
 * Single source of truth for Firebase initialization.
 * All config values come from environment variables (VITE_ prefix).
 *
 * In development:  values come from .env.local (git-ignored)
 * In production:   values come from Netlify environment variables
 *
 * NEVER hardcode these values or commit them to git.
 */

import { initializeApp, getApps } from 'firebase/app'
import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  off,
  remove,
  push,
  serverTimestamp,
} from 'firebase/database'

// ── Config from env vars ────────────────────────────────────────────────────
// Vite exposes any variable prefixed VITE_ to the client bundle at build time.
// These are NOT secret — they identify your Firebase project.
// Security comes from Firebase Security Rules, not from hiding these keys.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// ── Validate config on startup ──────────────────────────────────────────────
// Catches missing env vars immediately instead of a cryptic Firebase error.
const REQUIRED = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId']
const missing = REQUIRED.filter(k => !firebaseConfig[k])

if (missing.length > 0) {
  console.error(
    '[WattsHub] Missing Firebase env vars:',
    missing.map(k => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`),
    '\nAdd them to .env.local for development or Netlify env vars for production.'
  )
}

// ── Initialize (guard against double-init in dev hot reload) ────────────────
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const db = getDatabase(app)

// ── Re-export helpers so the rest of the app imports from here ──────────────
export { ref, set, update, onValue, off, remove, push, serverTimestamp }

// ── Typed database helpers ──────────────────────────────────────────────────
// Thin wrappers that handle errors gracefully instead of crashing the app.

export async function dbWrite(path, data) {
  try {
    await set(ref(db, path), data)
    return true
  } catch (err) {
    console.error('[WattsHub] dbWrite failed:', path, err)
    return false
  }
}

export async function dbMerge(path, data) {
  try {
    await update(ref(db, path), data)
    return true
  } catch (err) {
    console.error('[WattsHub] dbMerge failed:', path, err)
    return false
  }
}

export async function dbDelete(path) {
  try {
    await remove(ref(db, path))
    return true
  } catch (err) {
    console.error('[WattsHub] dbDelete failed:', path, err)
    return false
  }
}

export function dbListen(path, callback) {
  const r = ref(db, path)
  onValue(r, snapshot => callback(snapshot.val()))
  // Returns an unsubscribe function for use in useEffect cleanup
  return () => off(r)
}

export function isConfigured() {
  return missing.length === 0
}
