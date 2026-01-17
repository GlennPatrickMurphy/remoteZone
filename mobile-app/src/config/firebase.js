// Firebase Configuration
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Configuration for remotezone-c717d
const firebaseConfig = {
  apiKey: "AIzaSyDmG4seVlkmjorScyKaD97uCX7Nwb8Z2jQ",
  authDomain: "remotezone-c717d.firebaseapp.com",
  projectId: "remotezone-c717d",
  storageBucket: "remotezone-c717d.firebasestorage.app",
  messagingSenderId: "199553346397",
  appId: "1:199553346397:ios:0822c3a546e9d3085e56b4"
};

// Validate Firebase config
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
if (missingFields.length > 0) {
  console.error('❌ Firebase config missing required fields:', missingFields);
  throw new Error(`Firebase configuration incomplete. Missing: ${missingFields.join(', ')}`);
}

console.log('✅ Firebase config validated:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  hasApiKey: !!firebaseConfig.apiKey
});

// Initialize Firebase app (only if not already initialized)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with AsyncStorage persistence for React Native
// On web, use getAuth. On native, use initializeAuth with AsyncStorage
let auth;

// Helper function to check if auth is already initialized
const getAuthIfExists = (appInstance) => {
  try {
    return getAuth(appInstance);
  } catch (e) {
    return null;
  }
};

if (Platform.OS === 'web') {
  // Web platform - use getAuth (doesn't need AsyncStorage)
  auth = getAuth(app);
} else {
  // Native platform (iOS/Android) - use initializeAuth with AsyncStorage
  // First, check if auth already exists
  const existingAuth = getAuthIfExists(app);
  
  if (existingAuth) {
    // Auth already initialized, use it
    console.log('✅ Using existing Firebase Auth instance');
    auth = existingAuth;
  } else {
    // Try to initialize with AsyncStorage persistence
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
      console.log('✅ Firebase Auth initialized with AsyncStorage persistence');
    } catch (error) {
      console.error('Firebase Auth initialization error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        name: error.name
      });
      
      // Check if auth is already initialized (by checking error message)
      const errorMsg = (error.message || '').toLowerCase();
      const errorCode = (error.code || '').toLowerCase();
      const errorName = (error.name || '').toLowerCase();
      
      if (errorMsg.includes('already') || 
          errorMsg.includes('registered') ||
          errorCode.includes('already') || 
          errorCode.includes('auth/already') ||
          errorName.includes('already')) {
        console.log('Auth already initialized (detected from error), using getAuth()');
        auth = getAuth(app);
      } else {
        // For other errors, try getAuth as fallback
        console.log('Falling back to getAuth()...');
        try {
          auth = getAuth(app);
          console.log('✅ Fallback to getAuth successful');
        } catch (getAuthError) {
          console.error('Failed to get auth instance:', getAuthError);
          // Last resort: try initializing without persistence
          console.log('Attempting initializeAuth without persistence...');
          try {
            auth = initializeAuth(app);
            console.log('✅ Initialized auth without persistence');
          } catch (finalError) {
            console.error('All auth initialization attempts failed:', finalError);
            throw new Error('Unable to initialize Firebase Auth. Please restart the app.');
          }
        }
      }
    }
  }
}

export { auth };
export const db = getFirestore(app);

// Firestore helpers
export const usersRef = (userId) => doc(db, 'users', userId);
export const tvBoxRequestsRef = collection(db, 'tvBoxRequests');

export default app;
