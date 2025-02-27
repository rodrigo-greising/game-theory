'use client';

import React, { useState } from 'react';
import { useSession, GameSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import EditSession from './EditSession';
import DeleteConfirmation from './DeleteConfirmation';
import { analytics } from '@/config/firebaseClient';
import { logEvent, Analytics } from 'firebase/analytics';

interface MySessionsListProps {
  onSelectSession?: (session: GameSession) => void;
}

const MySessionsList: React.FC<MySessionsListProps> = ({ onSelectSession }) => {
  const { sessions, loading, error, deleteSession } = useSession();
  const { user } = useAuth();
  const router = useRouter();
  const [sessionToEdit, setSessionToEdit] = useState<GameSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<GameSession | null>(null);
  
  // Filter sessions that the user is already part of
  const userSessions = sessions.filter(session => {
    return session.players && Object.keys(session.players).includes(user?.uid || '');
  });
  
  const handleSelectSession = (session: GameSession) => {
    if (onSelectSession) {
      onSelectSession(session);
    } else {
      // Navigate to the join page if no handler provided
      router.push(`/join/${session.id}`);
    }
  };

  const handleEditSession = (session: GameSession, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click handler
    setSessionToEdit(session);
  };

  const handleDeleteSession = (session: GameSession, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click handler
    setSessionToDelete(session);
  };

  const handleCloseEditModal = () => {
    setSessionToEdit(null);
  };

  const handleCloseDeleteModal = () => {
    setSessionToDelete(null);
  };

  const handleSessionUpdated = () => {
    // Log the edit event
    if (analytics && sessionToEdit) {
      logEvent(analytics as Analytics, 'edit_session', {
        session_id: sessionToEdit.id,
        user_id: user?.uid
      });
    }
  };

  const handleSessionDeleted = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      
      // Log the delete event
      if (analytics) {
        logEvent(analytics as Analytics, 'delete_session', {
          session_id: sessionId,
          user_id: user?.uid
        });
      }
    } catch (error) {
      // Error handling is done in the DeleteConfirmation component
      throw error;
    }
  };
  
  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        </div>
        <p className="text-center mt-2 text-gray-500">Loading your sessions...</p>
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
  
  if (userSessions.length === 0) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <p className="text-center text-gray-500">You haven't created or joined any sessions yet.</p>
        <p className="text-center text-gray-500 text-sm mt-1">Create a new session to get started!</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold p-4 border-b border-gray-200 dark:border-gray-700">
        Your Sessions
      </h3>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {userSessions.map((session) => (
          <li 
            key={session.id} 
            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            onClick={() => handleSelectSession(session)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{session.name}</p>
                <p className="text-sm text-gray-500">
                  Players: {Object.keys(session.players || {}).length}
                </p>
                <div className="text-xs text-gray-400 flex items-center mt-1">
                  <span className={`mr-2 px-2 py-0.5 rounded-full ${
                    session.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                    session.status === 'playing' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </span>
                  <span>Created: {new Date(session.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex space-x-2">
                {/* Only show edit/delete buttons if the user is the creator of the session */}
                {session.createdBy === user?.uid && (
                  <>
                    <button
                      onClick={(e) => handleEditSession(session, e)}
                      className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-md text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(session, e)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleSelectSession(session); }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm"
                >
                  {session.status === 'waiting' ? 'Continue' : 'View'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Edit Session Modal */}
      {sessionToEdit && (
        <EditSession 
          session={sessionToEdit} 
          onClose={handleCloseEditModal} 
          onSessionUpdated={handleSessionUpdated} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {sessionToDelete && (
        <DeleteConfirmation
          session={sessionToDelete}
          onClose={handleCloseDeleteModal}
          onConfirm={handleSessionDeleted}
        />
      )}
    </div>
  );
};

export default MySessionsList; 