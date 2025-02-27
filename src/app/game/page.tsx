'use client';

import React, { useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';
import PrisonersDilemmaGame from '@/components/games/PrisonersDilemmaGame';
import StagHuntGame from '@/components/games/StagHuntGame';
import ChickenGame from '@/components/games/ChickenGame';
import GameInfo from '@/components/games/GameInfo';

export default function GamePage() {
  const { currentSession, loading, finishGame } = useSession();
  const router = useRouter();
  
  // Function to handle returning to dashboard
  const handleReturnToDashboard = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await finishGame();
      router.push('/dashboard');
    } catch (error) {
      console.error('Error finishing game:', error);
    }
  };
  
  // Redirect to dashboard if not in a session or if session is neither 'playing' nor 'finished'
  useEffect(() => {
    if (!loading && (!currentSession || (currentSession.status !== 'playing' && currentSession.status !== 'finished'))) {
      router.push('/dashboard');
    }
  }, [currentSession, loading, router]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!currentSession || (currentSession.status !== 'playing' && currentSession.status !== 'finished')) {
    return null; // Will be redirected by the useEffect above
  }
  
  const players = Object.values(currentSession.players || {});
  const gameId = currentSession?.gameData?.gameId || '';
  
  
  
  // Add safety check to ensure players are properly loaded
  if (!players || players.length < 2) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4">Waiting for Players</h2>
          <p className="mb-4">This game requires at least 2 players to start.</p>
          <p className="text-sm text-gray-500">Current players: {players.length}</p>
          <Link 
            href="/dashboard"
            className="inline-block mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  // Render the appropriate game component based on gameId
  const renderGameComponent = () => {
    if (gameId === 'prisoners-dilemma') {
      return <PrisonersDilemmaGame />;
    }
    
    if (gameId === 'stag-hunt') {
      return <StagHuntGame />;
    }
    
    if (gameId === 'chicken') {
      return <ChickenGame />;
    }
    
    // Fallback for unrecognized games
    return (
      <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">
          Game interface for "{gameId}" is not implemented yet
        </p>
      </div>
    );
  };
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Game: {currentSession.name}</h1>
            <a 
              href="#"
              onClick={handleReturnToDashboard}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm"
            >
              Back to Dashboard
            </a>
          </header>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Game Board</h2>
                {gameId === 'stag-hunt' ? (
                  <StagHuntGame />
                ) : gameId === 'chicken' ? (
                  <ChickenGame />
                ) : renderGameComponent()}
              </div>
            </div>
            
            <div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Players</h2>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {players.map((player) => (
                    <li key={player.id} className="py-2 flex items-center">
                      <span className="flex-1">{player.displayName}</span>
                      {player.isHost && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          Host
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Game Info</h2>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Session ID:</span> {currentSession.id}
                  </p>
                  <p>
                    <span className="font-medium">Started:</span> {new Date(currentSession.createdAt).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span> {currentSession.status}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 