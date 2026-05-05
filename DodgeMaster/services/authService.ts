/**
 * Central auth service — all Firebase auth calls go through here.
 * Components never import Firebase directly; they use this module.
 *
 * Supported methods: Email/Password, Google, Apple, Facebook.
 * MFA: TOTP (Google Authenticator / Authy) — requires Firebase Identity Platform.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithCredential,
  getMultiFactorResolver,
  multiFactor,
  TotpMultiFactorGenerator,
  MultiFactorResolver,
  User,
  AuthError,
} from 'firebase/auth';
import { auth } from './firebase';
import { checkRateLimit, recordFailedAttempt, recordSuccess } from './rateLimiter';
import { setMFAEnrolled, getMFAFactorUid, clearMFAData } from './tokenService';

// ── MFA resolver is held in module scope so it can survive navigation ──────
let _pendingMFAResolver: MultiFactorResolver | null = null;

export function getPendingMFAResolver(): MultiFactorResolver | null {
  return _pendingMFAResolver;
}

export function clearPendingMFAResolver(): void {
  _pendingMFAResolver = null;
}

// ── Error mapping ──────────────────────────────────────────────────────────

const FIREBASE_MESSAGES: Record<string, string> = {
  'auth/user-not-found':        'No account found for this email.',
  'auth/wrong-password':        'Incorrect password.',
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

// ── Auth result type ───────────────────────────────────────────────────────

export type AuthResult =
  | { status: 'ok'; user: User }
  | { status: 'needs-mfa' }
  | { status: 'needs-verification'; user: User }
  | { status: 'error'; message: string };

// ── Email / Password ───────────────────────────────────────────────────────

export async function registerWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    return { status: 'needs-verification', user: cred.user };
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

    if (!cred.user.emailVerified) {
      return { status: 'needs-verification', user: cred.user };
    }

    return { status: 'ok', user: cred.user };
  } catch (error: any) {
    if (error?.code === 'auth/multi-factor-auth-required') {
      _pendingMFAResolver = getMultiFactorResolver(auth, error);
      return { status: 'needs-mfa' };
    }
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
    return { status: 'ok', user: cred.user };
  } catch (error: any) {
    if (error?.code === 'auth/multi-factor-auth-required') {
      _pendingMFAResolver = getMultiFactorResolver(auth, error);
      return { status: 'needs-mfa' };
    }
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
    return { status: 'ok', user: cred.user };
  } catch (error: any) {
    if (error?.code === 'auth/multi-factor-auth-required') {
      _pendingMFAResolver = getMultiFactorResolver(auth, error);
      return { status: 'needs-mfa' };
    }
    return { status: 'error', message: authErrorMessage(error) };
  }
}

// ── Facebook ───────────────────────────────────────────────────────────────

export async function signInWithFacebookCredential(
  accessToken: string,
): Promise<AuthResult> {
  try {
    const credential = FacebookAuthProvider.credential(accessToken);
    const cred = await signInWithCredential(auth, credential);
    return { status: 'ok', user: cred.user };
  } catch (error: any) {
    if (error?.code === 'auth/multi-factor-auth-required') {
      _pendingMFAResolver = getMultiFactorResolver(auth, error);
      return { status: 'needs-mfa' };
    }
    return { status: 'error', message: authErrorMessage(error) };
  }
}

// ── MFA — TOTP ─────────────────────────────────────────────────────────────

/**
 * Step 1 of MFA enrollment: generate a TOTP secret.
 * Returns the secret so the screen can display it to the user.
 * Requires: user must be signed in and email verified.
 * Requires Firebase Identity Platform (Blaze plan).
 */
export async function generateTotpSecret(): Promise<{
  secret: any; // TotpSecret — typed as any to avoid importing the class
  uri: string;
}> {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user.');

  const multiFactorUser = multiFactor(user);
  const session = await multiFactorUser.getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const uri = secret.generateQrCodeUrl(
    user.email ?? 'user',
    'Dodge Master',
  );
  return { secret, uri };
}

/**
 * Step 2 of MFA enrollment: verify the OTP and complete enrollment.
 */
export async function enrollMFA(
  secret: any,
  otp: string,
  displayName = 'Authenticator App',
): Promise<{ success: boolean; message?: string }> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user.');

    const multiFactorUser = multiFactor(user);
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, otp);
    await multiFactorUser.enroll(assertion, displayName);

    // Persist enrollment so we can surface it on profile screens
    const factorUid = multiFactorUser.enrolledFactors[0]?.uid ?? '';
    await setMFAEnrolled(factorUid);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message ?? 'Enrollment failed.',
    };
  }
}

/**
 * Resolve a pending MFA challenge during sign-in.
 * Call this after `getPendingMFAResolver()` returns non-null.
 */
export async function resolveMFASignIn(otp: string): Promise<AuthResult> {
  if (!_pendingMFAResolver) {
    return { status: 'error', message: 'No MFA challenge pending.' };
  }

  try {
    // Use the first enrolled TOTP factor
    const factor = _pendingMFAResolver.hints[0];
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(
      factor.uid,
      otp,
    );
    const cred = await _pendingMFAResolver.resolveSignIn(assertion);
    _pendingMFAResolver = null;
    return { status: 'ok', user: cred.user };
  } catch (error) {
    return {
      status: 'error',
      message: 'Invalid code. Check your authenticator app and try again.',
    };
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

export async function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (user && !user.emailVerified) {
    await sendEmailVerification(user);
  }
}

export async function signOut(): Promise<void> {
  clearPendingMFAResolver();
  await clearMFAData();
  await firebaseSignOut(auth);
}
