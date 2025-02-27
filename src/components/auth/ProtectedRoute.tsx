'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

type ProtectedRouteProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode; // Optional fallback UI to show instead of redirecting
};

/**
 * A wrapper component that protects routes from unauthenticated access
 * Usage:
 * <ProtectedRoute>
 *   <YourSecurePage />
 * </ProtectedRoute>
 */
const ProtectedRoute = ({ children, fallback }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If not authenticated and no fallback is provided, redirect to login
  if (!user && !fallback) {
    router.push('/auth/signin');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to access this page</p>
          <p className="text-gray-400 text-sm mt-2">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // If not authenticated but fallback is provided, show the fallback
  if (!user && fallback) {
    return <>{fallback}</>;
  }

  // User is authenticated, show the protected content
  return <>{children}</>;
};

export default ProtectedRoute; 