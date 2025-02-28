'use client';

import React, { useState } from 'react';
import { useSession, GameSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import EditSession from './EditSession';
import DeleteConfirmation from './DeleteConfirmation';
import { analytics } from '@/config/firebaseClient';
import { logEvent, Analytics } from 'firebase/analytics';
import { Calendar, Users, Clock, AlertCircle } from 'lucide-react';

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

  // Helper function to get status style
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'playing':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };
  
  if (loading) {
    return (
      <div className="p-4 rounded-lg shadow-md bg-gray-800/70">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        </div>
        <p className="text-center mt-2 text-gray-400">Loading your sessions...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 rounded-lg shadow-md bg-gray-800/70 border-l-4 border-red-500">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }
  
  if (userSessions.length === 0) {
    return (
      <div className="p-6 rounded-lg shadow-md bg-gray-800/70 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-500 mb-3" />
        <p className="text-gray-300">You haven't created or joined any sessions yet.</p>
        <p className="text-gray-400 text-sm mt-1">Create a new session to get started!</p>
      </div>
    );
  }
  
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {userSessions.map((session) => (
          <div 
            key={session.id} 
            className="bg-gray-800/70 border border-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 hover:border-purple-500/50 cursor-pointer"
            onClick={() => handleSelectSession(session)}
          >
            {/* Card Header with Status */}
            <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-white truncate">{session.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusStyle(session.status)}`}>
                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>
              </div>
            </div>
            
            {/* Card Body */}
            <div className="p-4">
              {/* Game Info */}
              <p className="text-gray-300 text-sm mb-4 line-clamp-2 h-10">
                {session.gameData ? `Game: ${session.gameData.gameId}` : "Session ready to play"}
              </p>
              
              {/* Session Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-400">
                  <Users size={16} className="mr-2" />
                  <span>{Object.keys(session.players || {}).length} Players</span>
                </div>
                
                <div className="flex items-center text-gray-400">
                  <Calendar size={16} className="mr-2" />
                  <span>Created: {new Date(session.createdAt).toLocaleDateString()}</span>
                </div>
                
                <div className="flex items-center text-gray-400">
                  <Clock size={16} className="mr-2" />
                  <span>{new Date(session.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
            
            {/* Card Actions */}
            <div className="p-3 bg-gray-900/50 border-t border-gray-700 flex justify-between">
              <div>
                {session.createdBy === user?.uid && (
                  <>
                    <button
                      onClick={(e) => handleEditSession(session, e)}
                      className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded-md text-sm mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(session, e)}
                      className="bg-red-900/80 hover:bg-red-800 text-white px-3 py-1 rounded-md text-sm"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleSelectSession(session); }}
                className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded-md text-sm"
              >
                {session.status === 'waiting' ? 'Continue' : 'View'}
              </button>
            </div>
          </div>
        ))}
      </div>

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