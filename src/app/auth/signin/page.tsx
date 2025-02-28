'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const { signInWithGoogle, loading, user } = useAuth();
  const router = useRouter();
  const [autoSignInAttempted, setAutoSignInAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManuallySigningIn, setIsManuallySigningIn] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/');

  // When mounted, check for a redirect path in URL search params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get('redirect');
      if (redirect) {
        // Save intended destination for after login
        setRedirectPath(redirect);
        // Store in sessionStorage in case of page reload during auth
        sessionStorage.setItem('authRedirectPath', redirect);
      } else {
        // Check if we have a stored redirect path
        const storedRedirect = sessionStorage.getItem('authRedirectPath');
        if (storedRedirect) {
          setRedirectPath(storedRedirect);
        }
      }
    }
  }, []);

  // Separate effect for handling user changes
  useEffect(() => {
    if (user) {
      console.log('User authenticated, redirecting to:', redirectPath);
      // Clear the stored redirect path
      sessionStorage.removeItem('authRedirectPath');
      // Add a small delay to ensure the redirect happens after state updates
      const redirectTimer = setTimeout(() => {
        router.push(redirectPath);
      }, 300);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [user, router, redirectPath]);

  const attemptSignIn = useCallback(async () => {
    if (autoSignInAttempted) return;
    
    setAutoSignInAttempted(true);
    try {
      console.log('Attempting auto sign-in');
      await signInWithGoogle();
      // The user state will update, triggering the redirect effect above
    } catch (error) {
      console.error('Error with automatic Google sign-in:', error);
      setError('Auto sign-in failed. Please use the button below to sign in.');
    }
  }, [autoSignInAttempted, signInWithGoogle]);

  // Try auto sign-in when component loads
  useEffect(() => {
    if (!loading && !user && !autoSignInAttempted) {
      attemptSignIn();
    }
  }, [loading, user, autoSignInAttempted, attemptSignIn]);

  const handleManualSignIn = async () => {
    setError(null);
    setIsManuallySigningIn(true);
    
    try {
      console.log('Manual sign-in initiated');
      await signInWithGoogle();
      // User state will update in AuthContext, triggering the redirect effect
    } catch (error) {
      console.error('Error with manual Google sign-in:', error);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setIsManuallySigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-8 gaming-card">
        <div className="w-16 h-16 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-bold text-white">G</span>
        </div>
        <h2 className="text-3xl font-bold mb-6 text-center gaming-heading">Sign In</h2>
        
        {error && (
          <div className="mb-6 p-3 bg-red-800 text-white rounded-md text-center">
            {error}
          </div>
        )}
        
        {loading || (autoSignInAttempted && !error) ? (
          <>
            <p className="text-gray-300 mb-6 text-center">Redirecting to Google sign-in...</p>
            <div className="gaming-spinner mx-auto"></div>
          </>
        ) : (
          <button
            onClick={handleManualSignIn}
            disabled={isManuallySigningIn}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md flex items-center justify-center gap-2 transition-colors"
          >
            {isManuallySigningIn ? (
              <div className="gaming-spinner w-5 h-5"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
              </svg>
            )}
            {isManuallySigningIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        )}
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-purple-400 hover:text-purple-300 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
} 