import { Game, GameState } from '@/types/games';

// Matching Pennies specific game state
export interface MatchingPenniesState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, MatchingPenniesPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Choice>;
    scores: Record<string, number>;
  }>;
  playerRoles: Record<string, PlayerRole>; // Track which player is matcher/mismatcher
}

export type Choice = 'heads' | 'tails';
export type PlayerRole = 'matcher' | 'mismatcher';

export interface MatchingPenniesPlayerData {
  totalScore: number;
  currentChoice?: Choice | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  MATCHER_WINS: { MATCHER: 1, MISMATCHER: -1 }, // Matcher wins when choices match
  MISMATCHER_WINS: { MATCHER: -1, MISMATCHER: 1 } // Mismatcher wins when choices differ
};

// Implementation of the Matching Pennies game
const MatchingPennies: Game = {
  id: 'matching-pennies',
  name: 'Monedas Iguales',
  description: 'Un juego de suma cero donde un jugador gana si ambos jugadores eligen la misma opción, mientras que el otro jugador gana si eligen opciones diferentes.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En Monedas Iguales, tú y otro jugador eligen entre Cara o Cruz.
    
    Un jugador es designado como el "igualador" y el otro como el "diferenciador".
    
    El igualador gana si ambos jugadores eligen la misma opción (ambos Cara o ambos Cruz).
    El diferenciador gana si los jugadores eligen opciones diferentes (uno Cara, uno Cruz).
    
    Las recompensas son:
    - Si las elecciones coinciden: El igualador obtiene 1 punto, el diferenciador pierde 1 punto
    - Si las elecciones difieren: El igualador pierde 1 punto, el diferenciador obtiene 1 punto
    
    Este es un juego de suma cero - la ganancia de un jugador siempre es igual a la pérdida del otro jugador.
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
  `,
  educationalContent: `
    <h3>Orígenes e Historia de Monedas Iguales</h3>
    
    <p>El juego de Monedas Iguales es uno de los ejemplos más simples y fundamentales en la teoría de juegos, introducido formalmente por el matemático John von Neumann en su trabajo pionero sobre teoría de juegos en la década de 1920. Es considerado un juego "puro" de conflicto debido a sus intereses completamente opuestos.</p>
    
    <p>A diferencia de juegos como el Dilema del Prisionero, donde existe la posibilidad de cooperación mutuamente beneficiosa, Monedas Iguales representa un conflicto de intereses absoluto; lo que es bueno para un jugador es necesariamente malo para el otro, y viceversa. Es un ejemplo perfecto de un juego de suma cero.</p>
    
    <p>Von Neumann demostró que en juegos como este, la estrategia óptima es utilizar una "estrategia mixta" donde cada jugador elige aleatoriamente entre las opciones disponibles con una cierta probabilidad. En Monedas Iguales, la estrategia óptima para ambos jugadores es elegir cara o cruz con una probabilidad del 50% cada vez, haciendo imposible que el oponente prediga su elección.</p>
    
    <p>Este juego ha sido fundamental para entender conceptos como equilibrio de Nash, estrategias mixtas, y la importancia de la aleatorización en situaciones competitivas. Sus aplicaciones se extienden más allá de la teoría económica, influyendo en áreas como estrategia militar, deportes competitivos y seguridad informática.</p>
    
    <p>Aunque simple en su estructura, Monedas Iguales captura la esencia de muchas situaciones competitivas del mundo real donde los participantes intentan predecir y contrarrestar las acciones de sus oponentes, formando la base para el análisis de juegos más complejos con estructuras similares.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Matching Pennies, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): MatchingPenniesState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      playerRoles: {}
    };
  }
};

export default MatchingPennies; 