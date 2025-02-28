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
  redirectError: Error | null;
  signIn: (email: string, password: string) => Promise<User>;
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
  const [redirectChecked, setRedirectChecked] = useState(false);

  useEffect(() => {
    // A much more reliable method for handling redirects
    const checkRedirectResult = async () => {
      setLoading(true);
      
      try {
        console.log('Checking for redirect result');
        
        // Web research suggests a simpler approach: just try to get the redirect result 
        // and have a fallback to check auth.currentUser
        const result = await getRedirectResult(auth)
          .catch(error => {
            console.warn('Error during getRedirectResult:', error);
            return null; // Continue with null on error
          });
        
        if (result && result.user) {
          console.log('Successfully processed redirect sign-in');
          setUser(result.user);
        } else {
          console.log('No redirect result found, checking currentUser');
          // Check if user is already signed in
          if (auth.currentUser) {
            console.log('User already signed in:', auth.currentUser.displayName);
            setUser(auth.currentUser);
          } else {
            console.log('No user found');
          }
        }
      } catch (error) {
        console.error('Error in redirect result handling:', error);
        // Don't set redirect error for storage access errors
        const err = error as Error;
        if (!err.message?.includes('storage') && !err.message?.includes('context')) {
          setRedirectError(err);
        }
      } finally {
        setRedirectChecked(true);
        // Keep loading true until the auth state is also checked
      }
    };
    
    // Check for redirect results first - important to do this in client-side only
    if (typeof window !== 'undefined') {
      checkRedirectResult();
    } else {
      setRedirectChecked(true);
    }
    
    // Always set up the auth state listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        console.log('Auth state changed: user is signed in');
      } else {
        console.log('Auth state changed: no user');
      }
      setUser(currentUser);
      setLoading(false);
    });
    
    // Clean up on unmount
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
    // Always clear any previous redirect errors
    setRedirectError(null);
    
    const provider = new GoogleAuthProvider();
    
    // Based on Firebase docs, use MINIMAL scopes to reduce cross-origin issues
    provider.setCustomParameters({
      // Force account selection to avoid silent sign-in issues
      prompt: 'select_account'
    });
    
    // Simple mobile detection - avoid complex checks that may fail
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
    
    console.log(`Device type detected: ${isMobile ? 'mobile' : 'desktop'}`);
    
    try {
      // For mobile: ALWAYS use POPUP first, then fallback to redirect if needed
      // (This is opposite to common advice but works better according to search results)
      if (isMobile) {
        console.log('Using popup for mobile device (recommended by Firebase support)');
        try {
          // Try popup first even on mobile - this is counterintuitive but 
          // works better according to web search
          const result = await signInWithPopup(auth, provider);
          return result.user;
        } catch (popupError: any) {
          console.log('Mobile popup failed, falling back to redirect:', popupError);
          
          // Only use redirect as fallback on mobile
          try {
            setLoading(true);
            
            // Track the redirect attempt
            try {
              sessionStorage.setItem('auth_redirect_attempt', 'true');
              localStorage.setItem('auth_redirect_timestamp', Date.now().toString());
            } catch (storageError) {
              console.warn('Storage error (expected on some browsers):', storageError);
            }
            
            // Before redirecting, set a flag in the auth object if possible
            // @ts-ignore - Firebase internal property
            if (auth.persistenceManager) {
              console.log('Setting up persistence manager for redirect');
            }
            
            console.log('Starting redirect flow as fallback');
            await signInWithRedirect(auth, provider);
            return null;
          } catch (redirectError: any) {
            console.error('Mobile redirect also failed:', redirectError);
            setLoading(false);
            throw redirectError;
          }
        }
      } 
      // For desktop, use popup (more reliable)
      else {
        console.log('Using popup auth for desktop');
        try {
          const result = await signInWithPopup(auth, provider);
          return result.user;
        } catch (popupError: any) {
          console.error('Desktop popup error:', popupError);
          
          // If popup specifically blocked, try redirect
          if (popupError.code === 'auth/popup-blocked') {
            console.log('Popup blocked, trying redirect fallback');
            try {
              setLoading(true);
              
              // Track redirect attempt
              try {
                sessionStorage.setItem('auth_redirect_attempt', 'true');
                localStorage.setItem('auth_redirect_timestamp', Date.now().toString());
              } catch (storageError) {
                console.warn('Storage error (expected):', storageError);
              }
              
              await signInWithRedirect(auth, provider);
              return null;
            } catch (redirectError: any) {
              console.error('Desktop redirect also failed:', redirectError);
              setLoading(false);
              throw redirectError;
            }
          }
          
          // For any other error, throw it
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error('Authentication completely failed:', error);
      setLoading(false);
      throw error;
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
    redirectError,
    signIn: login,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 