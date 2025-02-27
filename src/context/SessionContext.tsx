'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  ref, 
  onValue, 
  set, 
  push, 
  update, 
  remove,
  get,
  child,
  DatabaseReference 
} from 'firebase/database';
import { database } from '@/config/firebaseClient';
import { useAuth } from './AuthContext';
import { GameSessionData } from '@/types/games';
import { getGameById, isValidPlayerCount } from '@/games/gameRegistry';

// Define session types
export interface GameSession {
  id: string;
  name: string;
  createdBy: string;
  createdAt: number;
  players: Record<string, Player>;
  status: 'waiting' | 'playing' | 'finished';
  gameData?: GameSessionData; // Add game data to the session
}

export interface Player {
  id: string;
  displayName: string;
  isHost: boolean;
  joinedAt: number;
}

export interface SessionContextType {
  sessions: GameSession[];
  currentSession: GameSession | null;
  currentUser: any;
  createSession: (sessionName: string, gameId: string) => Promise<string>;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  startGame: () => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<Omit<GameSession, 'id' | 'createdBy' | 'players'>>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateGameState: (newGameState: any) => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Create context
const SessionContext = createContext<SessionContextType | null>(null);

// Custom hook to use the session context
export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

// Provider component
export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference to sessions in Firebase Realtime Database
  const sessionsRef = ref(database, 'sessions');

  // Listen for sessions changes
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      const sessionsData = snapshot.val();
      if (!sessionsData) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const sessionsArray: GameSession[] = Object.keys(sessionsData).map(key => ({
        id: key,
        ...sessionsData[key]
      }));

      setSessions(sessionsArray);
      
      // Check if user is in any session
      const userSession = sessionsArray.find(session => 
        session.players && Object.keys(session.players).includes(user.uid)
      );
      
