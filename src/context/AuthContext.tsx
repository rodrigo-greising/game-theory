'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/config/firebaseClient';

// Define the auth context type
type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<User | null>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (profileData: { displayName?: string; photoURL?: string }) => Promise<void>;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state change listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Check for redirect result on component mount
    const handleRedirectResult = async () => {
      setLoading(true);
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('Successfully signed in with redirect');
          setUser(result.user);
        }
      } catch (error) {
        console.error('Error with redirect sign-in result:', error);
        // Handle specific errors if needed
      } finally {
        setLoading(false);
      }
    };

    // Run the redirect result handler
    if (typeof window !== 'undefined') {
      handleRedirectResult();
    }

    // Clean up the subscription on unmount
    return () => unsubscribe();
  }, []);

  // Sign in with email and password
  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  // Create a new user with email and password
  const signup = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  // Sign out
  const logout = () => {
    return signOut(auth);
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    
    // First, try to detect if we're in a context that might have issues with popups
    const isMobile = window.innerWidth <= 768;
    const isEmbedded = window !== window.top;
    const hasStorageIssues = (() => {
      try {
        window.localStorage.getItem('test');
        return false;
      } catch (e) {
        return true;
      }
    })();
    
    // Use redirect for contexts that might have issues with popups
    if (isMobile || isEmbedded || hasStorageIssues) {
      try {
        await signInWithRedirect(auth, provider);
        return null; // User will be set by getRedirectResult in useEffect
      } catch (error: any) {
        console.error('Error with redirect sign-in:', error);
        throw error;
      }
    } else {
      // On desktop, try popup first, but fall back to redirect if needed
      try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      } catch (error: any) {
        console.error('Popup sign-in error:', error);
        
        // Fall back to redirect for popup-related errors
        if (
          error.code === 'auth/popup-blocked' || 
          error.code === 'auth/popup-closed-by-user' ||
          error.code === 'auth/cancelled-popup-request' ||
          error.message?.includes('cross-origin') ||
          error.message?.includes('COOP')
        ) {
          console.log('Popup was blocked or closed, falling back to redirect...');
          await signInWithRedirect(auth, provider);
          return null;
        }
        throw error;
      }
    }
  };

  // Reset password
  const resetPassword = (email: string) => {
    return sendPasswordResetEmail(auth, email);
  };

  // Update user profile
  const updateUserProfile = async (profileData: { displayName?: string; photoURL?: string }) => {
    if (!user) {
      throw new Error('No user is signed in');
    }
    
    try {
      await updateProfile(user, profileData);
      // Force refresh the user object
      setUser({ ...user });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    signInWithGoogle,
    resetPassword,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 