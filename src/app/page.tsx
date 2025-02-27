'use client';

import React, { useState, useEffect } from "react";
import Image from "next/image";
import AuthStatus from "@/components/auth/AuthStatus";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSession } from "@/context/SessionContext";
import CreateSession from "@/components/sessions/CreateSession";
import SessionsList from "@/components/sessions/SessionsList";
import MySessionsList from "@/components/sessions/MySessionsList";
import { useRouter } from "next/navigation";
import { analytics } from '@/config/firebaseClient';
import { logEvent, Analytics } from 'firebase/analytics';

export default function Home() {
  const { user, updateUserProfile, loading: authLoading } = useAuth();
  const { currentSession, joinSession } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('join');
  const router = useRouter();

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
    
    // Track page view
    if (analytics) {
      logEvent(analytics as Analytics, 'page_view', {
        page_title: 'Home',
        page_location: window.location.href,
        page_path: window.location.pathname
      });
    }
  }, [user, currentSession, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setUpdateError('Display name cannot be empty');
      return;
    }

    try {
      setIsUpdating(true);
      setUpdateError(null);
      await updateUserProfile({ displayName });
      
      if (analytics) {
        logEvent(analytics as Analytics, 'update_profile', {
          user_id: user?.uid
        });
      }
    } catch (error: any) {
      setUpdateError(error.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectSession = async (session: any) => {
    try {
      setJoinError(null);
      await joinSession(session.id);
      
      if (analytics) {
        logEvent(analytics as Analytics, 'join_session', {
          session_id: session.id,
          user_id: user?.uid
        });
      }
      
      // Session joined successfully
      setActiveTab('join');
    } catch (error: any) {
      console.error('Error joining session:', error);
      setJoinError(error.message || 'Failed to join session');
    }
  };

  const handleSessionCreated = (sessionId: string) => {
    if (analytics) {
      logEvent(analytics as Analytics, 'create_session', {
        session_id: sessionId,
        user_id: user?.uid
      });
    }
    
    // Reset to join tab after successful creation
    setActiveTab('join');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold">G</span>
            </div>
            <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">GameTheory</h1>
          </div>
          <AuthStatus />
        </header>

        <main className="flex flex-col items-center">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">
                Strategic Gaming
              </span>
              <br /> for Everyone
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              Create or join game sessions and challenge your strategic thinking against friends and rivals
            </p>
            {!user && (
              <Link 
                href="/auth/signin" 
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-full text-lg font-medium shadow-lg transform transition hover:scale-105"
              >
                Get Started
              </Link>
            )}
          </div>

          {/* User Content when logged in */}
          {user && (
            <div className="w-full max-w-4xl bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl shadow-2xl border border-gray-700">
              <h2 className="text-2xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">Welcome, Player!</h2>
              
              {/* Profile Section */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-gray-200">Your Gamer Profile</h3>
                <form onSubmit={handleUpdateProfile} className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your display name"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                  >
                    {isUpdating ? 'Updating...' : 'Update Profile'}
                  </button>
                </form>
                {updateError && (
                  <p className="mt-2 text-red-400 text-sm">{updateError}</p>
                )}
              </div>
              
              {/* My Sessions Section */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4 text-gray-200">My Sessions</h3>
                <MySessionsList />
              </div>
              
              {/* Tabs */}
              <div className="mb-6">
                <div className="border-b border-gray-700">
                  <nav className="flex -mb-px">
                    <button
                      onClick={() => setActiveTab('join')}
                      className={`py-2 px-4 text-center flex-1 border-b-2 font-medium text-sm ${
                        activeTab === 'join'
                          ? 'border-purple-500 text-purple-500'
                          : 'border-transparent text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Join a Session
                    </button>
                    <button
                      onClick={() => setActiveTab('create')}
                      className={`py-2 px-4 text-center flex-1 border-b-2 font-medium text-sm ${
                        activeTab === 'create'
                          ? 'border-purple-500 text-purple-500'
                          : 'border-transparent text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Create a Session
                    </button>
                  </nav>
                </div>
              </div>
              
              {/* Tab Content */}
              <div className="mb-6">
                {activeTab === 'join' ? (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-gray-200">Join a Session</h3>
                    {joinError && (
                      <div className="bg-red-900 bg-opacity-40 border border-red-700 text-red-200 p-3 rounded-lg mb-4">
                        <p>{joinError}</p>
                      </div>
                    )}
                    <SessionsList onSelectSession={handleSelectSession} />
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-gray-200">Create a Session</h3>
                    <CreateSession onSessionCreated={handleSessionCreated} />
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <footer className="mt-20 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} GameTheory. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
