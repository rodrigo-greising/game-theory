import { Game, GameState } from '@/types/games';

// Public Goods Game specific game state
export interface PublicGoodsGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, PublicGoodsPlayerData>;
  history: Array<{
    round: number;
    contributions: Record<string, number>;
    publicPool: number;
    multiplier: number;
    returns: Record<string, number>;
    scores: Record<string, number>;
  }>;
  initialEndowment: number; // Starting amount each player gets per round
  multiplier: number; // How much the public pool is multiplied before redistribution
}

export interface PublicGoodsPlayerData {
  totalScore: number;
  currentContribution?: number | null;
  ready: boolean;
}

// Implementation of the Public Goods Game
const PublicGoodsGame: Game = {
  id: 'public-goods-game',
  name: 'Public Goods Game',
  description: 'A game where players decide how much to contribute to a public pool, which is then multiplied and redistributed equally among all players.',
  minPlayers: 3,
  maxPlayers: 10, // Can be played with various numbers of players
  rules: `
    In the Public Goods Game, each player starts with an initial endowment of 20 points in each round.
    
    Players simultaneously decide how much of their endowment to contribute to a public pool (from 0 to 20 points).
    They keep any amount they don't contribute.
    
    The total amount in the public pool is multiplied by 2 and then divided equally among all players, regardless of their individual contributions.
    
    For example, with 4 players:
    - If all contribute 20 points, the public pool will be 80 points.
    - After multiplying by 2, there are 160 points to divide.
    - Each player receives 40 points (more than their initial contribution).
    - If one player contributes 0 while others contribute 20, that player keeps their 20 points plus gets an equal share from the public pool.
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
    
    This game explores social dilemmas, cooperation, and free-riding behavior.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Public Goods Game needs at least 3 players to be interesting
    return playerCount >= 3 && playerCount <= 10; 
  },
  getDefaultGameState: (): PublicGoodsGameState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: [],
      initialEndowment: 20, // Each player starts with 20 points per round
      multiplier: 2 // The public pool is multiplied by 2
    };
  }
};

export default PublicGoodsGame; 