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
  description: 'A game where players independently choose a number within a range. The lowest claim wins, with bonuses and penalties that create a strategic paradox.',
  minPlayers: 2,
  maxPlayers: 8, // Extended to support multiple players
  rules: `
    In the Traveler's Dilemma, all players are trying to claim compensation for identical lost items.
    
    Each player must independently claim a value between $2 and $100 for their lost item.
    
    The payoffs are determined as follows:
    - The lowest claim among all players becomes the base payment for everyone.
    - Players who made the lowest claim receive a bonus of $2.
    - Players who made higher claims incur a penalty of $2.
    - If all players claim the same amount, everyone receives that amount with no bonuses or penalties.
    
    For example with 3 players:
    - If Player 1 claims $80, Player 2 claims $70, and Player 3 claims $90:
      - All players receive a base payment of $70 (the lowest claim)
      - Player 2 gets a $2 bonus (total $72)
      - Players 1 and 3 pay a $2 penalty (total $68 and $68 respectively)
    
    The rational strategy seems to be to undercut the other players slightly, but this logic leads all players 
    toward the minimum claim, creating a paradox between rationality and mutual benefit.
    
    The game consists of multiple rounds. The player with the highest total score at the end wins.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Traveler's Dilemma, we require at least 2 players
    return playerCount >= 2 && playerCount <= 8; 
  },
  getDefaultGameState: (): TravelersDilemmaState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      minClaim: 2,
      maxClaim: 100,
      bonus: 2 // The bonus/penalty amount
    };
  },
  // Initialize the game for the specific players
  initializeGame: (gameState: TravelersDilemmaState, playerIds: string[]): TravelersDilemmaState => {
    // Make sure there are at least 2 players
    if (playerIds.length < 2) {
      throw new Error('Traveler\'s Dilemma requires at least 2 players');
    }
    
    // Initialize player data
    const playerData: Record<string, TravelersDilemmaPlayerData> = {};
    playerIds.forEach(playerId => {
      playerData[playerId] = {
        totalScore: 0,
        currentClaim: null,
        ready: false
      };
    });
    
    return {
      ...gameState,
      playerData,
      status: 'in_progress',
      round: 1,
      history: []
    };
  }
};

export default TravelersDilemma; 