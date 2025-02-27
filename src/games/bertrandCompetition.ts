import { Game, GameState } from '@/types/games';

// Bertrand Competition specific game state
export interface BertrandCompetitionState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, BertrandPlayerData>;
  history: Array<{
    round: number;
    prices: Record<string, number>;
    marketShares: Record<string, number>;
    profits: Record<string, number>;
    scores: Record<string, number>;
  }>;
  maxPrice: number; // Maximum allowed price
  minPrice: number; // Minimum allowed price
  marginalCost: number; // Cost to produce one unit
  marketDemand: number; // Total market demand at lowest price
}

export interface BertrandPlayerData {
  totalScore: number;
  currentPrice?: number | null;
  ready: boolean;
}

// Implementation of the Bertrand Competition Game
const BertrandCompetition: Game = {
  id: 'bertrand-competition',
  name: 'Bertrand Competition',
  description: 'An economic game where firms compete on price, with consumers buying from the firm offering the lowest price.',
  minPlayers: 2,
  maxPlayers: 5, // Can be played with various numbers of players
  rules: `
    In Bertrand Competition, you are a firm competing with others by setting prices.
    
    Each round:
    - All firms simultaneously set their price for an identical product.
    - Consumers will buy only from the firm(s) offering the lowest price.
    - If multiple firms set the same lowest price, they share the market equally.
    
    The game parameters:
    - Marginal cost (cost to produce one unit): $10
    - Maximum price: $50
    - Minimum price: $10 (can't sell below cost)
    - Market demand: 100 units (at lowest price)
    
    Profit calculation:
    - Your profit = (Your price - Marginal cost) × Your market share × Market demand
    
    For example:
    - If you set $20 and another firm sets $30, you get the entire market.
      Your profit: ($20 - $10) × 100 = $1,000
    - If you and another firm both set $20, you split the market.
      Your profit: ($20 - $10) × 50 = $500
    - If your price is higher than another firm's, you get no customers and zero profit.
    
    The game consists of multiple rounds. The player with the highest total profit at the end wins.
    
    This game illustrates price competition, Nash equilibrium, and the theory of the firm.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Bertrand Competition works with 2 or more players
    return playerCount >= 2 && playerCount <= 5;
  },
  getDefaultGameState: (): BertrandCompetitionState => {
    return {
      round: 1,
      maxRounds: 5,
      status: 'in_progress',
      playerData: {},
      history: [],
      maxPrice: 50,
      minPrice: 10,
      marginalCost: 10,
      marketDemand: 100
    };
  }
};

export default BertrandCompetition; 