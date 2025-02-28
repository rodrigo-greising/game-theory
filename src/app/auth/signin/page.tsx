'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Create a client component to use searchParams
function SignInContent() {
  const { signInWithGoogle, loading: authLoading, user, redirectError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/';
  const [autoSignInAttempted, setAutoSignInAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManuallySigningIn, setIsManuallySigningIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [authAttempted, setAuthAttempted] = useState(false);
  const [redirectAttempted, setRedirectAttempted] = useState(false);
  
  // Detect if we're on a mobile device with multiple reliable checks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent;
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const narrowScreen = window.innerWidth < 768;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isMobileDevice = mobile || narrowScreen || hasTouch;
      
      setIsMobile(isMobileDevice);
      console.log("Device detected as:", isMobileDevice ? "mobile" : "desktop");
      
      // Check if we were in the middle of a redirect (from sessionStorage if available)
      try {
        // Get redirect flag and clear it immediately
        const wasRedirecting = sessionStorage.getItem('auth_redirect_attempt') === 'true';
        if (wasRedirecting) {
          setRedirectAttempted(true);
          console.log("Detected return from redirect authentication");
          // Clear the flag
          sessionStorage.removeItem('auth_redirect_attempt');
          
          // If we're returning from a redirect, mark as loading and check auth state
          setLocalLoading(true);
          
          // Set a timeout to detect if auth state doesn't change
          const redirectTimeout = setTimeout(() => {
            // If we're still loading after 5 seconds, something might be wrong
            if (localLoading && !user) {
              console.log("Redirect timeout reached, still no user");
              setLocalLoading(false);
              setError("Sign-in is taking longer than expected. Please try again.");
            }
          }, 5000);
          
          // Clear timeout if component unmounts
          return () => clearTimeout(redirectTimeout);
        }
      } catch (e) {
        // Ignore storage errors - they're expected in some contexts
        console.warn("Could not access sessionStorage, continuing anyway");
      }
    }
  }, [user, localLoading]);

  // Check if the user is already authenticated
  useEffect(() => {
    if (user) {
      console.log('User is already authenticated, redirecting to:', redirectPath);
      setIsRedirecting(true);
      router.replace(redirectPath);
    }
  }, [user, router, redirectPath]);

  // Check if there was an error during the redirect sign-in
  useEffect(() => {
    if (redirectError) {
      console.error('Redirect error:', redirectError);
      
      // Log the full error for debugging
      console.log('Detailed redirect error:', JSON.stringify(redirectError));
      
      // Convert to string for safer type handling
      const errorStr = String(redirectError);
      
      // Show appropriate error based on the error content
      if (errorStr.includes('storage') || errorStr.includes('context')) {
        // This is a common error on iOS and in some private browsing modes
        setError('Sign-in is having trouble with browser storage. This is normal on some mobile browsers.');
      } else if (errorStr.includes('popup') || errorStr.includes('window')) {
        setError('Browser popup was blocked. Please try again or enable popups for this site.');
      } else {
        setError(`Sign-in error: ${errorStr}`);
      }
      
      // If we had a redirect attempt but got an error, we're no longer loading
      if (redirectAttempted) {
        console.log('Clearing loading state due to redirect error');
      }
      
      setLocalLoading(false);
    }
  }, [redirectError, redirectAttempted]);

  // Auto sign-in attempt function - only for desktop
  const attemptSignIn = useCallback(async () => {
    setAutoSignInAttempted(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.log('Auto sign-in failed, showing manual options:', error);
      setIsManuallySigningIn(true);
    }
  }, [signInWithGoogle]);

  // Only auto-sign in on desktop devices for better reliability
  useEffect(() => {
    if (!authLoading && !user && !autoSignInAttempted && !isMobile) {
      attemptSignIn();
    }
  }, [authLoading, user, autoSignInAttempted, attemptSignIn, isMobile]);

  const handleManualSignIn = async () => {
    setIsManuallySigningIn(true);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLocalLoading(true);
    setAuthAttempted(true);
    
    try {
      // Try to set a flag in sessionStorage to detect redirect returns
      try {
        sessionStorage.setItem('auth_redirect_attempt', 'true');
      } catch (storageError) {
        // Ignore storage errors - expected in some contexts
        console.warn('Could not set sessionStorage flag, continuing anyway');
      }
      
      await signInWithGoogle();
      // The useEffect will handle navigation after successful sign-in
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      
      // Provide more detailed user-friendly error messages
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked. Please enable popups or try the sign-in button again.');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (err.message && typeof err.message === 'string') {
        if (err.message.includes('storage') || err.message.includes('context')) {
          setError('Browser storage access is limited. This is normal on some mobile browsers and won\'t prevent signing in.');
        } else if (err.message.includes('cross-origin')) {
          setError('There was a security-related issue. Please try again.');
        } else {
          setError(`Failed to sign in: ${err.message || 'Unknown error'}`);
        }
      } else {
        setError(`Sign-in error: ${err.toString()}`);
      }
      
      setLocalLoading(false);
    }
  };

  if (isRedirecting) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p>Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Sign In</h2>
          {isMobile && (
            <p className="mt-2 text-sm text-gray-500">
              For the best experience, please keep this tab open until sign-in completes.
            </p>
          )}
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-8 space-y-6">
          <button
            onClick={handleGoogleSignIn}
            disabled={localLoading || authLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {(localLoading || authLoading) ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                  <path fill="none" d="M1 1h22v22H1z" />
                </svg>
                Sign in with Google
              </span>
            )}
          </button>
          
          {(authAttempted && !error && (authLoading || localLoading)) && (
            <div className="text-center mt-4 text-sm text-gray-500">
              <p>Authentication in progress... Please wait.</p>
              {isMobile && (
                <>
                  <p className="mt-1">You may be redirected to Google. After signing in, you'll be returned here.</p>
                  <p className="mt-1">If you see storage access errors, this is normal on some mobile browsers.</p>
                </>
              )}
            </div>
          )}
          
          {/* Add a note for mobile users about storage errors */}
          {isMobile && (
            <div className="text-center mt-4 text-xs text-gray-400">
              <p>Note: Some mobile browsers may show "storage access" errors during sign-in. This is normal and won't prevent you from signing in.</p>
            </div>
          )}
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{" "}
              <Link href="/auth/signup" className="text-indigo-600 hover:text-indigo-500">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap the content with Suspense in the main page component
export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
} 