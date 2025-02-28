import { Game, GameState } from '@/types/games';

// Coordination Game specific game state
export interface CoordinationGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, CoordinationPlayerData>;
  history: Array<{
    round: number;
    choices: Record<string, Choice>;
    scores: Record<string, number>;
  }>;
  options: Choice[]; // Available coordination options
}

export type Choice = 'A' | 'B';

export interface CoordinationPlayerData {
  totalScore: number;
  currentChoice?: Choice | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  COORDINATE: 10, // Both choose the same option
  FAIL: 0         // Choose different options
};

// Implementation of the Coordination Game
const CoordinationGame: Game = {
  id: 'coordination-game',
  name: 'Juego de Coordinación',
  description: 'Un juego de coordinación pura donde los jugadores se benefician más eligiendo la misma opción que los demás.',
  minPlayers: 2,
  maxPlayers: 10, // Can be played with various numbers of players
  rules: `
    En el Juego de Coordinación, todos los jugadores deben intentar elegir la misma opción que los otros jugadores.
    
    Cada jugador elige simultáneamente una de dos opciones: A o B.
    
    Las recompensas son:
    - Si todos los jugadores eligen la misma opción (ya sea todos A o todos B): Todos obtienen ${SCORING.COORDINATE} puntos
    - Si hay algún desacuerdo: Todos obtienen ${SCORING.FAIL} puntos
    
    Por ejemplo, con 3 jugadores:
    - Si los 3 eligen A: Todos obtienen 10 puntos
    - Si 2 eligen A y 1 elige B: Todos obtienen 0 puntos
    
    El desafío es coordinarse sin comunicación.
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
    
    Este juego demuestra puntos focales, selección de equilibrio y coordinación sin conflicto.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Juego de Coordinación</h3>
    
    <p>El Juego de Coordinación fue formalizado por primera vez por el economista y filósofo Thomas Schelling en su influyente libro "La estrategia del conflicto" (1960). Schelling, quien más tarde ganaría el Premio Nobel de Economía en 2005, utilizó estos juegos para explorar cómo las personas coordinan sus acciones en ausencia de comunicación.</p>
    
    <p>Este juego representa situaciones donde las personas tienen intereses comunes pero deben coordinarse para alcanzar resultados óptimos. A diferencia de juegos como el Dilema del Prisionero, no hay conflicto de intereses entre los jugadores - todos quieren coordinarse, pero necesitan adivinar qué harán los demás.</p>
    
    <p>Una de las principales contribuciones de Schelling fue el concepto de "puntos focales" (también llamados "puntos de Schelling"), que son soluciones que destacan por alguna razón y que las personas tienden a seleccionar cuando necesitan coordinarse sin comunicación. Por ejemplo, si se pide a las personas que se reúnan en Nueva York sin especificar dónde, muchas elegirían sitios prominentes como Times Square o la Estación Grand Central.</p>
    
    <p>Los Juegos de Coordinación han sido fundamentales para entender fenómenos como las convenciones sociales, la formación de normas, la adopción de estándares tecnológicos, y la selección entre múltiples equilibrios en economía. En muchas situaciones reales, el problema no es de competencia sino de coordinación - como elegir qué lado de la carretera conducir, qué idioma hablar en un contexto internacional, o qué tecnología adoptar en una industria.</p>
    
    <p>Estos juegos demuestran que a veces la racionalidad individual no es suficiente para alcanzar resultados socialmente óptimos, y que factores como tradiciones, precedentes históricos, y características distintivas pueden jugar un papel crucial en facilitar la coordinación social.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Coordination game works with 2 or more players
    return playerCount >= 2 && playerCount <= 10; 
  },
  getDefaultGameState: (): CoordinationGameState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      options: ['A', 'B']
    };
  }
};

export default CoordinationGame; 