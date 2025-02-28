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
  name: 'Juego del Ciempiés',
  description: 'Un juego secuencial donde los jugadores se turnan para decidir si continuar (aumentando la recompensa potencial) o detenerse (asegurando una recompensa menor inmediatamente).',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En el Juego del Ciempiés, dos jugadores se turnan para decidir si continuar o detener el juego.
    
    El juego comienza con un pequeño bote de puntos (2 puntos). Cada vez que un jugador elige "continuar", 
    el bote crece (se duplica), pero el control pasa al otro jugador.
    
    Si un jugador elige "detenerse", el juego termina inmediatamente. El jugador que detiene obtiene la parte 
    mayor del bote actual, y el otro jugador obtiene una parte menor.
    
    Las recompensas aumentan a medida que avanza el juego:
    - Nodo 1: Detenerse → (2, 1) puntos (Jugador 1 obtiene 2, Jugador 2 obtiene 1)
    - Nodo 2: Detenerse → (1, 4) puntos (Jugador 1 obtiene 1, Jugador 2 obtiene 4)
    - Nodo 3: Detenerse → (6, 3) puntos (Jugador 1 obtiene 6, Jugador 2 obtiene 3)
    - Nodo 4: Detenerse → (3, 12) puntos (Jugador 1 obtiene 3, Jugador 2 obtiene 12)
    - Nodo 5: Detenerse → (18, 9) puntos (Jugador 1 obtiene 18, Jugador 2 obtiene 9)
    - Nodo 6: Detenerse → (9, 36) puntos (Jugador 1 obtiene 9, Jugador 2 obtiene 36)
    
    Si el juego llega al nodo final, termina automáticamente con recompensas de (36, 18).
    
    El juego demuestra conceptos de confianza, inducción hacia atrás y racionalidad.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Juego del Ciempiés</h3>
    
    <p>El Juego del Ciempiés fue introducido por el economista Robert W. Rosenthal en 1981 como un desafío a la teoría de juegos clásica, específicamente al concepto de inducción hacia atrás y al equilibrio perfecto en subjuegos. El nombre "ciempiés" hace referencia a la estructura visual del árbol de decisiones del juego, que se asemeja a un ciempiés con múltiples segmentos.</p>
    
    <p>Este juego es famoso por la brecha dramática entre lo que predice la teoría (terminar el juego inmediatamente) y lo que hacen los jugadores humanos reales (típicamente continuar durante varias etapas). Según la inducción hacia atrás, un principio clave en teoría de juegos, los jugadores perfectamente racionales deberían parar en el primer nodo, ya que pueden prever que en el último nodo su oponente elegiría parar, lo que significa que en el penúltimo nodo ellos deberían parar, y así sucesivamente hacia atrás.</p>
    
    <p>Sin embargo, los experimentos muestran consistentemente que la mayoría de los jugadores continúan durante varias etapas, generando mayores recompensas totales para ambos jugadores. Esta discrepancia ha alimentado investigaciones sobre la racionalidad limitada, el papel de la confianza y la cooperación, y los límites del pensamiento estratégico humano.</p>
    
    <p>El Juego del Ciempiés ha sido fundamental en áreas como la economía conductual, la psicología cognitiva y la teoría de la decisión. Se ha utilizado para estudiar cómo las personas razonan sobre secuencias de decisiones, cómo forman creencias sobre las acciones de otros, y cómo equilibran la maximización de ganancias a corto plazo frente a la cooperación que podría producir mayores ganancias generales.</p>
    
    <p>En un sentido más amplio, este juego ilustra situaciones reales donde la confianza y la reciprocidad pueden generar beneficios mutuos, pero donde también existe la tentación de aprovecharse de la cooperación de los demás, como en negociaciones comerciales prolongadas, diplomacia internacional, o construcción de relaciones a largo plazo.</p>
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