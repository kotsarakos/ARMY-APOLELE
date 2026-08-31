import type { FirebaseApp } from 'firebase/app'

/**
 * Ρύθμιση Firebase — project `army-apolele`.
 *
 * Οι τιμές έρχονται από το .env.local (δες .env.example). Ενσωματώνονται στο
 * bundle και είναι ορατές στον browser· για Firebase web αυτό είναι φυσιολογικό.
 * Το apiKey **ταυτοποιεί** το project, δεν το προστατεύει — η προστασία είναι
 * οι κανόνες στο firestore.rules.
 *
 * Το SDK φορτώνεται δυναμικά ώστε όποιος δεν συνδεθεί ποτέ να μην κατεβάζει
 * καθόλου τον κώδικα του Firebase.
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

/** Αρχικοποιεί το Firebase μία φορά, με καθυστερημένη φόρτωση του SDK. */
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
 * Το Firebase Analytics ΔΕΝ αρχικοποιείται σκόπιμα.
 * Η σελίδα απορρήτου της εφαρμογής δηλώνει ρητά «δεν υπάρχει analytics».
 * Αν κάποτε προστεθεί, πρέπει να ενημερωθεί πρώτα το κείμενο στο
 * src/lib/i18n.ts (privacy.sections) — αλλιώς η εφαρμογή λέει ψέματα.
 */
