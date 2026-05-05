/**
 * Email OTP service — works entirely on Firebase free tier.
 *
 * How it works:
 *  1. generateAndSendOTP()  — creates a 6-digit code, SHA-256-hashes it,
 *     writes the hash + expiry + attempt counter to Firestore, then sends
 *     the plain code to the user's email via the EmailJS REST API.
 *  2. verifyOTP()           — re-hashes what the user typed and compares it
 *     to the Firestore record. Increments the attempt counter on failure;
 *     deletes the record on success.
 *
 * Security properties:
 *  • Plain code never touches the database — only its SHA-256 hash is stored.
 *  • Codes expire after OTP_TTL_MS (10 minutes).
 *  • After MAX_ATTEMPTS failures the record is deleted, forcing a resend.
 *  • Firestore rules (see firestore.rules.example) ensure only the
 *    authenticated user can read/write their own mfa_codes document.
 *
 * EmailJS setup (free tier — 200 emails/month):
 *  1. Create an account at https://www.emailjs.com
 *  2. Add an Email Service (Gmail, Outlook, etc.)
 *  3. Create a template with variables: {{otp_code}}, {{app_name}}, {{to_email}}
 *  4. Copy Service ID, Template ID, and Public Key into .env
 */

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  increment,
  updateDoc,
} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { db } from './firebase';

// ── Constants ──────────────────────────────────────────────────────────────

const OTP_TTL_MS    = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS  = 5;
const OTP_DIGITS    = 6;

// ── Types ──────────────────────────────────────────────────────────────────

interface OtpRecord {
  hash:       string;
  expiresAt:  number;
  attempts:   number;
}

export type OtpSendResult =
  | { ok: true }
  | { ok: false; message: string };

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; message: string; attemptsLeft?: number };

// ── Helpers ────────────────────────────────────────────────────────────────

async function hashCode(code: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, code);
}

function otpDocRef(uid: string) {
  return doc(db, 'mfa_codes', uid);
}

/** Generate a cryptographically random N-digit string. */
async function generateCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(4);
  const num =
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return (num % Math.pow(10, OTP_DIGITS))
    .toString()
    .padStart(OTP_DIGITS, '0');
}

/** Send the OTP email via EmailJS REST API (no SDK needed). */
async function sendEmail(toEmail: string, code: string): Promise<void> {
  const serviceId  = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      'EmailJS is not configured. Add EXPO_PUBLIC_EMAILJS_* vars to .env',
    );
  }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:  serviceId,
      template_id: templateId,
      user_id:     publicKey,
      template_params: {
        to_email:  toEmail,
        otp_code:  code,
        app_name:  'Dodge Master',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`EmailJS error ${response.status}: ${body}`);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a fresh OTP, store its hash in Firestore, and email the plain code.
 * Safe to call multiple times — overwrites any existing pending code.
 */
export async function generateAndSendOTP(
  uid: string,
  email: string,
): Promise<OtpSendResult> {
  try {
    const code = await generateCode();
    const hash = await hashCode(code);

    const record: OtpRecord = {
      hash,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts:  0,
    };

    await setDoc(otpDocRef(uid), record);
    await sendEmail(email, code);

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: (error as Error).message ?? 'Failed to send verification email.',
    };
  }
}

/**
 * Verify the code the user entered against the stored hash.
 * Returns ok:true on match. Deletes the record so codes are single-use.
 */
export async function verifyOTP(
  uid: string,
  inputCode: string,
): Promise<OtpVerifyResult> {
  try {
    const snap = await getDoc(otpDocRef(uid));

    if (!snap.exists()) {
      return { ok: false, message: 'No verification code found. Please request a new one.' };
    }

    const record = snap.data() as OtpRecord;

    if (Date.now() > record.expiresAt) {
      await deleteDoc(otpDocRef(uid));
      return { ok: false, message: 'Code expired. Please request a new one.' };
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await deleteDoc(otpDocRef(uid));
      return { ok: false, message: 'Too many incorrect attempts. Please request a new code.' };
    }

    const inputHash = await hashCode(inputCode.trim());

    if (inputHash !== record.hash) {
      // Increment attempt counter
      await updateDoc(otpDocRef(uid), { attempts: increment(1) });
      const attemptsLeft = MAX_ATTEMPTS - (record.attempts + 1);
      return {
        ok: false,
        message: 'Incorrect code.',
        attemptsLeft,
      };
    }

    // ✓ Correct — delete so it can't be reused
    await deleteDoc(otpDocRef(uid));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: 'Could not verify code. Check your connection and try again.',
    };
  }
}

/**
 * Check whether a valid (non-expired) OTP record exists for this user.
 * Used by the verify screen to decide whether to auto-send on first load.
 */
export async function hasPendingOTP(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(otpDocRef(uid));
    if (!snap.exists()) return false;
    const record = snap.data() as OtpRecord;
    return Date.now() < record.expiresAt && record.attempts < MAX_ATTEMPTS;
  } catch {
    return false;
  }
}
