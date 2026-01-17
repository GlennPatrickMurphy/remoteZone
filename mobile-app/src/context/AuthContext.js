import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, usersRef } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (userId) => {
    try {
      const userDoc = await getDoc(usersRef(userId));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      } else {
        const defaultProfile = {
          tvBox: null,
          createdAt: new Date().toISOString(),
        };
        await setDoc(usersRef(userId), defaultProfile);
        setUserProfile(defaultProfile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  useEffect(() => {
    let unsubscribe = null;
    
    // Wait a moment to ensure auth is initialized
    const initAuth = () => {
      try {
        if (!auth) {
          console.warn('Auth not initialized, waiting...');
          // Wait 100ms and try again
          setTimeout(() => {
            if (auth) {
              unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
                setUser(currentUser);
                if (currentUser) {
                  await loadUserProfile(currentUser.uid);
                } else {
                  setUserProfile(null);
                }
                setLoading(false);
              });
            } else {
              console.error('Auth still not initialized after wait');
              setLoading(false);
            }
          }, 100);
          return;
        }
        
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          setUser(currentUser);
          if (currentUser) {
            await loadUserProfile(currentUser.uid);
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error('Error initializing auth listener:', error);
        // If auth component not registered, set loading to false
        if (error.message && error.message.includes('not been registered')) {
          console.warn('Auth component not registered yet, will retry');
          // Retry after a delay
          setTimeout(initAuth, 500);
        } else {
          setLoading(false);
        }
      }
    };
    
    initAuth();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signIn = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signUp = async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(usersRef(userCredential.user.uid), {
        tvBox: null,
        createdAt: new Date().toISOString(),
      });
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateUserProfile = async (updates) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      await setDoc(usersRef(user.uid), updates, { merge: true });
      setUserProfile({ ...userProfile, ...updates });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
