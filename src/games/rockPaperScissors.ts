import { Game, GameState } from '@/types/games';

// Rock-Paper-Scissors specific game state
export interface RockPaperScissorsState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, RockPaperScissorsPlayerData>;
  history: Array<{
    round: number;
    moves: Record<string, Move>;
    results: Record<string, Result>;
    scores: Record<string, number>;
  }>;
}

export type Move = 'rock' | 'paper' | 'scissors';
export type Result = 'win' | 'lose' | 'draw';

export interface RockPaperScissorsPlayerData {
  totalScore: number;
  currentMove?: Move | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  WIN: 1,
  LOSE: -1,
  DRAW: 0
};

// Implementation of the Rock-Paper-Scissors Game
const RockPaperScissors: Game = {
  id: 'rock-paper-scissors',
  name: 'Rock-Paper-Scissors',
  description: 'A classic zero-sum game where each choice beats one option and loses to another, illustrating cyclic dominance.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In Rock-Paper-Scissors, you and your opponent simultaneously choose Rock, Paper, or Scissors.
    
    The rules are:
    - Rock beats Scissors
    - Scissors beats Paper
    - Paper beats Rock
    - If both players choose the same option, it's a draw
    
    The scoring is:
    - Win: +1 point
    - Lose: -1 point
    - Draw: 0 points
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
    
    This game illustrates mixed-strategy equilibria, unpredictability, and cyclic dominance.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Rock-Paper-Scissors, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): RockPaperScissorsState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: []
    };
  }
};

export default RockPaperScissors; 