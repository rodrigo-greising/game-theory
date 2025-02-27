'use client';

import React, { useState, useEffect } from 'react';
import { useSession, GameSession } from '@/context/SessionContext';

interface EditSessionProps {
  session: GameSession;
  onClose: () => void;
  onSessionUpdated?: () => void;
}

const EditSession: React.FC<EditSessionProps> = ({ session, onClose, onSessionUpdated }) => {
  const [sessionName, setSessionName] = useState(session.name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { updateSession } = useSession();
  
  // Reset form when session changes
  useEffect(() => {
    setSessionName(session.name);
    setError(null);
  }, [session]);
  
  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionName.trim()) {
      setError('Please enter a session name');
      return;
    }
    
    setIsUpdating(true);
    setError(null);
    
    try {
      await updateSession(session.id, {
        name: sessionName
      });
      
      if (onSessionUpdated) {
        onSessionUpdated();
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update session');
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6 m-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Session</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleUpdateSession}>
          <div className="mb-4">
            <label htmlFor="sessionName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Name
            </label>
            <input
              type="text"
              id="sessionName"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter a name for your game session"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              disabled={isUpdating}
              required
            />
          </div>
          
          {/* Could add more fields to edit in the future */}
          
          {error && (
            <div className="mb-4 text-sm text-red-500">
              {error}
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <span className="flex items-center">
                  <span className="mr-2">Updating...</span>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              ) : 'Update Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSession; 