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
  // Tournament-specific properties
  isTournament?: boolean;
  playerMatches?: Record<string, string>; // Maps a player to their current opponent player ID
  tournamentResults?: Record<string, TournamentPlayerResult>; // Aggregated results for tournament leaderboard
}

export interface TournamentPlayerResult {
  playerId: string;
  totalScore: number;
  matchesPlayed: number;
  cooperateCount: number;
  defectCount: number;
  wins: number;
  losses: number;
  draws: number;
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
  createSession: (sessionName: string, gameId: string, isTournament?: boolean) => Promise<string>;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  startGame: () => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<Omit<GameSession, 'id' | 'createdBy' | 'players'>>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateGameState: (newGameState: any) => Promise<void>;
  finishGame: () => Promise<void>;
  resetGame: () => Promise<void>;
  shuffleMatches: () => Promise<void>;
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
  const createSession = async (sessionName: string, gameId: string, isTournament?: boolean): Promise<string> => {
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
        },
        isTournament,
        playerMatches: {},
        tournamentResults: {}
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
      setLoading(true);
      console.log(`Attempting to join session ${sessionId}`);
      
      // Check if session exists
      const sessionRef = ref(database, `sessions/${sessionId}`);
      const snapshot = await get(sessionRef);
      
      if (!snapshot.exists()) {
        console.error('Session not found');
        throw new Error('Session not found');
      }

      const sessionData = snapshot.val();
      console.log('Session data:', sessionData);
      
      // Check if session is already playing
      if (sessionData.status === 'playing') {
        console.error('Game already in progress');
        throw new Error('Game already in progress');
      }
      
      // Check if user is already in this session
      if (sessionData.players && sessionData.players[user.uid]) {
        console.log('User already in session, no need to join again');
        // User is already in this session, no need to join again
        return;
      }
      
      // Count current players
      const currentPlayerCount = sessionData.players ? Object.keys(sessionData.players).length : 0;
      console.log(`Current player count: ${currentPlayerCount}`);
      
      // Validate against game constraints if game data exists
      if (sessionData.gameData && sessionData.gameData.gameId) {
        const gameId = sessionData.gameData.gameId;
        console.log(`Validating player count for game: ${gameId}`);
        
        // Get the game details
        const game = getGameById(gameId);
        if (game) {
          // During joining phase, only check if we're exceeding the maximum player count
          // Don't enforce minimum player count until the game actually starts
          if (currentPlayerCount + 1 > game.maxPlayers) {
            console.error(`This game does not support more than ${game.maxPlayers} players`);
            throw new Error(`This game does not support more than ${game.maxPlayers} players`);
          } else {
            console.log(`Player count ${currentPlayerCount + 1} is within max limit of ${game.maxPlayers}`);
          }
        } else {
          console.error(`Game with ID ${gameId} not found`);
          throw new Error(`Game with ID ${gameId} not found`);
        }
      }
      
      // Create player object
      const player: Player = {
        id: user.uid,
        displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        isHost: false,
        joinedAt: Date.now()
      };
      
      console.log(`Adding player to session: ${JSON.stringify(player)}`);
      
