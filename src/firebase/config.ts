import type { FirebaseApp } from 'firebase/app'

/**
 * Firebase configuration — the `army-apolele` project.
 *
 * The values come from .env.local (see .env.example). They are bundled and
 * visible in the browser, which is normal for Firebase on the web. The apiKey
 * **identifies** the project, it does not protect it — the protection is
 * firestore.rules.
 *
 * The SDK is loaded dynamically, so anyone who never signs in downloads no
 * Firebase code at all.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
}

let appPromise: Promise<FirebaseApp> | null = null

/** Initialises Firebase once, loading the SDK lazily. */
export async function getFirebaseApp(): Promise<FirebaseApp | null> {
  if (!isFirebaseConfigured()) return null
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp, getApps, getApp }) =>
      getApps().length ? getApp() : initializeApp(firebaseConfig),
    )
  }
  return appPromise
}

/*
 * Firebase Analytics is deliberately NOT initialised.
 * The privacy page states plainly that there is no analytics. If it is ever
 * added, the text in src/lib/i18n.ts (privacy.sections) has to be updated
 * first — otherwise the app is lying.
 */
