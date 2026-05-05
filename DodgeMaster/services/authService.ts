/**
 * Central auth service — all Firebase auth calls go through here.
 * Components never import Firebase directly; they use this module.
 *
 * Supported sign-in methods: Email/Password, Google, Apple.
 * No MFA. No email verification. Instant access on all paths.
 *
 * Username rules:
 *  • Stored in Firestore as the document ID in the `usernames` collection
 *    (lowercase) so uniqueness is enforced at the database level.
 *  • Also written to `users/{uid}.username` and Firebase displayName.
 *  • Social sign-ins that have no username yet return `needs-username`
 *    so the UI can prompt before entering the game.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  User,
  AuthError,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { checkRateLimit, recordFailedAttempt, recordSuccess } from './rateLimiter';

// ── Error mapping ──────────────────────────────────────────────────────────

const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/user-not-found':        'No account found for this email.',
  'auth/wrong-password':        'Incorrect email or password.',
  'auth/invalid-credential':    'Incorrect email or password.',
  'auth/email-already-in-use':  'An account already exists with this email.',
  'auth/invalid-email':         'Invalid email address.',
  'auth/weak-password':         'Password must be at least 8 characters.',
  'auth/too-many-requests':     'Too many attempts. Please wait a moment.',
  'auth/network-request-failed':'Network error. Check your connection.',
  'auth/popup-closed-by-user':  'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
};

export function authErrorMessage(error: unknown): string {
  const code = (error as AuthError)?.code ?? '';
  return FIREBASE_MESSAGES[code] ?? 'An unexpected error occurred. Please try again.';
}

// ── Result type ────────────────────────────────────────────────────────────

export type AuthResult =
  | { status: 'ok';             user: User }
  | { status: 'needs-username'; user: User }  // social sign-in, first time
  | { status: 'error';          message: string };

// ── Username helpers ───────────────────────────────────────────────────────

/**
 * Returns true if the username is not yet taken in Firestore.
 * Checks the `usernames` collection where each doc ID is a lowercased username.
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return !snap.exists();
}

/**
 * Atomically reserve a username and write the user record.
 * Uses a batch write so either both documents land or neither does.
 */
async function reserveUsername(user: User, username: string): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', user.uid), {
    username,
    email: user.email ?? '',
    createdAt: Date.now(),
  });
  batch.set(doc(db, 'usernames', username.toLowerCase()), { uid: user.uid });
  await batch.commit();
  // Keep Firebase displayName in sync so `user.displayName` works everywhere
  await updateProfile(user, { displayName: username });
}

/**
 * Check whether an already-authenticated social user has a username.
 * Returns 'ok' if they do, 'needs-username' if this is their first sign-in.
 */
async function resolvePostSocialSignIn(user: User): Promise<AuthResult> {
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (snap.exists() && snap.data()?.username) {
    return { status: 'ok', user };
  }
  return { status: 'needs-username', user };
}

// ── Public: username setup for social sign-ins ─────────────────────────────

/**
 * Called after a social sign-in when `status === 'needs-username'`.
 * Validates availability then reserves the username atomically.
 */
export async function setUsernameForUser(
  user: User,
  username: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const available = await checkUsernameAvailable(username);
    if (!available) {
      return { ok: false, message: 'That username is already taken.' };
    }
    await reserveUsername(user, username);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: (error as Error).message ?? 'Could not save username.' };
  }
}

// ── Email / Password ───────────────────────────────────────────────────────

/**
 * Register a new player with username + email + password.
 * Checks username availability before creating the Firebase Auth account.
 * On success the player is signed in immediately — no email verification step.
 */
export async function registerWithEmailAndUsername(
  username: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    // Check username first so we don't create a dangling Auth account
    const available = await checkUsernameAvailable(username);
    if (!available) {
      return { status: 'error', message: 'That username is already taken.' };
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await reserveUsername(cred.user, username);
    return { status: 'ok', user: cred.user };
  } catch (error) {
    return { status: 'error', message: authErrorMessage(error) };
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const rateCheck = checkRateLimit(email);
  if (!rateCheck.allowed) {
    const seconds = Math.ceil(rateCheck.retryAfterMs / 1000);
    return {
      status: 'error',
      message: `Too many failed attempts. Try again in ${seconds}s.`,
    };
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    recordSuccess(email);
    return { status: 'ok', user: cred.user };
  } catch (error) {
    recordFailedAttempt(email);
    return { status: 'error', message: authErrorMessage(error) };
  }
}

// ── Google ─────────────────────────────────────────────────────────────────

export async function signInWithGoogleCredential(
  idToken: string,
): Promise<AuthResult> {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    return resolvePostSocialSignIn(cred.user);
  } catch (error) {
    return { status: 'error', message: authErrorMessage(error) };
  }
}

// ── Apple ──────────────────────────────────────────────────────────────────

export async function signInWithAppleCredential(
  identityToken: string,
  rawNonce: string,
): Promise<AuthResult> {
  try {
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: identityToken, rawNonce });
    const cred = await signInWithCredential(auth, credential);
    return resolvePostSocialSignIn(cred.user);
  } catch (error) {
    return { status: 'error', message: authErrorMessage(error) };
  }
}

// ── Sign out ───────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
