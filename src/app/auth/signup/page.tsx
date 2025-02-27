'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const { signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Auto-trigger Google sign-in when the page loads
    const handleAutoSignIn = async () => {
      try {
        await signInWithGoogle();
        router.push('/');
      } catch (error) {
        console.error('Error with automatic Google sign-in:', error);
        // We don't redirect on error, as the popup might have been dismissed
      }
    };

    // Don't auto-trigger if auth is still loading
    if (!loading) {
      handleAutoSignIn();
    }
  }, [signInWithGoogle, router, loading]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold mb-6">Sign Up</h2>
        <p className="text-gray-600 mb-4">Redirecting to Google sign-in...</p>
        <div className="h-8 w-8 border-t-4 border-b-4 border-blue-500 rounded-full animate-spin mx-auto"></div>
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
} 