      setCurrentSession(userSession || null);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching sessions:', error);
      setError('Failed to load game sessions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Create a new session
  const createSession = async (sessionName: string, gameId: string): Promise<string> => {
    if (!user) throw new Error('User must be authenticated to create a session');
    
    // Validate game exists
    const game = getGameById(gameId);
    if (!game) {
      throw new Error('Invalid game selected');
    }
    
    try {
      const newSessionRef = push(sessionsRef);
      const sessionId = newSessionRef.key as string;
      
      // Create player object for host
      const player: Player = {
        id: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        isHost: true,
        joinedAt: Date.now()
      };
      
      // Create session with the host as a player and game data
      const newSession: Omit<GameSession, 'id'> = {
        name: sessionName,
        createdBy: user.uid,
        createdAt: Date.now(),
        players: { [user.uid]: player },
        status: 'waiting',
        gameData: {
          gameId: gameId,
          gameState: game.getDefaultGameState(),
          settings: {}
        }
      };
      
      await set(newSessionRef, newSession);
      return sessionId;
    } catch (error: any) {
      console.error('Error creating session:', error);
      setError(error.message);
      throw error;
    }
  };

  // Join an existing session
  const joinSession = async (sessionId: string): Promise<void> => {
    if (!user) throw new Error('User must be authenticated to join a session');
    
    try {
      // Check if session exists
      const sessionRef = ref(database, `sessions/${sessionId}`);
      const snapshot = await get(sessionRef);
      
      if (!snapshot.exists()) {
        throw new Error('Session not found');
      }

      const sessionData = snapshot.val();
      
      // Check if session is already playing
      if (sessionData.status === 'playing') {
        throw new Error('Game already in progress');
      }
      
      // Check if user is already in this session
      if (sessionData.players && sessionData.players[user.uid]) {
        // User is already in this session, no need to join again
        return;
      }
      
      // Count current players
      const currentPlayerCount = sessionData.players ? Object.keys(sessionData.players).length : 0;
      
      // Validate against game constraints if game data exists
      if (sessionData.gameData && sessionData.gameData.gameId) {
        if (!isValidPlayerCount(sessionData.gameData.gameId, currentPlayerCount + 1)) {
          throw new Error(`This game does not support ${currentPlayerCount + 1} players`);
        }
      }
      
      // Create player object
      const player: Player = {
        id: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        isHost: false,
        joinedAt: Date.now()
      };
      
      // Add player to session
      await update(ref(database, `sessions/${sessionId}/players/${user.uid}`), player);
    } catch (error: any) {
      console.error('Error joining session:', error);
      setError(error.message);
      throw error;
    }
  };

  // Leave the current session
  const leaveSession = async (): Promise<void> => {
    if (!user || !currentSession) return;
    
    try {
      // Check if user is the host
      const isHost = currentSession.players[user.uid]?.isHost;
      
      // Remove the player from the session
      await remove(ref(database, `sessions/${currentSession.id}/players/${user.uid}`));
      
      // If user is the host, transfer host status or delete the session if empty
      if (isHost) {
        const remainingPlayers = Object.keys(currentSession.players).filter(
          playerId => playerId !== user.uid
        );
        
        if (remainingPlayers.length > 0) {
          // Transfer host status to the first remaining player
          const newHostId = remainingPlayers[0];
          await update(ref(database, `sessions/${currentSession.id}/players/${newHostId}`), {
            isHost: true
          });
        } else {
          // No players left, delete the session
          await remove(ref(database, `sessions/${currentSession.id}`));
        }
      }
      
      setCurrentSession(null);
    } catch (error: any) {
      console.error('Error leaving session:', error);
      setError(error.message);
      throw error;
    }
  };

  // Start the game
  const startGame = async (): Promise<void> => {
    if (!user || !currentSession) return;
    
    // Verify user is the host
    const isHost = currentSession.players[user.uid]?.isHost;
    if (!isHost) {
      throw new Error('Only the host can start the game');
    }
    
    try {
      // Count current players
      const currentPlayerCount = Object.keys(currentSession.players).length;
      
      // Validate against game constraints
      if (currentSession.gameData && currentSession.gameData.gameId) {
        if (!isValidPlayerCount(currentSession.gameData.gameId, currentPlayerCount)) {
          throw new Error(`This game requires between ${getGameById(currentSession.gameData.gameId)?.minPlayers} and ${getGameById(currentSession.gameData.gameId)?.maxPlayers} players`);
        }
        
        // Get the game and initialize game state
        const game = getGameById(currentSession.gameData.gameId);
        if (!game) {
          throw new Error('Game not found in registry');
        }
        
        // Initialize playerData with all current players
        const playerIds = Object.keys(currentSession.players);
        const initialGameState = game.getDefaultGameState();
        
        // For Prisoner's Dilemma, initialize player data with scores of 0
        if (game.id === 'prisoners-dilemma') {
          const playerData: Record<string, any> = {};
          
          playerIds.forEach(playerId => {
            playerData[playerId] = {
              totalScore: 0,
              ready: false
            };
          });
          
          initialGameState.playerData = playerData;
          initialGameState.status = 'in_progress';
          initialGameState.round = 1;
        }
        
        // Update session status to playing and set initial game state
        await update(ref(database, `sessions/${currentSession.id}`), {
          status: 'playing',
          'gameData.gameState': initialGameState
        });
      } else {
        throw new Error('Game data is missing');
      }
    } catch (error: any) {
      console.error('Error starting game:', error);
      setError(error.message);
      throw error;
    }
  };

  // Update a session
  const updateSession = async (
    sessionId: string, 
    updates: Partial<Omit<GameSession, 'id' | 'createdBy' | 'players'>>
  ): Promise<void> => {
    if (!user) throw new Error('User must be authenticated to update a session');
    
    try {
      // Check if session exists
      const sessionRef = ref(database, `sessions/${sessionId}`);
      const snapshot = await get(sessionRef);
      
      if (!snapshot.exists()) {
        throw new Error('Session not found');
      }

      const sessionData = snapshot.val();
      
      // Check if user is the creator of the session
      if (sessionData.createdBy !== user.uid) {
        throw new Error('Only the session creator can update it');
      }
      
      // Update session with new data
      await update(sessionRef, updates);
    } catch (error: any) {
      console.error('Error updating session:', error);
      setError(error.message);
      throw error;
    }
  };

  // Delete a session
  const deleteSession = async (sessionId: string): Promise<void> => {
    if (!user) throw new Error('User must be authenticated to delete a session');
    
    try {
      // Check if session exists
      const sessionRef = ref(database, `sessions/${sessionId}`);
      const snapshot = await get(sessionRef);
      
      if (!snapshot.exists()) {
        throw new Error('Session not found');
      }

      const sessionData = snapshot.val();
      
      // Check if user is the creator of the session
      if (sessionData.createdBy !== user.uid) {
        throw new Error('Only the session creator can delete it');
      }
      
      // Delete the session
      await remove(sessionRef);
      
      // If this was the current session, clear it
      if (currentSession && currentSession.id === sessionId) {
        setCurrentSession(null);
      }
    } catch (error: any) {
      console.error('Error deleting session:', error);
      setError(error.message);
      throw error;
    }
  };

  // Update game state
  const updateGameState = async (newGameState: any): Promise<void> => {
    if (!user || !currentSession) return;
    
    try {
      // Update the game state in the database
      await update(ref(database, `sessions/${currentSession.id}/gameData`), {
        gameState: newGameState
      });
    } catch (error: any) {
      console.error('Error updating game state:', error);
      setError(error.message);
      throw error;
    }
  };

  const value = {
    sessions,
    currentSession,
    currentUser: user,
    createSession,
    joinSession,
    leaveSession,
    startGame,
    updateSession,
    deleteSession,
    updateGameState,
    loading,
    error
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}; 