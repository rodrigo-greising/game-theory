import { Game, GameState } from '@/types/games';

// Prisoner's Dilemma specific game state
export interface PrisonersDilemmaState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, PrisonerPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Decision>;
    scores: Record<string, number>;
  }>;
}

export type Decision = 'cooperate' | 'defect';

export interface PrisonerPlayerData {
  totalScore: number;
  currentDecision?: Decision | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  BOTH_COOPERATE: 3, // Both get a medium reward
  BOTH_DEFECT: 1,    // Both get a small punishment
  COOPERATE_WHEN_OTHER_DEFECTS: 0, // Sucker's payoff (worst outcome)
  DEFECT_WHEN_OTHER_COOPERATES: 5  // Temptation payoff (best outcome)
};

// Implementation of the Prisoner's Dilemma game (follows Liskov Substitution Principle)
const PrisonersDilemma: Game = {
  id: 'prisoners-dilemma',
  name: 'Prisoner\'s Dilemma',
  description: 'A classic game theory scenario where two players must decide whether to cooperate or defect, with rewards based on the combination of their choices.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In the Prisoner's Dilemma, you and another player are suspects in a crime.
    
    Each round, you must choose to either cooperate (remain silent) or defect (betray the other player).
    
    The payoffs are:
    - If both cooperate: Both get ${SCORING.BOTH_COOPERATE} points
    - If both defect: Both get ${SCORING.BOTH_DEFECT} points
    - If you cooperate but they defect: You get ${SCORING.COOPERATE_WHEN_OTHER_DEFECTS} points, they get ${SCORING.DEFECT_WHEN_OTHER_COOPERATES} points
    - If you defect but they cooperate: You get ${SCORING.DEFECT_WHEN_OTHER_COOPERATES} points, they get ${SCORING.COOPERATE_WHEN_OTHER_DEFECTS} points
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    return playerCount === 2; // Exactly 2 players required for this game
  },
  getDefaultGameState: (): PrisonersDilemmaState => {
    return {
      round: 0,
      maxRounds: 6,
      status: 'setup',
      playerData: {},
      history: []
    };
  }
};

export default PrisonersDilemma; 