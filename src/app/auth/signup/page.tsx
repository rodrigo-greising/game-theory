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
      <div className="w-full max-w-md p-8 gaming-card">
        <div className="w-16 h-16 bg-purple-600 rounded-lg flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-bold text-white">G</span>
        </div>
        <h2 className="text-3xl font-bold mb-6 text-center gaming-heading">Sign Up</h2>
        <p className="text-gray-300 mb-6 text-center">Redirecting to Google sign-in...</p>
        <div className="gaming-spinner mx-auto"></div>
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-purple-400 hover:text-purple-300 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
} 