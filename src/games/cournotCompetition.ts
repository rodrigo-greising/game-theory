import { Game, GameState } from '@/types/games';

// Cournot Competition specific game state
export interface CournotCompetitionState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, CournotPlayerData>;
  history: Array<{
    round: number;
    quantities: Record<string, number>;
    totalQuantity: number;
    marketPrice: number;
    profits: Record<string, number>;
    scores: Record<string, number>;
  }>;
  maxQuantity: number; // Maximum production quantity per player
  minQuantity: number; // Minimum production quantity
  marginalCost: number; // Cost to produce one unit
  demandIntercept: number; // Price when quantity is 0
  demandSlope: number; // How price drops as quantity increases
}

export interface CournotPlayerData {
  totalScore: number;
  currentQuantity?: number | null;
  ready: boolean;
}

// Implementation of the Cournot Competition Game
const CournotCompetition: Game = {
  id: 'cournot-competition',
  name: 'Cournot Competition',
  description: 'An economic game where firms compete by choosing production quantities, which together determine the market price.',
  minPlayers: 2,
  maxPlayers: 5, // Can be played with various numbers of players
  rules: `
    In Cournot Competition, you are a firm competing with others by choosing how much to produce.
    
    Each round:
    - All firms simultaneously choose their production quantity.
    - The total market quantity determines the market price according to the demand curve.
    - The market price applies to all firms.
    
    The game parameters:
    - Marginal cost (cost to produce one unit): $10
    - Maximum production: 20 units per firm
    - Minimum production: 0 units
    - Demand function: P = 100 - Q (Price = 100 - Total Quantity)
    
    Profit calculation:
    - Market price = 100 - (Sum of all quantities)
    - Your profit = (Market price - Marginal cost) × Your quantity
    
    For example, with two firms:
    - If you produce 20 units and the other firm produces 30 units:
    - Market price = 100 - (20 + 30) = $50
    - Your profit = ($50 - $10) × 20 = $800
    
    The game consists of multiple rounds. The player with the highest total profit at the end wins.
    
    This game illustrates quantity competition, Nash equilibrium, and oligopoly theory.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Cournot Competition works with 2 or more players
    return playerCount >= 2 && playerCount <= 5;
  },
  getDefaultGameState: (): CournotCompetitionState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      maxQuantity: 20,
      minQuantity: 0,
      marginalCost: 10,
      demandIntercept: 100,
      demandSlope: 1
    };
  },
  
  // Initialize the game for the specific players
  initializeGame: (gameState: CournotCompetitionState, playerIds: string[]): CournotCompetitionState => {
    // Make sure there are at least 2 players
    if (playerIds.length < 2) {
      throw new Error('Cournot Competition requires at least 2 players');
    }
    
    // Initialize player data
    const playerData: Record<string, CournotPlayerData> = {};
    playerIds.forEach(playerId => {
      playerData[playerId] = {
        totalScore: 0,
        currentQuantity: null,
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

export default CournotCompetition; 