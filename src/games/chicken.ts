import { Game, GameState } from '@/types/games';

// Chicken game specific game state
export interface ChickenState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, ChickenPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Strategy>;
    scores: Record<string, number>;
  }>;
}

export type Strategy = 'swerve' | 'straight';

export interface ChickenPlayerData {
  totalScore: number;
  currentStrategy?: Strategy | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  BOTH_SWERVE: 3,              // Both choose safety - moderate outcome
  BOTH_STRAIGHT: 0,            // Crash! - worst outcome for both
  SWERVE_WHEN_OTHER_STRAIGHT: 1, // Being "chicken" - low-moderate outcome
  STRAIGHT_WHEN_OTHER_SWERVES: 5  // "Winning" - best outcome
};

// Implementation of the Chicken (Hawk-Dove) game
const Chicken: Game = {
  id: 'chicken',
  name: 'Chicken (Hawk-Dove)',
  description: 'A game of brinkmanship where two players must decide whether to swerve or go straight, with the worst outcome occurring if neither yields.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In the game of Chicken, you and another player are driving toward each other.
    
    Each round, you must choose to either swerve (act cautiously) or go straight (act aggressively).
    
    The payoffs are:
    - If both swerve: Both get ${SCORING.BOTH_SWERVE} points (moderate outcome)
    - If both go straight: Both get ${SCORING.BOTH_STRAIGHT} points (crash - worst outcome!)
    - If you swerve but they go straight: You get ${SCORING.SWERVE_WHEN_OTHER_STRAIGHT} points, they get ${SCORING.STRAIGHT_WHEN_OTHER_SWERVES} points
    - If you go straight but they swerve: You get ${SCORING.STRAIGHT_WHEN_OTHER_SWERVES} points, they get ${SCORING.SWERVE_WHEN_OTHER_STRAIGHT} points
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Chicken, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): ChickenState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: []
    };
  }
};

export default Chicken; 