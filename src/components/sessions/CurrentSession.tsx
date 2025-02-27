'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import GameInfo from '@/components/games/GameInfo';
import QRCode from 'react-qr-code';

const CurrentSession: React.FC = () => {
  const { currentSession, leaveSession, startGame, resetGame, shuffleMatches, loading } = useSession();
  const { user } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  
  useEffect(() => {
    if (currentSession && currentSession.status === 'playing') {
      router.push('/game');
    }
    
    // Generate the share URL
    if (currentSession) {
      setShareUrl(`${window.location.origin}/join/${currentSession.id}`);
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
    
    navigator.clipboard.writeText(shareUrl)
      .then(() => setCopied(true))
      .catch(err => console.error('Failed to copy: ', err));
  };
  
  // Toggle QR code modal
  const toggleQRCode = () => {
    setShowQR(!showQR);
  };
  
  const handleResetGame = async () => {
    try {
      await resetGame();
    } catch (error) {
      console.error('Error resetting game:', error);
    }
  };
  
  const handleShuffleMatches = async () => {
    if (!currentSession?.isTournament) return;
    
    setShuffling(true);
    try {
      await shuffleMatches();
      // After shuffling, redirect to the game page
      router.push('/game');
    } catch (error) {
      console.error('Error shuffling matches:', error);
    } finally {
      setShuffling(false);
    }
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
  const isTournament = currentSession.isTournament;
  
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
      {currentSession.status === 'finished' && (
        <div className="p-4 bg-purple-100 dark:bg-purple-900 text-center border-b border-purple-200 dark:border-purple-700">
          <p className="text-purple-800 dark:text-purple-200">
            {isHost 
              ? "This game has ended. You can reset the game to play again with the same players."
              : "This game has ended. Waiting for the host to reset the game or start a new one."}
          </p>
        </div>
      )}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {currentSession.name}
            {currentSession.status === 'playing' && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                In Progress
              </span>
            )}
            {currentSession.status === 'finished' && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                Completed
              </span>
            )}
            {isTournament && (
              <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                Tournament
              </span>
            )}
          </h3>
          
          <div className="flex space-x-2">
            {isHost && currentSession.status === 'waiting' && (
              <button
                onClick={handleStartGame}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded-md"
                disabled={!isTournament && players.length < 2}
                title={!isTournament && players.length < 2 ? "Need at least 2 players to start" : "Start the game"}
              >
                Start {isTournament ? 'Tournament' : 'Game'}
              </button>
            )}
            
            {isHost && currentSession.status === 'finished' && (
              <>
                <button
                  onClick={handleResetGame}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-md"
                >
                  Reset Game
                </button>
                
                {isTournament && (
                  <button
                    onClick={handleShuffleMatches}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1 rounded-md flex items-center"
                    disabled={shuffling}
                  >
                    {shuffling ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Shuffling...
                      </>
                    ) : (
                      'Shuffle Matches'
                    )}
                  </button>
                )}
              </>
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
        
        <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-medium">Share Session</h4>
            <span className="text-xs text-gray-500">Invite others to join this session</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div
              className="cursor-pointer border border-gray-200 dark:border-gray-600 p-1.5 bg-white dark:bg-gray-800 rounded shadow-sm"
              onClick={toggleQRCode}
              title="Click to enlarge"
            >
              <QRCode 
                value={shareUrl} 
                size={80}
                className="mx-auto"
              />
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs px-3 py-1.5 rounded-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={toggleQRCode}
                  className="flex items-center bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs px-3 py-1.5 rounded-md"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2m0 0v5m0-5h-2m6-1a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Enlarge QR Code
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Link:</span> {shareUrl.length > 45 ? `${shareUrl.substring(0, 45)}...` : shareUrl}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60" onClick={toggleQRCode}>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Scan QR Code to Join</h3>
              <button 
                onClick={toggleQRCode}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-md flex justify-center">
              <QRCode 
                value={shareUrl} 
                size={256}
                className="mx-auto"
              />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm mb-3 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-hidden overflow-ellipsis">{shareUrl}</p>
              <button
                onClick={handleCopyLink}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
      
      {currentSession.status === 'finished' && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
          {isHost ? (
            <>
              {isTournament ? (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 rounded-lg">
                    <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Tournament Options</h4>
                    <p className="text-sm text-purple-600 dark:text-purple-300 mb-4">
                      You can reset the current matches or shuffle to create new random player pairings.
                    </p>
                    <div className="flex justify-center space-x-4">
                      <button 
                        onClick={handleShuffleMatches} 
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium"
                        disabled={shuffling}
                      >
                        {shuffling ? 'Shuffling...' : 'Shuffle Matches'}
                      </button>
                      <button 
                        onClick={handleResetGame} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                      >
                        Reset Current Matches
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={handleLeaveSession} 
                    className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium"
                  >
                    Leave Tournament
                  </button>
                </div>
              ) : (
                <>
                  <button 
                    onClick={handleResetGame} 
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium mr-4"
                  >
                    Reset Game
                  </button>
                  <button 
                    onClick={handleLeaveSession} 
                    className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium"
                  >
                    Leave Session
                  </button>
                </>
              )}
            </>
          ) : (
            <button 
              onClick={handleLeaveSession} 
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              Leave Session
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrentSession; 