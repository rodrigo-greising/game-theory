import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase only if all required config values are provided
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error(
    'Firebase configuration error: Missing required environment variables. ' +
    'Make sure you have set up your .env.local file correctly.'
  );
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const database = getDatabase(app);

// Configure auth persistence with fallbacks
if (typeof window !== 'undefined') {
  // Check if we're in an iframe or cross-origin scenario
  const isIframe = window !== window.top;
  const isThirdPartyCookiesBlocked = () => {
    try {
      // Try to access localStorage to see if storage is available
      window.localStorage.getItem('test');
      return false;
    } catch (e) {
      return true;
    }
  };

  // Choose appropriate persistence method based on context
  if (isIframe || isThirdPartyCookiesBlocked()) {
    // In iframe or if third-party cookies are blocked, use in-memory persistence
    setPersistence(auth, inMemoryPersistence)
      .catch((error) => {
        console.error('Failed to set IN_MEMORY persistence:', error);
      });
  } else {
    // Try local persistence with fallbacks
    setPersistence(auth, browserLocalPersistence)
      .catch((error) => {
        console.warn('Failed to set persistence to LOCAL, falling back to SESSION:', error);
        return setPersistence(auth, browserSessionPersistence);
      })
      .catch((error) => {
        console.warn('Failed to set persistence to SESSION, falling back to IN_MEMORY:', error);
        return setPersistence(auth, inMemoryPersistence);
      })
      .catch((error) => {
        console.error('Failed to set any persistence method:', error);
      });
  }
}

// Initialize Analytics only in the browser environment
let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.error('Firebase Analytics initialization error:', error);
  }
}

export { app, auth, database, analytics }; 