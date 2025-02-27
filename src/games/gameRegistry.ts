import { Game, GameOption, GameRegistry } from '@/types/games';
import PrisonersDilemma from './prisonersDilemma';
import StagHunt from './stagHunt';
import Chicken from './chicken';

// Registry of all available games (follows Open/Closed principle)
const games: GameRegistry = {
  [PrisonersDilemma.id]: PrisonersDilemma,
  [StagHunt.id]: StagHunt,
  [Chicken.id]: Chicken,
  // Additional games will be added here in the future
};

// Get a list of all available games for the UI
export const getGameOptions = (): GameOption[] => {
  return Object.values(games).map(game => ({
    id: game.id,
    name: game.name,
    description: game.description,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers
  }));
};

// Get a specific game by ID
export const getGameById = (gameId: string): Game | undefined => {
  return games[gameId];
};

// Validate if a game exists
export const gameExists = (gameId: string): boolean => {
  return !!games[gameId];
};

// Check if the player count is valid for a specific game
export const isValidPlayerCount = (gameId: string, playerCount: number): boolean => {
  const game = games[gameId];
  if (!game) return false;
  
  return game.validatePlayerCount(playerCount);
};

export default games; 