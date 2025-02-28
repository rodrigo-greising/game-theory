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
  name: 'Piedra, Papel o Tijera',
  description: 'Un juego clásico de suma cero donde cada elección vence a una opción y pierde ante otra, ilustrando la dominancia cíclica.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En Piedra, Papel o Tijera, tú y tu oponente eligen simultáneamente Piedra, Papel o Tijera.
    
    Las reglas son:
    - Piedra vence a Tijera
    - Tijera vence a Papel
    - Papel vence a Piedra
    - Si ambos jugadores eligen la misma opción, es un empate
    
    La puntuación es:
    - Victoria: +1 punto
    - Derrota: -1 punto
    - Empate: 0 puntos
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
    
    Este juego ilustra los equilibrios de estrategia mixta, la imprevisibilidad y la dominancia cíclica.
  `,
  educationalContent: `
    <h3>Orígenes e Historia de Piedra, Papel o Tijera</h3>
    
    <p>Piedra, Papel o Tijera es uno de los juegos más antiguos y universales que se conocen. Sus orígenes se remontan a la China antigua, alrededor del siglo III a.C., durante la dinastía Han. Inicialmente era conocido como "shoushiling" y evolucionó a través de los siglos, extendiéndose por Asia y llegando a Europa en el siglo XVIII.</p>
    
    <p>En Japón se popularizó como "jan-ken" durante el período Edo (1603-1867), y desde allí se extendió al resto del mundo. Cada cultura ha adaptado ligeramente el juego, pero las reglas básicas de dominancia cíclica han permanecido notablemente consistentes a lo largo del tiempo y las fronteras culturales.</p>
    
    <p>Desde el punto de vista de la teoría de juegos, Piedra, Papel o Tijera es un ejemplo perfecto de un juego de suma cero con equilibrio de estrategia mixta. En un juego óptimo, cada jugador debe elegir cada opción con una probabilidad de 1/3 para maximizar sus resultados esperados, lo que hace que las decisiones sean impredecibles para el oponente.</p>
    
    <p>Este juego aparentemente simple ha sido objeto de estudio matemático serio y se ha utilizado para ilustrar conceptos como equilibrio de Nash, estrategias mixtas y la importancia de la aleatoriedad en la toma de decisiones estratégicas. Incluso se han celebrado torneos mundiales de Piedra, Papel o Tijera con estrategias complejas basadas en psicología y patrones de comportamiento.</p>
    
    <p>Más allá de ser un pasatiempo, Piedra, Papel o Tijera ha sido utilizado como método de toma de decisiones, herramienta educativa para enseñar probabilidad y teoría de juegos, e incluso como modelo para estudiar sistemas dinámicos en biología y economía donde existen relaciones de dominancia cíclica similares.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Rock-Paper-Scissors, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): RockPaperScissorsState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: []
    };
  }
};

export default RockPaperScissors; 