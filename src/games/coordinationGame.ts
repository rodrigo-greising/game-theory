import { Game, GameState } from '@/types/games';

// Coordination Game specific game state
export interface CoordinationGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, CoordinationPlayerData>;
  history: Array<{
    round: number;
    choices: Record<string, Choice>;
    scores: Record<string, number>;
  }>;
  options: Choice[]; // Available coordination options
}

export type Choice = 'A' | 'B';

export interface CoordinationPlayerData {
  totalScore: number;
  currentChoice?: Choice | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  COORDINATE: 10, // Both choose the same option
  FAIL: 0         // Choose different options
};

// Implementation of the Coordination Game
const CoordinationGame: Game = {
  id: 'coordination-game',
  name: 'Coordination Game',
  description: 'A pure coordination game where players benefit most by choosing the same option as each other.',
  minPlayers: 2,
  maxPlayers: 10, // Can be played with various numbers of players
  rules: `
    In the Coordination Game, all players must try to choose the same option as the other players.
    
    Each player simultaneously chooses one of two options: A or B.
    
    The payoffs are:
    - If all players choose the same option (either all A or all B): Everyone gets ${SCORING.COORDINATE} points
    - If there's any disagreement: Everyone gets ${SCORING.FAIL} points
    
    For example, with 3 players:
    - If all 3 choose A: Everyone gets 10 points
    - If 2 choose A and 1 chooses B: Everyone gets 0 points
    
    The challenge is to coordinate without communication.
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
    
    This game demonstrates focal points, equilibrium selection, and coordination without conflict.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Coordination game works with 2 or more players
    return playerCount >= 2 && playerCount <= 10; 
  },
  getDefaultGameState: (): CoordinationGameState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: [],
      options: ['A', 'B']
    };
  }
};

export default CoordinationGame; 