      // Add player to session
      await update(ref(database, `sessions/${sessionId}/players/${user.uid}`), player);
      console.log('Successfully joined session');
    } catch (error: any) {
      console.error('Error joining session:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
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
      if (!currentSession.gameData || !currentSession.gameData.gameId) {
        throw new Error('Game data is missing');
      }
      
      // Get the game and initialize game state
      const game = getGameById(currentSession.gameData.gameId);
      if (!game) {
        throw new Error('Game not found in registry');
      }
      
      // For tournament mode, check if we have at least 2 players
      if (currentSession.isTournament) {
        if (currentPlayerCount < 2) {
          throw new Error('Tournament mode requires at least 2 players');
        }
      } else {
        // For regular mode, validate player count against game requirements
        if (!isValidPlayerCount(currentSession.gameData.gameId, currentPlayerCount)) {
          const minPlayers = game.minPlayers || 2;
          const maxPlayers = game.maxPlayers || 10;
          
          if (currentPlayerCount < minPlayers) {
            throw new Error(`This game requires at least ${minPlayers} players. You have ${currentPlayerCount}.`);
          } else if (currentPlayerCount > maxPlayers) {
            throw new Error(`This game allows at most ${maxPlayers} players. You have ${currentPlayerCount}.`);
          } else {
            throw new Error(`This game requires between ${minPlayers} and ${maxPlayers} players`);
          }
        }
      }
      
      // Initialize playerData with all current players
      const playerIds = Object.keys(currentSession.players);
      let initialGameState = game.getDefaultGameState();
      
      if (currentSession.isTournament) {
        // Tournament mode: Create random pairings of players
        const shuffledPlayerIds = [...playerIds].sort(() => Math.random() - 0.5);
        const playerMatches: Record<string, string> = {};
        const tournamentResults: Record<string, TournamentPlayerResult> = {};
        
        // Initialize tournament results for each player
        playerIds.forEach(playerId => {
          tournamentResults[playerId] = {
            playerId,
            totalScore: 0,
            matchesPlayed: 0,
            cooperateCount: 0,
            defectCount: 0,
            wins: 0,
            losses: 0,
            draws: 0
          };
        });
        
        // Create pairs for as many players as possible
        for (let i = 0; i < Math.floor(shuffledPlayerIds.length / 2) * 2; i += 2) {
          const player1Id = shuffledPlayerIds[i];
          const player2Id = shuffledPlayerIds[i + 1];
          
          playerMatches[player1Id] = player2Id;
          playerMatches[player2Id] = player1Id;
        }
        
        // Handle odd player count - last player waits for next round
        if (shuffledPlayerIds.length % 2 !== 0) {
          const lastPlayerId = shuffledPlayerIds[shuffledPlayerIds.length - 1];
          playerMatches[lastPlayerId] = 'waiting'; // Special value for waiting
        }
        
        // Initialize game state for prisoner's dilemma
        if (game.id === 'prisoners-dilemma') {
          // For each match, initialize player data with scores of 0
          const playerData: Record<string, any> = {};
          
          // Only initialize playerData for players with active matches (not waiting)
          Object.keys(playerMatches).forEach(playerId => {
            if (playerMatches[playerId] !== 'waiting') {
              playerData[playerId] = {
                totalScore: 0,
                ready: false
              };
            }
          });
          
          initialGameState.playerData = playerData;
          initialGameState.status = 'in_progress';
          initialGameState.round = 1;
          
          // Ensure history is initialized as an array
          if (!Array.isArray(initialGameState.history)) {
            initialGameState.history = [];
          }
        }
        
        // Initialize game state for centipede game
        if (game.id === 'centipede-game' && game.initializeGame) {
          // For tournament mode with matches, we need to initialize each pair separately
          Object.keys(playerMatches).forEach(playerId => {
            const opponentId = playerMatches[playerId];
            
            // Only process each pair once and skip players who are waiting
            if (opponentId !== 'waiting' && playerId < opponentId) {
              // Use the initializeGame method to set up the game for this pair
              const pairPlayerIds = [playerId, opponentId];
              const gameStateForPair = game.initializeGame!(initialGameState, pairPlayerIds);
              
              // Copy the initialized state properties to the main gameState
              initialGameState.currentNode = gameStateForPair.currentNode;
              initialGameState.status = 'in_progress';
              
              // Set up playerData if it doesn't exist
              if (!initialGameState.playerData) {
                initialGameState.playerData = {};
              }
              
              // Add player data for this pair
              initialGameState.playerData[playerId] = gameStateForPair.playerData[playerId];
              initialGameState.playerData[opponentId] = gameStateForPair.playerData[opponentId];
              
              // For the first match we encounter, set the currentTurnPlayerId
              // This will be overridden by each individual game instance's logic
              if (!initialGameState.currentTurnPlayerId) {
                initialGameState.currentTurnPlayerId = playerId;
              }
            }
          });
        }
        
        // Update session with player matches
        await update(ref(database, `sessions/${currentSession.id}`), {
          status: 'playing',
          playerMatches,
          tournamentResults,
          gameData: {
            ...currentSession.gameData,
            gameState: initialGameState
          }
        });
      } else {
        // Regular mode: Single game with all players
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
          
          // Ensure history is initialized as an array
          if (!Array.isArray(initialGameState.history)) {
            initialGameState.history = [];
          }
        }
        
        // For Centipede Game or Travelers Dilemma, initialize with player-specific data
        if ((game.id === 'centipede-game' || game.id === 'travelers-dilemma' || game.id === 'bertrand-competition' || game.id === 'cournot-competition') && game.initializeGame) {
          const updatedGameState = game.initializeGame(initialGameState, playerIds);
          // Update session status to playing and set initial game state
          await update(ref(database, `sessions/${currentSession.id}`), {
            status: 'playing',
            gameData: {
              ...currentSession.gameData,
              gameState: updatedGameState
            }
          });
        } else {
          // For other games, use the original initialGameState
          await update(ref(database, `sessions/${currentSession.id}`), {
            status: 'playing',
            gameData: {
              ...currentSession.gameData,
              gameState: initialGameState
            }
          });
        }
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
      // Remove undefined values from the newGameState to prevent Firebase errors
      const cleanGameState = JSON.parse(JSON.stringify(newGameState));
      
      // Update the game state in the database
      await update(ref(database, `sessions/${currentSession.id}/gameData`), {
        gameState: cleanGameState
      });
      
      // Check if the game is completed and update session status
      if (newGameState.status === 'completed') {
        await update(ref(database, `sessions/${currentSession.id}`), {
          status: 'finished'
        });
      }
    } catch (error: any) {
      console.error('Error updating game state:', error);
      setError(error.message);
      throw error;
    }
  };

  // Finish a game
  const finishGame = async (): Promise<void> => {
    if (!user || !currentSession) return;
    
    try {
      // Update session status to finished
      await update(ref(database, `sessions/${currentSession.id}`), {
        status: 'finished'
      });
      
      // Don't clear current session - allow it to be visible on the dashboard
    } catch (error: any) {
      console.error('Error finishing game:', error);
      setError(error.message);
      throw error;
    }
  };

  // Reset a game
  const resetGame = async (): Promise<void> => {
    if (!user || !currentSession) return;
    
    // Verify user is the host
    const isHost = currentSession.players[user.uid]?.isHost;
    if (!isHost) {
      throw new Error('Only the host can reset the game');
    }
    
    try {
      // Reset session status to waiting
      await update(ref(database, `sessions/${currentSession.id}`), {
        status: 'waiting'
      });
    } catch (error: any) {
      console.error('Error resetting game:', error);
      setError(error.message);
      throw error;
    }
  };
  
  // Shuffle player matches in a tournament session
  const shuffleMatches = async (): Promise<void> => {
    if (!user || !currentSession) return;
    
    // Verify user is the host
    const isHost = currentSession.players[user.uid]?.isHost;
    if (!isHost) {
      throw new Error('Only the host can shuffle matches');
    }
    
    // Ensure this is a tournament session
    if (!currentSession.isTournament) {
      throw new Error('Shuffle matches is only available in tournament mode');
    }
    
    try {
      // Get current players
      const playerIds = Object.keys(currentSession.players || {});
      
      if (playerIds.length < 2) {
        throw new Error('At least 2 players are required to shuffle matches');
      }
      
      // Create a randomly shuffled array of player IDs
      const shuffledPlayerIds = [...playerIds].sort(() => Math.random() - 0.5);
      const playerMatches: Record<string, string> = {};
      
      // Create pairs for as many players as possible
      for (let i = 0; i < Math.floor(shuffledPlayerIds.length / 2) * 2; i += 2) {
        const player1Id = shuffledPlayerIds[i];
        const player2Id = shuffledPlayerIds[i + 1];
        
        playerMatches[player1Id] = player2Id;
        playerMatches[player2Id] = player1Id;
      }
      
      // Handle odd player count - last player waits for next round
      if (shuffledPlayerIds.length % 2 !== 0) {
        const lastPlayerId = shuffledPlayerIds[shuffledPlayerIds.length - 1];
        playerMatches[lastPlayerId] = 'waiting'; // Special value for waiting
      }
      
      // Reset the game state for all players
      const game = getGameById(currentSession.gameData?.gameId || '');
      if (!game) {
        throw new Error('Game not found in registry');
      }
      
      let initialGameState = game.getDefaultGameState();
      
      // Initialize game state for prisoner's dilemma
      if (game.id === 'prisoners-dilemma') {
        // For each match, initialize player data with scores of 0
        const playerData: Record<string, any> = {};
        
        // Only initialize playerData for players with active matches (not waiting)
        Object.keys(playerMatches).forEach(playerId => {
          if (playerMatches[playerId] !== 'waiting') {
            playerData[playerId] = {
              totalScore: 0,
              ready: false
            };
          }
        });
        
        initialGameState.playerData = playerData;
        initialGameState.status = 'in_progress';
        initialGameState.round = 1;
        
        // Ensure history is initialized as an array
        if (!Array.isArray(initialGameState.history)) {
          initialGameState.history = [];
        }
      }
      
      // Initialize game state for centipede game
      if (game.id === 'centipede-game' && game.initializeGame) {
        // For tournament mode with matches, we need to initialize each pair separately
        Object.keys(playerMatches).forEach(playerId => {
          const opponentId = playerMatches[playerId];
          
          // Only process each pair once and skip players who are waiting
          if (opponentId !== 'waiting' && playerId < opponentId) {
            // Use the initializeGame method to set up the game for this pair
            const pairPlayerIds = [playerId, opponentId];
            const gameStateForPair = game.initializeGame!(initialGameState, pairPlayerIds);
            
            // Copy the initialized state properties to the main gameState
            initialGameState.currentNode = gameStateForPair.currentNode;
            initialGameState.status = 'in_progress';
            
            // Set up playerData if it doesn't exist
            if (!initialGameState.playerData) {
              initialGameState.playerData = {};
            }
            
            // Add player data for this pair
            initialGameState.playerData[playerId] = gameStateForPair.playerData[playerId];
            initialGameState.playerData[opponentId] = gameStateForPair.playerData[opponentId];
          }
        });
      }
      
      // Update session with new matches
      await update(ref(database, `sessions/${currentSession.id}`), {
        playerMatches,
        gameData: {
          ...currentSession.gameData,
          gameState: initialGameState
        }
      });
    } catch (error: any) {
      console.error('Error shuffling matches:', error);
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
    finishGame,
    resetGame,
    shuffleMatches,
    loading,
    error
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}; 