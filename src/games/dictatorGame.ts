import { Game, GameState } from '@/types/games';

// Dictator Game specific game state
export interface DictatorGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, DictatorPlayerData>;
  history: Array<{
    round: number;
    allocation?: Allocation;
    scores: Record<string, number>;
  }>;
  playerRoles: Record<string, PlayerRole>; // Track which player is dictator/recipient
  totalAmount: number; // The amount to be divided
}

export interface Allocation {
  dictatorId: string;
  recipientAmount: number; // Amount given to the recipient
}

export type PlayerRole = 'dictator' | 'recipient';

export interface DictatorPlayerData {
  totalScore: number;
  allocation?: number | null; // For dictator (amount to give to recipient)
  ready: boolean;
}

// Implementation of the Dictator Game
const DictatorGame: Game = {
  id: 'dictator-game',
  name: 'Dictator Game',
  description: 'A game where one player unilaterally decides how to divide a sum of money between themselves and another player.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In the Dictator Game, a sum of money (100 points) must be divided between two players.
    
    One player is designated as the "dictator" and the other as the "recipient".
    
    The dictator unilaterally decides how to divide the money, with no input from the recipient.
    The recipient must accept whatever amount the dictator offers.
    
    For example, if the dictator decides to keep 70 points and give 30 to the recipient, that's the final allocation.
    
    The game consists of multiple rounds, with players switching roles between rounds.
    The player with the highest total score at the end wins.
    
    This game explores concepts of fairness, altruism, and self-interest.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Dictator Game, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): DictatorGameState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      playerRoles: {},
      totalAmount: 100 // Default amount to divide
    };
  }
};

export default DictatorGame; 