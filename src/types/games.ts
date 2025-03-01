// Game interfaces and types
import { Player } from '@/context/SessionContext';

// Base game interface (follows Single Responsibility and Interface Segregation principles)
export interface Game {
  id: string;
  name: string;
  description: string; 
  minPlayers: number;
  maxPlayers: number;
  rules: string;
  educationalContent?: string; // Information about the game's origins and educational value
  validatePlayerCount: (playerCount: number) => boolean;
  getDefaultGameState: () => any;
  initializeGame?: (gameState: any, playerIds: string[]) => any; // Optional method to initialize game with players
}

// Game state interface (can be extended by specific games)
export interface GameState {
  round: number;
  playerData: Record<string, any>;
  status: 'setup' | 'in_progress' | 'completed';
  results?: any;
}

// Registry of all available games (follows Open/Closed principle)
export interface GameRegistry {
  [gameId: string]: Game;
}

// Game metadata for selection UI
export interface GameOption {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

// Updated Session type to include game information
export interface GameSessionData {
  gameId: string;
  gameState?: GameState;
  settings?: Record<string, any>;
} 