/**
 * Firebase initialisation — imported once, used everywhere.
 *
 * Setup steps:
 *  1. Create a Firebase project at https://console.firebase.google.com
 *  2. Enable Authentication → Sign-in methods: Email/Password, Google,
 *     Apple, and Facebook.
 *  3. For MFA: upgrade to the Blaze (pay-as-you-go) plan and enable
 *     Identity Platform → Multi-factor auth → TOTP.
 *  4. Copy all credentials from Project Settings → Your Apps → Web App
 *     into your .env file (see .env.example).
 */

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

// Guard against double-initialisation in Fast Refresh
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Tokens are persisted in AsyncStorage so the user stays logged in across app restarts.
// Swap `getReactNativePersistence(AsyncStorage)` for a SecureStore adapter
// (see services/tokenService.ts) if you need hardware-backed storage on iOS/Android.
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export default app;
