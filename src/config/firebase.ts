import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Check if Firebase app is already initialized to prevent multiple initializations
if (!admin.apps.length) {
  try {
    // Define the path to the service account key file
    const serviceAccountPath = path.join(process.cwd(), 'src/config/secrets/serviceAccountKey.json');
    
    // Check if the service account file exists
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        'Service account key file not found at: ' + serviceAccountPath + 
        '\nPlease add your Firebase service account key file to this location. ' +
        'This file should NOT be committed to your repository.'
      );
    }
    
    // Load the service account key file
    const serviceAccount = require('./secrets/serviceAccountKey.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as ServiceAccount),
      databaseURL: "https://game-theory-8f4a8-default-rtdb.firebaseio.com",
    });
    
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
  }
}

// Export the Firebase admin instance
export const firebaseAdmin = admin;

// Export the Realtime Database instance
export const db = admin.database(); 