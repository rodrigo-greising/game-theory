'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// Simple user interface to replace Firebase User
export interface SimpleUser {
  uid: string;
  displayName: string;
  isAnonymous: boolean;
}

// Define the auth context type
type AuthContextType = {
  user: SimpleUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  getOrCreateAnonymousUser: () => Promise<SimpleUser>;
  updateUserProfile: (profileData: { displayName?: string }) => Promise<void>;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Generate a random ID
const generateRandomId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing user in localStorage on component mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('gameTheoryUser');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Execute in client side only
    if (typeof window !== 'undefined') {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  // Create a new anonymous user or return the existing one
  const getOrCreateAnonymousUser = async (): Promise<SimpleUser> => {
    setLoading(true);
    
    try {
      // Check if we already have a user
      if (user) {
        return user;
      }
      
      // Generate new anonymous user
      const newUser: SimpleUser = {
        uid: generateRandomId(),
        displayName: `Player_${generateRandomId().substring(0, 6)}`,
        isAnonymous: true
      };
      
      // Store in localStorage
      try {
        localStorage.setItem('gameTheoryUser', JSON.stringify(newUser));
      } catch (error) {
        console.warn('Could not store user in localStorage', error);
      }
      
      // Update state
      setUser(newUser);
      return newUser;
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const logout = async (): Promise<void> => {
    try {
      // Remove from localStorage
      localStorage.removeItem('gameTheoryUser');
      
      // Clear user state
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  // Update user profile
  const updateUserProfile = async (profileData: { displayName?: string }): Promise<void> => {
    if (!user) {
      throw new Error('No user is signed in');
    }
    
    try {
      const updatedUser = {
        ...user,
        ...profileData
      };
      
      // Update localStorage
      localStorage.setItem('gameTheoryUser', JSON.stringify(updatedUser));
      
      // Update state
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    logout,
    getOrCreateAnonymousUser,
    updateUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 