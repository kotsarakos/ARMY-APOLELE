import { getFirebaseApp, isFirebaseConfigured } from './config'

export interface AuthUser {
  uid: string
  name: string | null
  email: string | null
  /** 'google' or 'password', so the interface knows what to show. */
  provider: string
}

/**
 * The Firebase Auth error codes a user might actually see.
 * They are translated in i18n; anything unrecognised falls back to 'unknown'.
 */
export type AuthErrorCode =
  | 'invalid-email' | 'invalid-credential' | 'email-in-use' | 'weak-password'
  | 'popup-closed' | 'popup-blocked' | 'network' | 'too-many-requests'
  | 'provider-disabled' | 'not-configured' | 'requires-recent-login' | 'unknown'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, original?: unknown) {
    super(code)
    this.code = code
    if (original) console.warn('[army_app] auth', original)
  }
}

function mapError(err: unknown): AuthError {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':            return new AuthError('invalid-email', err)
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':       return new AuthError('invalid-credential', err)
    case 'auth/email-already-in-use':     return new AuthError('email-in-use', err)
    case 'auth/weak-password':            return new AuthError('weak-password', err)
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':  return new AuthError('popup-closed', err)
    case 'auth/popup-blocked':            return new AuthError('popup-blocked', err)
    case 'auth/network-request-failed':   return new AuthError('network', err)
    case 'auth/too-many-requests':        return new AuthError('too-many-requests', err)
    // The provider has not been enabled in the Firebase Console.
    case 'auth/operation-not-allowed':    return new AuthError('provider-disabled', err)
    // Deleting an account requires a recent sign-in.
    case 'auth/requires-recent-login':    return new AuthError('requires-recent-login', err)
    default:                              return new AuthError('unknown', err)
  }
}

async function getAuthInstance() {
  const app = await getFirebaseApp()
  if (!app) throw new AuthError('not-configured')
  const { getAuth } = await import('firebase/auth')
  return getAuth(app)
}

function toUser(u: {
  uid: string; displayName: string | null; email: string | null
  providerData: Array<{ providerId: string }>
}): AuthUser {
  return {
    uid: u.uid,
    name: u.displayName,
    email: u.email,
    provider: u.providerData[0]?.providerId.replace('.com', '') ?? 'password',
  }
}

/** Watches the sign-in state. Returns an unsubscribe function. */
export async function watchAuth(
  onChange: (user: AuthUser | null) => void,
): Promise<() => void> {
  if (!isFirebaseConfigured()) {
    onChange(null)
    return () => {}
  }
  const auth = await getAuthInstance()
  const { onAuthStateChanged } = await import('firebase/auth')
  return onAuthStateChanged(auth, (u) => onChange(u ? toUser(u) : null))
}

export async function signInWithGoogle(): Promise<AuthUser> {
  try {
    const auth = await getAuthInstance()
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    return toUser(cred.user)
  } catch (err) {
    throw mapError(err)
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  try {
    const auth = await getAuthInstance()
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
    return toUser(cred.user)
  } catch (err) {
    throw mapError(err)
  }
}

export async function registerWithEmail(email: string, password: string): Promise<AuthUser> {
  try {
    const auth = await getAuthInstance()
    const { createUserWithEmailAndPassword } = await import('firebase/auth')
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    return toUser(cred.user)
  } catch (err) {
    throw mapError(err)
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    const auth = await getAuthInstance()
    const { sendPasswordResetEmail } = await import('firebase/auth')
    await sendPasswordResetEmail(auth, email.trim())
  } catch (err) {
    throw mapError(err)
  }
}

/**
 * Permanently deletes the account. The caller removes the Firestore document
 * first: once the user is gone the rules allow no further writes, so it would
 * be orphaned forever.
 */
export async function deleteAccount(): Promise<void> {
  try {
    const auth = await getAuthInstance()
    const user = auth.currentUser
    if (!user) return
    const { deleteUser } = await import('firebase/auth')
    await deleteUser(user)
  } catch (err) {
    throw mapError(err)
  }
}

export async function signOutUser(): Promise<void> {
  if (!isFirebaseConfigured()) return
  const auth = await getAuthInstance()
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
}

export { isFirebaseConfigured }
