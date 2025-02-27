import { Game, GameState } from '@/types/games';

// Traveler's Dilemma specific game state
export interface TravelersDilemmaState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, TravelersDilemmaPlayerData>;
  history: Array<{
    round: number;
    claims: Record<string, number>;
    rewards: Record<string, number>;
    scores: Record<string, number>;
  }>;
  minClaim: number; // Minimum allowed claim
  maxClaim: number; // Maximum allowed claim
  bonus: number; // Bonus/penalty amount
}

export interface TravelersDilemmaPlayerData {
  totalScore: number;
  currentClaim?: number | null;
  ready: boolean;
}

// Implementation of the Traveler's Dilemma Game
const TravelersDilemma: Game = {
  id: 'travelers-dilemma',
  name: 'Traveler\'s Dilemma',
  description: 'A game where two players independently choose a number within a range, and the lower number wins, with bonuses and penalties that create a strategic paradox.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In the Traveler's Dilemma, you and another player are trying to claim compensation for identical lost items.
    
    Each player must independently claim a value between $2 and $100 for their lost item.
    
    The payoffs are determined as follows:
    - If both players claim the same amount, both receive that amount.
    - If the claims differ, both players receive the LOWER of the two claims.
    - Additionally, the player who claimed the lower amount receives a bonus of $2.
    - The player who claimed the higher amount incurs a penalty of $2.
    
    For example:
    - If Player 1 claims $80 and Player 2 claims $70, both receive $70.
    - Additionally, Player 2 gets a $2 bonus (total $72) and Player 1 pays a $2 penalty (total $68).
    
    The rational strategy seems to be to undercut the other player slightly, but this logic leads both players 
    toward the minimum claim, creating a paradox between rationality and mutual benefit.
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Traveler's Dilemma, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): TravelersDilemmaState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: [],
      minClaim: 2,
      maxClaim: 100,
      bonus: 2 // The bonus/penalty amount
    };
  }
};

export default TravelersDilemma; 