'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const AuthStatus = () => {
  const { user, logout, loading, getOrCreateAnonymousUser } = useAuth();
  const router = useRouter();

  // Ensure user is created automatically
  useEffect(() => {
    if (!user && !loading) {
      getOrCreateAnonymousUser();
    }
  }, [user, loading, getOrCreateAnonymousUser]);

  const handleLogout = async () => {
    try {
      await logout();
      // After logout, create a new anonymous user
      await getOrCreateAnonymousUser();
    } catch (error) {
      console.error('Error changing user:', error);
    }
  };

  const handleChangeName = () => {
    router.push('/auth/signin');
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="h-4 w-4 bg-gray-200 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm">
          Player: <span className="font-semibold">{user.displayName}</span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleChangeName}
            className="text-sm px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
          >
            Change Name
          </button>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md"
          >
            New Player
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-500">Creating temporary session...</span>
    </div>
  );
};

export default AuthStatus; 