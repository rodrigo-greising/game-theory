import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  initializeAuth,
  Auth
} from 'firebase/auth';
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
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.databaseURL) {
  console.error(
    'Firebase configuration error: Missing required environment variables. ' +
    'Make sure you have set up your .env.local file correctly.'
  );
}

// Initialize Firebase app with the configuration
const app = getApps().length 
  ? getApp() 
  : initializeApp(firebaseConfig);

// CRITICAL FIX: Use initializeAuth instead of getAuth
// This prevents the iframe loading issue causing cross-origin problems
let auth: Auth;
if (typeof window !== 'undefined') {
  try {
    // This approach is recommended by Firebase for apps with CORS issues
    console.log('Initializing Firebase Auth with custom settings for better cross-browser support');
    auth = initializeAuth(app, {
      // Explicitly specify persistence methods in order of preference
      persistence: [
        indexedDBLocalPersistence, // Try IndexedDB first (better for desktop)
        browserLocalPersistence,   // Then localStorage
        browserSessionPersistence  // Then sessionStorage as fallback
      ],
      // Explicitly use the popup redirect resolver
      popupRedirectResolver: browserPopupRedirectResolver
    });
    console.log('Firebase Auth initialized with custom settings');
  } catch (authInitError) {
    console.warn('Failed to initialize Auth with custom settings, falling back to default:', authInitError);
    auth = getAuth(app);
  }
} else {
  // Server-side - just use basic setup
  auth = getAuth(app);
}

// Initialize other Firebase services
const database = getDatabase(app);

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