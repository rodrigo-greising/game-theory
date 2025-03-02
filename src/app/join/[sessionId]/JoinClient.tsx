'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type JoinClientProps = {
  sessionId: string;
};

export default function JoinClient({ sessionId }: JoinClientProps) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { joinSession, currentSession, loading: sessionLoading } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [forceShowLogin, setForceShowLogin] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [autoSignInAttempted, setAutoSignInAttempted] = useState(false);
  const router = useRouter();

  // Force exit from loading state if it takes too long
  useEffect(() => {
    console.log('Initial state:', { authLoading, sessionLoading, user: !!user });
    
    // Set a timeout to force-exit from loading state if it takes too long
    const timeout = setTimeout(() => {
      if (authLoading) {
        console.log('Auth loading is taking too long, forcing login UI to show');
        setForceShowLogin(true);
      }
    }, 3000); // 3 seconds
    
    return () => clearTimeout(timeout);
  }, [authLoading]);

  // Add debug logging
  useEffect(() => {
    console.log('JoinClient rendered with:', {
      sessionId,
      user: user ? 'Logged in' : 'Not logged in',
      authLoading,
      sessionLoading,
      currentSession: currentSession ? 'Has session' : 'No session',
      joining,
      forceShowLogin,
      signingIn,
      autoSignInAttempted
    });
  }, [sessionId, user, authLoading, sessionLoading, currentSession, joining, forceShowLogin, signingIn, autoSignInAttempted]);

  // Automatic sign-in attempt when we know user is not authenticated
  useEffect(() => {
    const attemptAutoSignIn = async () => {
      // Only try auto sign-in if:
      // 1. We know auth is done loading and user is not logged in
      // 2. We haven't already tried
      // 3. We're not already in the process of signing in
      // 4. We haven't force-shown the login UI due to timeout
      if (!authLoading && !user && !autoSignInAttempted && !signingIn && !forceShowLogin) {
        console.log('Attempting automatic sign-in');
        setAutoSignInAttempted(true);
        setSigningIn(true);
        
        try {
          await signInWithGoogle();
          // If successful, auth state will update and trigger the join session logic
        } catch (err: any) {
          console.error('Automatic sign-in failed:', err);
          setError(`Automatic sign-in failed: ${err.message || 'Unknown error'}. Please try signing in manually.`);
          setSigningIn(false);
        }
      }
    };
    
    attemptAutoSignIn();
  }, [authLoading, user, autoSignInAttempted, signingIn, forceShowLogin, signInWithGoogle]);

  // Handle authenticated user actions - only join session or redirect to dashboard
  useEffect(() => {
    // Only proceed if authentication is complete AND user is logged in
    if (!authLoading && user) {
      console.log('Auth state determined - user is logged in');
      
      // If already in a session, go to dashboard
      if (!sessionLoading && currentSession) {
        console.log('User already in a session, redirecting to dashboard');
        router.push('/dashboard');
        return;
      }

      // If not in a session, and not already joining, join this session
      if (!sessionLoading && !currentSession && !joining && sessionId) {
        console.log('Attempting to join session:', sessionId);
        setJoining(true);
        
        joinSession(sessionId)
          .then(() => {
            console.log('Successfully joined session, redirecting to dashboard');
            router.push('/dashboard');
          })
          .catch((err) => {
            console.error('Failed to join session:', err);
            setError(err.message || 'Failed to join session');
            setJoining(false);
          });
      }
    }
  }, [authLoading, user, sessionLoading, currentSession, joining, sessionId, joinSession, router]);

  // Manual sign-in handler (as fallback)
  const handleManualSignIn = async () => {
    try {
      setSigningIn(true);
      setError(null);
      console.log('Using popup authentication flow (manual)');
      await signInWithGoogle();
      // Auth state will be updated automatically and the useEffect above will handle the rest
    } catch (err: any) {
      console.error('Authentication failed:', err);
      setError(`Failed to sign in: ${err.message || 'Unknown error'}`);
      setSigningIn(false);
    }
  };

  // Show sign-in option if force flag is set (timeout) or user is confirmed not authenticated
  // AND auto sign-in has been attempted
  if ((forceShowLogin || (!authLoading && !user)) && (autoSignInAttempted || signingIn)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-lg w-full">
          <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
          <p className="mb-6">You need to sign in to join this game session.</p>
          {error && <p className="mb-6 text-sm text-red-500">{error}</p>}
          <p className="mb-6 text-sm text-gray-500">
            {signingIn ? "Sign-in in progress..." : 
             forceShowLogin ? "Authentication is taking longer than expected. Please sign in manually." : 
             "Automatic sign-in failed or was blocked. Please sign in manually."}
          </p>
          
          {/* Manual sign-in button as fallback */}
          <button
            onClick={handleManualSignIn}
            disabled={signingIn}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md inline-block disabled:bg-blue-400"
          >
            {signingIn ? (
              <span className="flex items-center">
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-t-transparent border-white rounded-full"></div>
                Signing in...
              </span>
            ) : (
              "Sign In with Google"
            )}
          </button>
        </div>
      </div>
    );
  }

  // Show loading state while checking auth or session
  if (authLoading || sessionLoading || joining || (!user && !autoSignInAttempted)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-lg">
          {authLoading ? 'Checking authentication...' : 
           joining ? `Joining session ${sessionId}...` : 
           !user && !autoSignInAttempted ? 'Preparing sign-in...' :
           'Loading session...'}
        </p>
      </div>
    );
  }

  // If there was an error joining the session
  if (error && joining === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-lg w-full">
          <h1 className="text-2xl font-bold mb-4">Error Joining Session</h1>
          <p className="text-red-500 mb-6">{error}</p>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setError(null);
                setJoining(true);
                joinSession(sessionId)
                  .then(() => {
                    router.push('/dashboard');
                  })
                  .catch((err) => {
                    setError(err.message || 'Failed to join session');
                    setJoining(false);
                  });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Try Again
            </button>
            <Link
              href="/dashboard"
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null; // Will be redirected by useEffect
} 