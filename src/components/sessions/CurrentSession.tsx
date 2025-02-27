'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import GameInfo from '@/components/games/GameInfo';

const CurrentSession: React.FC = () => {
  const { currentSession, leaveSession, startGame, loading } = useSession();
  const { user } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    if (currentSession && currentSession.status === 'playing') {
      router.push('/game');
    }
  }, [currentSession, router]);
  
  // Reset copied status after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);
  
  // Handle copying invitation link
  const handleCopyLink = () => {
    if (!currentSession) return;
    
    const url = `${window.location.origin}/join/${currentSession.id}`;
    navigator.clipboard.writeText(url)
      .then(() => setCopied(true))
      .catch(err => console.error('Failed to copy: ', err));
  };
  
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        <p className="text-center mt-2 text-gray-500">Loading session details...</p>
      </div>
    );
  }
  
  if (!currentSession) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <p className="text-center text-gray-500">You are not currently in any session.</p>
      </div>
    );
  }
  
  const players = currentSession.players ? Object.values(currentSession.players) : [];
  const isHost = currentSession.players[user?.uid || '']?.isHost;
  
  const handleLeaveSession = async () => {
    try {
      await leaveSession();
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  };
  
  const handleStartGame = async () => {
    try {
      await startGame();
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {currentSession.name}
            {currentSession.status === 'playing' && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                In Progress
              </span>
            )}
          </h3>
          
          <div className="flex space-x-2">
            {isHost && currentSession.status === 'waiting' && (
              <button
                onClick={handleStartGame}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded-md"
                disabled={players.length < 2}
                title={players.length < 2 ? "Need at least 2 players to start" : "Start the game"}
              >
                Start Game
              </button>
            )}
            
            <button
              onClick={handleLeaveSession}
              className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 rounded-md"
            >
              Leave Session
            </button>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-1">
          Created: {new Date(currentSession.createdAt).toLocaleString()}
        </p>
        
        <div className="mt-3 flex items-center">
          <button
            onClick={handleCopyLink}
            className="flex items-center bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs px-2 py-1.5 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? 'Copied!' : 'Copy Invitation Link'}
          </button>
          <span className="text-xs text-gray-500 ml-2">Share this link to invite others</span>
        </div>
      </div>
      
      <div className="p-4">
        <h4 className="font-medium mb-2">Players ({players.length})</h4>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {players.map((player) => (
            <li key={player.id} className="py-2 flex items-center">
              <span className="flex-1">{player.displayName}</span>
              {player.isHost && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  Host
                </span>
              )}
              {player.id === user?.uid && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                  You
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      
      {currentSession.status === 'waiting' && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-medium mb-4">Game Information</h4>
          <GameInfo session={currentSession} />
          
          {isHost && !currentSession.gameData?.gameId && (
            <div className="mt-4 text-center">
              <button 
                onClick={() => router.push('/')} 
                className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-md"
              >
                Select a Game
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrentSession; 