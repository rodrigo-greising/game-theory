'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const SignIn = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState('');
  
  const { getOrCreateAnonymousUser, user, updateUserProfile } = useAuth();
  const router = useRouter();

  // Auto-login when component mounts
  useEffect(() => {
    if (!user) {
      handleAnonymousSignIn();
    } else {
      // If user already exists, redirect to home
      const urlParams = new URLSearchParams(window.location.search);
      const redirectPath = urlParams.get('redirect') || '/';
      router.push(redirectPath);
    }
  }, [user, router]);

  const handleAnonymousSignIn = async () => {
    setError('');
    setLoading(true);
    
    try {
      await getOrCreateAnonymousUser();
      
      // Redirect to the path specified in the URL or home page
      const urlParams = new URLSearchParams(window.location.search);
      const redirectPath = urlParams.get('redirect') || '/';
      router.push(redirectPath);
    } catch (error) {
      setError('Failed to create anonymous session.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!customName.trim()) {
      setError('Please enter a name');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      await updateUserProfile({ displayName: customName.trim() });
      
      // Redirect to the path specified in the URL or home page
      const urlParams = new URLSearchParams(window.location.search);
      const redirectPath = urlParams.get('redirect') || '/';
      router.push(redirectPath);
    } catch (error) {
      setError('Failed to update name.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // If loading, show a spinner
  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold mb-6">Creating Your Session</h2>
        <div className="flex justify-center">
          <div className="h-10 w-10 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-gray-600 dark:text-gray-300">Please wait, creating a temporary session...</p>
      </div>
    );
  }

  // For updating player name
  if (user) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Your Player Name</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-gray-700 dark:text-gray-300 mb-2" htmlFor="customName">
            Change your display name (optional):
          </label>
          <input
            id="customName"
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={user.displayName}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex justify-between">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleUpdateName}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
          >
            Update & Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Start Playing</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <p className="mb-6 text-center text-gray-600 dark:text-gray-300">
        No account needed - just click below to start playing
      </p>
      
      <button
        onClick={handleAnonymousSignIn}
        disabled={loading}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-colors"
      >
        Start Anonymous Session
      </button>
    </div>
  );
};

export default SignIn; 