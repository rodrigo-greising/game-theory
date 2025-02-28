'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';

type JoinPageProps = {
  params: {
    sessionId: string;
  };
};

export default function JoinSessionPage({ params }: JoinPageProps) {
  // Directly access the sessionId from params
  const sessionId = params.sessionId;
  
  const { user, loading: authLoading } = useAuth();
  const { joinSession, currentSession, loading: sessionLoading } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // If already in a session, go to dashboard
    if (!authLoading && !sessionLoading && currentSession) {
      router.push('/dashboard');
      return;
    }

    // If authenticated and not in a session, try to join
    if (!authLoading && user && !sessionLoading && !currentSession && !joining && sessionId) {
      setJoining(true);
      
      joinSession(sessionId)
        .then(() => {
          router.push('/dashboard');
        })
        .catch((err) => {
          setError(err.message || 'Failed to join session');
          setJoining(false);
        });
    }
  }, [authLoading, user, sessionLoading, currentSession, joining, sessionId, joinSession, router]);

  if (authLoading || sessionLoading || joining) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-lg">
          {authLoading ? 'Checking authentication...' : 
           joining ? `Joining session ${sessionId}...` : 
           'Loading session...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-lg w-full">
          <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
          <p className="mb-6">You need to sign in to join this game session.</p>
          <Link
            href={`/auth/signin?redirect=/join/${sessionId}`}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md inline-block"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
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