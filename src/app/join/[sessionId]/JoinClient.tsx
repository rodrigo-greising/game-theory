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
  const { user, loading: authLoading, getOrCreateAnonymousUser } = useAuth();
  const { joinSession, currentSession, loading: sessionLoading } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const router = useRouter();

  // Add debug logging
  useEffect(() => {
    console.log('JoinClient rendered with:', {
      sessionId,
      user: user ? 'Logged in' : 'Not logged in',
      authLoading,
      sessionLoading,
      currentSession: currentSession ? 'Has session' : 'No session',
      joining,
      creatingUser
    });
  }, [sessionId, user, authLoading, sessionLoading, currentSession, joining, creatingUser]);

  // Handle user creation if not authenticated
  useEffect(() => {
    const createAnonymousUser = async () => {
      if (!authLoading && !user && !creatingUser) {
        console.log('Creating anonymous user');
        setCreatingUser(true);
        
        try {
          await getOrCreateAnonymousUser();
          // If successful, auth state will update and trigger the join session logic
        } catch (err: any) {
          console.error('Failed to create anonymous user:', err);
          setError(`Failed to create user: ${err.message || 'Unknown error'}`);
          setCreatingUser(false);
        }
      }
    };
    
    createAnonymousUser();
  }, [authLoading, user, creatingUser, getOrCreateAnonymousUser]);

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

  // Show loading state while checking auth or session
  if (authLoading || sessionLoading || joining || creatingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-lg">
          {authLoading ? 'Checking authentication...' : 
           joining ? `Joining session ${sessionId}...` : 
           creatingUser ? 'Creating temporary user...' :
           'Loading session...'}
        </p>
      </div>
    );
  }

  // If there was an error joining the session
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-lg w-full">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-500 mb-6">{error}</p>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setError(null);
                setCreatingUser(false); // Reset state to try again
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