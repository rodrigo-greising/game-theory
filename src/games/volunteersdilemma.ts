import { Game, GameState } from '@/types/games';

// Volunteer's Dilemma specific game state
export interface VolunteersDilemmaState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, VolunteersDilemmaPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Decision>;
    volunteersCount: number;
    scores: Record<string, number>;
  }>;
  benefitAll: number;
  costVolunteer: number;
}

export type Decision = 'volunteer' | 'not_volunteer';

export interface VolunteersDilemmaPlayerData {
  totalScore: number;
  currentDecision?: Decision | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  VOLUNTEER_COST: 4,  // Cost incurred by volunteering
  PUBLIC_BENEFIT: 10, // Benefit everyone gets if at least one person volunteers
  NO_VOLUNTEER_PENALTY: -8 // Penalty everyone gets if no one volunteers
};

// Implementation of the Volunteer's Dilemma Game
const VolunteersDilemma: Game = {
  id: 'volunteers-dilemma',
  name: 'Volunteer\'s Dilemma',
  description: 'A game where a group benefits if at least one person volunteers to incur a cost, but if no one volunteers, everyone suffers a greater loss.',
  minPlayers: 2,
  maxPlayers: 10, // Can be played with various numbers of players
  rules: `
    In the Volunteer's Dilemma, a group faces a situation where:
    
    - If at least one player volunteers, ALL players receive a benefit (${SCORING.PUBLIC_BENEFIT} points)
    - However, each volunteer incurs a personal cost (${SCORING.VOLUNTEER_COST} points)
    - If NO ONE volunteers, EVERYONE suffers a penalty (${SCORING.NO_VOLUNTEER_PENALTY} points)
    
    Each player secretly decides whether to volunteer or not.
    
    The payoffs are:
    - If you volunteer: ${SCORING.PUBLIC_BENEFIT - SCORING.VOLUNTEER_COST} points (benefit minus cost)
    - If you don't volunteer but someone else does: ${SCORING.PUBLIC_BENEFIT} points (full benefit, no cost)
    - If no one volunteers: ${SCORING.NO_VOLUNTEER_PENALTY} points (penalty for everyone)
    
    For example, in a group of 5 players:
    - If 1 player volunteers: They get 6 points, the other 4 players get 10 points each
    - If 2 players volunteer: Both volunteers get 6 points, the other 3 players get 10 points each
    - If no one volunteers: Everyone gets -8 points
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
    
    This game explores diffusion of responsibility and free-riding behavior.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Volunteer's Dilemma becomes more interesting with more players
    return playerCount >= 2 && playerCount <= 10;
  },
  getDefaultGameState: (): VolunteersDilemmaState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      benefitAll: 10, // Benefit to all if at least one volunteers
      costVolunteer: 4 // Cost incurred by each volunteer
    };
  }
};

export default VolunteersDilemma; 