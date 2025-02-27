'use client';

import React from 'react';
import { useSession, GameSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';

interface SessionsListProps {
  onSelectSession: (session: GameSession) => void;
}

const SessionsList: React.FC<SessionsListProps> = ({ onSelectSession }) => {
  const { sessions, loading, error } = useSession();
  const { user } = useAuth();
  
  // Filter out sessions that are already in progress
  const availableSessions = sessions.filter(session => session.status === 'waiting');
  
  // Filter out sessions that the user is already part of
  const joinableSessions = availableSessions.filter(session => {
    return !session.players || !Object.keys(session.players).includes(user?.uid || '');
  });
  
  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        <p className="text-center mt-2 text-gray-500">Loading sessions...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 border-red-500">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }
  
  if (joinableSessions.length === 0) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <p className="text-center text-gray-500">No available sessions to join.</p>
        <p className="text-center text-gray-500 text-sm mt-1">Create a new session to get started!</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
        Available Sessions
      </h3>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {joinableSessions.map((session) => (
          <li key={session.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{session.name}</p>
                <p className="text-sm text-gray-500">
                  Players: {Object.keys(session.players || {}).length}
                </p>
                <p className="text-xs text-gray-400">
                  Created: {new Date(session.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => onSelectSession(session)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm"
              >
                Join
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SessionsList; 