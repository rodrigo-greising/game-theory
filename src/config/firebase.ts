import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

// Check if Firebase app is already initialized to prevent multiple initializations
if (!admin.apps.length) {
  try {
    // Check if we have environment variables for the admin SDK
    if (process.env.FIREBASE_PROJECT_ID && 
        process.env.FIREBASE_CLIENT_EMAIL && 
        process.env.FIREBASE_PRIVATE_KEY) {
      // Use environment variables to create credential
      const serviceAccount: ServiceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      });
      
      console.log('Firebase Admin SDK initialized successfully using environment variables');
    } 
    // Fallback to local service account file (development only, not for production)
    else if (process.env.NODE_ENV !== 'production') {
      try {
        const serviceAccount = require('./secrets/serviceAccountKey.json');
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://game-theory-8f4a8-default-rtdb.firebaseio.com",
        });
        
        console.log('Firebase Admin SDK initialized successfully using local service account file');
      } catch (e) {
        console.error('Service account file not found and admin environment variables not set');
        throw new Error('Firebase admin service account credentials not available');
      }
    } else {
      throw new Error('Firebase admin service account credentials not available in production');
    }
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
  }
}

// Export the Firebase admin instance
export const firebaseAdmin = admin;

// Export the Realtime Database instance
export const db = admin.database(); 