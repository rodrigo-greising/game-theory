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
  const [redirectError, setRedirectError] = useState<Error | null>(null);

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        // Process any redirect results first
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('Successfully signed in with redirect');
          setUser(result.user);
        }
      } catch (error) {
        console.error('Error with redirect sign-in result:', error);
        setRedirectError(error as Error);
      }
    };

    // Always check for redirect result first when the component mounts
    if (typeof window !== 'undefined') {
      handleRedirectResult()
        .finally(() => {
          // Set up auth state change listener after handling any redirects
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
          });
          
          // Return cleanup function
          return unsubscribe;
        });
    } else {
      // For SSR contexts, just set up the auth state listener
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });
      
      return () => unsubscribe();
    }
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
    // Configure Google provider for better mobile experience
    provider.setCustomParameters({
      // Always show account selector even if there's only one account
      // This helps with consistent behavior across devices
      prompt: 'select_account',
      // Request OAuth offline access to improve token persistence
      access_type: 'offline'
    });
    
    // First, try to detect if we're in a context that might have issues with popups
    const isMobile = typeof window !== 'undefined' && 
      (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent));
    const isEmbedded = typeof window !== 'undefined' && window !== window.top;
    const hasStorageIssues = (() => {
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('auth_test', '1');
          window.localStorage.removeItem('auth_test');
          return false;
        }
        return true;
      } catch (e) {
        return true;
      }
    })();
    
    // Use redirect for contexts that might have issues with popups
    if (isMobile || isEmbedded || hasStorageIssues) {
      try {
        console.log('Using redirect sign-in for mobile or embedded context');
        setLoading(true);
        
        // Try to ensure cookies are enabled for auth state persistence
        document.cookie = "auth_test=1; SameSite=Strict; Secure";
        if (!document.cookie.includes("auth_test")) {
          console.warn("Cookies appear to be disabled. Authentication session may not persist.");
        } else {
          document.cookie = "auth_test=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
        
        await signInWithRedirect(auth, provider);
        return null; // User will be set by getRedirectResult in useEffect
      } catch (error: any) {
        console.error('Error with redirect sign-in:', error);
        setLoading(false);
        throw error;
      }
    } else {
      // On desktop, try popup first, but fall back to redirect if needed
      try {
        console.log('Using popup sign-in for desktop context');
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
          setLoading(true);
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