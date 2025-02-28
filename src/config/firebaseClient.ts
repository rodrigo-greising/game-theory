import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  inMemoryPersistence,
  indexedDBLocalPersistence
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

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const database = getDatabase(app);

// Configure auth persistence with improved mobile support
if (typeof window !== 'undefined') {
  // Check browser environment and capabilities
  const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);
  const isIframe = window !== window.top;
  const hasLocalStorageAccess = (() => {
    try {
      window.localStorage.setItem('auth_test', '1');
      window.localStorage.removeItem('auth_test');
      return true;
    } catch (e) {
      return false;
    }
  })();
  const hasIndexedDBAccess = (() => {
    if (typeof indexedDB === 'undefined') return false;
    try {
      // Simple test to see if IndexedDB is available and accessible
      const request = indexedDB.open('auth_test');
      request.onsuccess = (event) => {
        const target = event.target as IDBOpenDBRequest;
        if (target && target.result) {
          const db = target.result;
          db.close();
          indexedDB.deleteDatabase('auth_test');
        }
      };
      return true;
    } catch (e) {
      return false;
    }
  })();

  console.log(`Auth environment: Mobile: ${isMobile}, iFrame: ${isIframe}, LocalStorage: ${hasLocalStorageAccess}, IndexedDB: ${hasIndexedDBAccess}`);

  // Set the most appropriate persistence method
  const setPersistenceForEnvironment = async () => {
    try {
      // For mobile devices, try IndexedDB first (most reliable on modern mobile browsers)
      if (isMobile && hasIndexedDBAccess) {
        console.log('Setting persistence to INDEXED_DB for mobile');
        await setPersistence(auth, indexedDBLocalPersistence);
        return;
      }

      // For non-mobile with localStorage access
      if (hasLocalStorageAccess && !isIframe) {
        console.log('Setting persistence to LOCAL');
        await setPersistence(auth, browserLocalPersistence);
        return;
      }

      // For iframe or environments with localStorage issues, but with IndexedDB
      if (hasIndexedDBAccess) {
        console.log('Setting persistence to INDEXED_DB as fallback');
        await setPersistence(auth, indexedDBLocalPersistence);
        return;
      }

      // Session persistence as a fallback
      console.log('Setting persistence to SESSION as fallback');
      await setPersistence(auth, browserSessionPersistence);
    } catch (error) {
      console.warn('Failed to set preferred persistence, falling back to IN_MEMORY:', error);
      try {
        await setPersistence(auth, inMemoryPersistence);
      } catch (finalError) {
        console.error('Failed to set any persistence method:', finalError);
      }
    }
  };

  // Execute the persistence setup
  setPersistenceForEnvironment().catch(error => {
    console.error('Persistence initialization error:', error);
  });
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