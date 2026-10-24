import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

const missing = Object.entries(cfg)
  .filter(([, value]) => !value)
  .map(([key]) => key)

export const firebaseConfigMissing = missing.length > 0

export const app = firebaseConfigMissing ? null : initializeApp(cfg)
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

// Creates a login without signing the current HR/Admin out (uses a second app instance).
export async function createLogin(email, password) {
  if (firebaseConfigMissing) {
    throw new Error('Firebase is not configured. Add VITE_FB_* values to your .env file.')
  }

  const sec = getApps().find(a => a.name === 'sec') || initializeApp(cfg, 'sec')
  const sa = getAuth(sec)
  const c = await createUserWithEmailAndPassword(sa, email, password)
  await signOut(sa)
  return c.user.uid
}
