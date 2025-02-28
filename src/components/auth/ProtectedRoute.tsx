'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

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
  const pathname = usePathname();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    // Only perform the redirect after authentication state is confirmed
    if (!loading) {
      setIsAuthChecked(true);
      
      // If user is not authenticated and no fallback is provided, redirect to login
      if (!user && !fallback) {
        console.log('User not authenticated, redirecting to login page');
        
        // Encode the current path to redirect back after login
        const encodedRedirect = encodeURIComponent(pathname);
        
        // Store the redirect path in sessionStorage for persistence across auth flow
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('authRedirectPath', pathname);
        }
        
        // Redirect to login with the intended destination
        router.push(`/auth/signin?redirect=${encodedRedirect}`);
      }
    }
  }, [user, loading, fallback, router, pathname]);

  // Show loading state while authentication is being checked
  if (loading || !isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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