'use client';

import React, { useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import CurrentSession from '@/components/sessions/CurrentSession';
import TournamentRankings from '@/components/tournament/TournamentRankings';
import { analytics } from '@/config/firebaseClient';
import { logEvent, Analytics } from 'firebase/analytics';

export default function DashboardPage() {
  const { currentSession, loading: sessionLoading } = useSession();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // If not authenticated, redirect to home
    if (!authLoading && !user) {
      router.push('/');
    }
    
    // Track page view
    if (analytics) {
      logEvent(analytics as Analytics, 'page_view', {
        page_title: 'Dashboard',
        page_location: window.location.href,
        page_path: window.location.pathname
      });
    }
  }, [user, authLoading, router]);
  
  // Loading state
  if (authLoading || sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <header className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-12 gap-4">
            <div className="flex items-center space-x-2">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-lg sm:text-xl font-bold">G</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">GameTheory</h1>
              </Link>
            </div>
            <div className="flex items-center">
              <Link 
                href="/"
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base w-full text-center"
              >
                Inicio
              </Link>
            </div>
          </header>
          
          <main className="w-full max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8 text-center">Panel de Juego</h1>
            
            {currentSession ? (
              <div className="bg-gray-800/50 backdrop-blur-sm p-4 sm:p-8 rounded-xl shadow-2xl border border-gray-700">
                <CurrentSession />
                
                {/* Show tournament rankings if in tournament mode */}
                {currentSession.isTournament && (
                  <TournamentRankings />
                )}
              </div>
            ) : (
              <div className="bg-gray-800/50 backdrop-blur-sm p-4 sm:p-8 rounded-xl shadow-2xl border border-gray-700 text-center">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">No estás en una sesión</h2>
                <p className="text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">Actualmente no formas parte de ninguna sesión de juego.</p>
                <Link 
                  href="/"
                  className="w-full sm:w-auto inline-block px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-sm sm:text-base"
                >
                  Unirse o Crear una Sesión
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
} 