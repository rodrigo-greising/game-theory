import { Game, GameState } from '@/types/games';

// Ultimatum Game specific game state
export interface UltimatumGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, UltimatumPlayerData>;
  history: Array<{
    round: number;
    proposal?: Proposal;
    response?: Response;
    scores: Record<string, number>;
  }>;
  playerRoles: Record<string, PlayerRole>; // Track which player is proposer/responder
  totalAmount: number; // The amount to be divided
  currentStage: 'proposal' | 'response' | 'results'; // Track the stage within a round
}

export interface Proposal {
  proposerId: string;
  amount: number; // Amount offered to the responder
}

export type Response = 'accept' | 'reject';
export type PlayerRole = 'proposer' | 'responder';

export interface UltimatumPlayerData {
  totalScore: number;
  proposal?: number | null; // For proposer
  response?: Response | null; // For responder
  ready: boolean;
}

// Implementation of the Ultimatum Game
const UltimatumGame: Game = {
  id: 'ultimatum-game',
  name: 'Ultimatum Game',
  description: 'A game where one player proposes how to divide a sum of money, and the other player can accept or reject the offer. If rejected, both get nothing.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In the Ultimatum Game, a sum of money (100 points) must be divided between two players.
    
    One player is designated as the "proposer" and the other as the "responder".
    
    The game has two stages in each round:
    1. The proposer offers a division of the money (e.g., "I'll take 60, you get 40").
    2. The responder can either accept or reject the offer.
    
    If the responder accepts, both players receive the proposed amounts.
    If the responder rejects, both players receive nothing for that round.
    
    The game consists of multiple rounds, with players switching roles between rounds.
    The player with the highest total score at the end wins.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Ultimatum Game, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): UltimatumGameState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: [],
      playerRoles: {},
      totalAmount: 100, // Default amount to divide
      currentStage: 'proposal'
    };
  }
};

export default UltimatumGame; 