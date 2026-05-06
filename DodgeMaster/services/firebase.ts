/**
 * Firebase initialisation — imported once, used everywhere.
 *
 * Setup steps:
 *  1. Create a Firebase project at https://console.firebase.google.com
 *  2. Enable Authentication → Sign-in methods: Email/Password, Google, Apple.
 *  3. Enable Firestore Database (start in production mode, then apply
 *     the rules from firestore.rules.example).
 *  4. Copy credentials from Project Settings → Your Apps → Web App
 *     into your .env file (see .env.example).
 *
 *  No Blaze upgrade required — Auth + Firestore are both on the free tier.
 */

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
// Must import from this subpath — Metro doesn't apply Firebase's conditional
// exports so `firebase/auth` resolves the browser build (no getReactNativePersistence).
import { getReactNativePersistence } from 'firebase/auth/react-native';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

// Guard against double-initialisation on Fast Refresh
const isFirstInit = getApps().length === 0;
const app = isFirstInit ? initializeApp(firebaseConfig) : getApps()[0];

// initializeAuth throws if called a second time on the same app instance,
// so fall back to getAuth() which returns the already-initialised instance.
export const auth = isFirstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = getFirestore(app);

export default app;
