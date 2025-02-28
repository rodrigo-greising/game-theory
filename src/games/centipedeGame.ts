import { Game, GameState } from '@/types/games';

// Centipede Game specific game state
export interface CentipedeGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, CentipedePlayerData>;
  history: Array<{
    round: number;
    nodeReached: number;
    stoppedById?: string;
    scores: Record<string, number>;
  }>;
  currentNode: number; // Tracks the current position in the game tree
  currentTurnPlayerId?: string; // Which player's turn it is
  isGameOver: boolean;
  payoffSchedule: Array<[number, number]>; // Array of [player1Payoff, player2Payoff] for each node
}

export type Decision = 'continue' | 'stop';

export interface CentipedePlayerData {
  totalScore: number;
  currentDecision?: Decision | null;
  ready: boolean;
}

// Implementation of the Centipede Game
const CentipedeGame: Game = {
  id: 'centipede-game',
  name: 'Centipede Game',
  description: 'A sequential game where players take turns deciding whether to continue (increasing the potential payoff) or stop (securing a smaller payoff immediately).',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    In the Centipede Game, two players take turns deciding whether to continue or stop the game.
    
    The game starts with a small pot of points (2 points). Each time a player chooses to "continue", 
    the pot grows larger (doubles), but control passes to the other player.
    
    If a player chooses to "stop", the game ends immediately. The player who stops gets the larger 
    share of the current pot, and the other player gets a smaller share.
    
    Payoffs increase as the game progresses:
    - Node 1: Stop → (2, 1) points (Player 1 gets 2, Player 2 gets 1)
    - Node 2: Stop → (1, 4) points (Player 1 gets 1, Player 2 gets 4)
    - Node 3: Stop → (6, 3) points (Player 1 gets 6, Player 2 gets 3)
    - Node 4: Stop → (3, 12) points (Player 1 gets 3, Player 2 gets 12)
    - Node 5: Stop → (18, 9) points (Player 1 gets 18, Player 2 gets 9)
    - Node 6: Stop → (9, 36) points (Player 1 gets 9, Player 2 gets 36)
    
    If the game reaches the final node, it automatically ends with payoffs of (36, 18).
    
    The game demonstrates concepts of trust, backward induction, and rationality.
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Centipede Game, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): CentipedeGameState => {
    return {
      round: 1,
      maxRounds: 1, // Centipede is typically played once per round
      status: 'in_progress',
      playerData: {},
      history: [],
      currentNode: 0,  // Start at node 0 (first decision point)
      isGameOver: false,
      // Payoff schedule [player1Payoff, player2Payoff] for each node
      payoffSchedule: [
        [2, 1],   // Node 1 (Player 1's turn)
        [1, 4],   // Node 2 (Player 2's turn)
        [6, 3],   // Node 3 (Player 1's turn)
        [3, 12],  // Node 4 (Player 2's turn)
        [18, 9],  // Node 5 (Player 1's turn)
        [9, 36],  // Node 6 (Player 2's turn)
        [36, 18]  // Final node (automatic end)
      ]
    };
  },
  
  // Initialize the game before it starts
  initializeGame: (gameState: CentipedeGameState, playerIds: string[]): CentipedeGameState => {
    // Make sure there are exactly 2 players
    if (playerIds.length !== 2) {
      throw new Error('Centipede Game requires exactly 2 players');
    }
    
    // Initialize player data
    const playerData: Record<string, CentipedePlayerData> = {};
    playerIds.forEach(playerId => {
      playerData[playerId] = {
        totalScore: 0,
        currentDecision: null,
        ready: false
      };
    });
    
    // Player 1 (first in the array) goes first in Centipede Game
    const firstPlayerId = playerIds[0];
    
    return {
      ...gameState,
      playerData,
      currentTurnPlayerId: firstPlayerId,
      currentNode: 0,
      status: 'in_progress'
    };
  }
};

export default CentipedeGame; 