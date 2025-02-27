import { Game, GameState } from '@/types/games';

// Matching Pennies specific game state
export interface MatchingPenniesState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, MatchingPenniesPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Choice>;
    scores: Record<string, number>;
  }>;
  playerRoles: Record<string, PlayerRole>; // Track which player is matcher/mismatcher
}

export type Choice = 'heads' | 'tails';
export type PlayerRole = 'matcher' | 'mismatcher';

export interface MatchingPenniesPlayerData {
  totalScore: number;
  currentChoice?: Choice | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  MATCHER_WINS: { MATCHER: 1, MISMATCHER: -1 }, // Matcher wins when choices match
  MISMATCHER_WINS: { MATCHER: -1, MISMATCHER: 1 } // Mismatcher wins when choices differ
};

// Implementation of the Matching Pennies game
const MatchingPennies: Game = {
  id: 'matching-pennies',
  name: 'Matching Pennies',
  description: 'A zero-sum game where one player wins if both players choose the same option, while the other player wins if they choose different options.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In Matching Pennies, you and another player each choose between Heads or Tails.
    
    One player is designated as the "matcher" and the other as the "mismatcher".
    
    The matcher wins if both players choose the same option (both Heads or both Tails).
    The mismatcher wins if players choose different options (one Heads, one Tails).
    
    The payoffs are:
    - If choices match: Matcher gets 1 point, Mismatcher loses 1 point
    - If choices differ: Matcher loses 1 point, Mismatcher gets 1 point
    
    This is a zero-sum game - one player's gain is always equal to the other player's loss.
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Matching Pennies, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): MatchingPenniesState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: [],
      playerRoles: {}
    };
  }
};

export default MatchingPennies; 