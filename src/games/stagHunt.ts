import { Game, GameState } from '@/types/games';

// Stag Hunt specific game state
export interface StagHuntState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, StagHuntPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Choice>;
    scores: Record<string, number>;
  }>;
}

export type Choice = 'stag' | 'hare';

export interface StagHuntPlayerData {
  totalScore: number;
  currentChoice?: Choice | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  BOTH_HUNT_STAG: 4,    // Cooperation pays off (best outcome)
  BOTH_HUNT_HARE: 2,    // Safe but modest reward
  HUNT_STAG_ALONE: 0,   // Failure (worst outcome)
  HUNT_HARE_WHILE_OTHER_HUNTS_STAG: 3  // Safe individual choice
};

// Implementation of the Stag Hunt game
const StagHunt: Game = {
  id: 'stag-hunt',
  name: 'Stag Hunt',
  description: 'A game theory scenario where two hunters must decide whether to cooperate to hunt a stag (high reward, but requires cooperation) or hunt a hare individually (lower reward, but safer).',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In the Stag Hunt, you and another player are hunters deciding what to hunt.
    
    Each round, you must choose to either hunt a stag (which requires cooperation) or hunt a hare (which you can do alone).
    
    The payoffs are:
    - If both hunt stag: Both get ${SCORING.BOTH_HUNT_STAG} points (highest reward)
    - If both hunt hare: Both get ${SCORING.BOTH_HUNT_HARE} points (modest reward)
    - If you hunt stag but they hunt hare: You get ${SCORING.HUNT_STAG_ALONE} points, they get ${SCORING.HUNT_HARE_WHILE_OTHER_HUNTS_STAG} points
    - If you hunt hare but they hunt stag: You get ${SCORING.HUNT_HARE_WHILE_OTHER_HUNTS_STAG} points, they get ${SCORING.HUNT_STAG_ALONE} points
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Stag Hunt, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): StagHuntState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: []
    };
  }
};

export default StagHunt; 