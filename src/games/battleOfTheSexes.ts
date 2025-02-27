import { Game, GameState } from '@/types/games';

// Event Coordination Dilemma specific game state
export interface BattleOfTheSexesState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, BattleOfTheSexesPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Preference>;
    scores: Record<string, number>;
  }>;
}

export type Preference = 'opera' | 'football';

export interface BattleOfTheSexesPlayerData {
  totalScore: number;
  currentPreference?: Preference | null;
  ready: boolean;
  preferredEvent: Preference; // Each player has their own preference
}

// Constants for scoring
export const SCORING = {
  BOTH_CHOOSE_OPERA: { OPERA_LOVER: 3, FOOTBALL_LOVER: 2 },    // Opera fan gets more utility
  BOTH_CHOOSE_FOOTBALL: { OPERA_LOVER: 2, FOOTBALL_LOVER: 3 }, // Football fan gets more utility
  DIFFERENT_CHOICES: 0                                         // Both get nothing if they don't coordinate
};

// Implementation of the Event Coordination Dilemma game
const BattleOfTheSexes: Game = {
  id: 'battle-of-the-sexes',
  name: 'Event Coordination Dilemma',
  description: 'A coordination game where two players prefer different events but both would rather attend the same event than go to separate ones.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In the Event Coordination Dilemma, you and another player are deciding which event to attend: Opera or Football.
    
    One player prefers Opera, the other prefers Football, but both would rather attend the same event together than go to different events.
    
    Each round, you must choose which event to attend.
    
    The payoffs are:
    - If both choose Opera: Opera fan gets 3 points, Football fan gets 2 points
    - If both choose Football: Opera fan gets 2 points, Football fan gets 3 points
    - If you choose different events: Both get 0 points (worst outcome)
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Event Coordination Dilemma, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): BattleOfTheSexesState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: []
    };
  }
};

export default BattleOfTheSexes; 