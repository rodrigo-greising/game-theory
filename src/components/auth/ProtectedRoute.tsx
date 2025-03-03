'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * A wrapper component that ensures a user exists before showing content
 * With our new anonymous auth system, this primarily ensures a user ID exists
 * before accessing protected routes
 */
const ProtectedRoute = ({ children, fallback }: ProtectedRouteProps) => {
  const { user, loading, getOrCreateAnonymousUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    // Only check if we need to create a user after auth state is loaded
    if (!loading) {
      const checkOrCreateUser = async () => {
        if (!user) {
          console.log('No user found, creating anonymous user');
          try {
            await getOrCreateAnonymousUser();
          } catch (error) {
            console.error('Error creating anonymous user:', error);
            
            // If we can't create a user and no fallback is provided, redirect to login
            if (!fallback) {
              // Encode the current path to redirect back after login
              const encodedRedirect = encodeURIComponent(pathname);
              router.push(`/auth/signin?redirect=${encodedRedirect}`);
              return;
            }
          }
        }
        setIsAuthChecked(true);
      };
      
      checkOrCreateUser();
    }
  }, [user, loading, getOrCreateAnonymousUser, fallback, router, pathname]);

  // Show loading state while authentication is being checked
  if (loading || !isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If still no user after attempting to create one and fallback is provided, show the fallback
  if (!user && fallback) {
    return <>{fallback}</>;
  }

  // User exists, show the protected content
  return <>{children}</>;
};

export default ProtectedRoute; 