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
  name: 'Dilema del Viajero',
  description: 'Un juego donde los jugadores eligen independientemente un número dentro de un rango. La reclamación más baja gana, con bonificaciones y penalizaciones que crean una paradoja estratégica.',
  minPlayers: 2,
  maxPlayers: 8, // Extended to support multiple players
  rules: `
    En el Dilema del Viajero, todos los jugadores intentan reclamar una compensación por artículos idénticos perdidos.
    
    Cada jugador debe reclamar independientemente un valor entre $2 y $100 por su artículo perdido.
    
    Las recompensas se determinan de la siguiente manera:
    - La reclamación más baja entre todos los jugadores se convierte en el pago base para todos.
    - Los jugadores que hicieron la reclamación más baja reciben una bonificación de $2.
    - Los jugadores que hicieron reclamaciones más altas incurren en una penalización de $2.
    - Si todos los jugadores reclaman la misma cantidad, todos reciben esa cantidad sin bonificaciones ni penalizaciones.
    
    Por ejemplo, con 3 jugadores:
    - Si el Jugador 1 reclama $80, el Jugador 2 reclama $70, y el Jugador 3 reclama $90:
      - Todos los jugadores reciben un pago base de $70 (la reclamación más baja)
      - El Jugador 2 obtiene una bonificación de $2 (total $72)
      - Los Jugadores 1 y 3 pagan una penalización de $2 (total $68 y $68 respectivamente)
    
    La estrategia racional parece ser reclamar ligeramente menos que los otros jugadores, pero esta lógica lleva a todos los jugadores 
    hacia la reclamación mínima, creando una paradoja entre la racionalidad y el beneficio mutuo.
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Dilema del Viajero</h3>
    
    <p>El Dilema del Viajero fue planteado por primera vez por el economista Kaushik Basu en 1994, quien presentó el problema como una paradoja en la que la solución matemáticamente "racional" contradice fuertemente la intuición y el comportamiento observado en las personas reales.</p>
    
    <p>El escenario original describía a dos viajeros cuyas idénticas antigüedades se rompieron durante un vuelo. La aerolínea les pide que reclamen el valor independientemente, pero con la condición de que si hacen reclamaciones diferentes, asumirán que el valor real es el más bajo de los dos, dando esa cantidad a ambos, pero con una bonificación para quien hizo la reclamación menor y una penalización para quien la hizo mayor.</p>
    
    <p>Este juego es significativo en la teoría de juegos porque ilustra una brecha entre la predicción teórica (la solución de equilibrio de Nash es que ambos reclamen el mínimo posible) y el comportamiento humano real (donde la mayoría de las personas tienden a reclamar valores cercanos al máximo).</p>
    
    <p>Los experimentos han demostrado consistentemente que las personas no siguen la lógica de racionalidad pura en este juego, lo que ha llevado a importantes discusiones sobre los límites de los modelos económicos clásicos y la incorporación de factores como la justicia, la reciprocidad y las expectativas sobre el comportamiento de los demás.</p>
    
    <p>El Dilema del Viajero ha contribuido significativamente al desarrollo de la economía conductual y ha proporcionado ideas valiosas sobre cómo los humanos resuelven problemas estratégicos complejos en situaciones de incertidumbre sobre las acciones de los demás.</p>
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