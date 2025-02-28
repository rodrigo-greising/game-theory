import { Game, GameState } from '@/types/games';

// Chicken game specific game state
export interface ChickenState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, ChickenPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Strategy>;
    scores: Record<string, number>;
  }>;
}

export type Strategy = 'swerve' | 'straight';

export interface ChickenPlayerData {
  totalScore: number;
  currentStrategy?: Strategy | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  BOTH_SWERVE: 3,              // Both choose safety - moderate outcome
  BOTH_STRAIGHT: 0,            // Crash! - worst outcome for both
  SWERVE_WHEN_OTHER_STRAIGHT: 1, // Being "chicken" - low-moderate outcome
  STRAIGHT_WHEN_OTHER_SWERVES: 5  // "Winning" - best outcome
};

// Implementation of the Chicken (Hawk-Dove) game
const Chicken: Game = {
  id: 'chicken',
  name: 'Juego del Gallina',
  description: 'Un juego de intimidación donde dos jugadores deben decidir si ceder o seguir adelante, con el peor resultado ocurriendo si ninguno cede.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En el Juego del Gallina, tú y otro jugador están conduciendo uno hacia el otro.
    
    En cada ronda, debes elegir entre desviarte (actuar con cautela) o seguir recto (actuar agresivamente).
    
    Las recompensas son:
    - Si ambos se desvían: Ambos obtienen ${SCORING.BOTH_SWERVE} puntos (resultado moderado)
    - Si ambos siguen recto: Ambos obtienen ${SCORING.BOTH_STRAIGHT} puntos (choque - ¡el peor resultado!)
    - Si tú te desvías pero el otro sigue recto: Tú obtienes ${SCORING.SWERVE_WHEN_OTHER_STRAIGHT} puntos, el otro obtiene ${SCORING.STRAIGHT_WHEN_OTHER_SWERVES} puntos
    - Si tú sigues recto pero el otro se desvía: Tú obtienes ${SCORING.STRAIGHT_WHEN_OTHER_SWERVES} puntos, el otro obtiene ${SCORING.SWERVE_WHEN_OTHER_STRAIGHT} puntos
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Juego del Gallina</h3>
    
    <p>El Juego del Gallina tiene sus raíces en la cultura juvenil estadounidense de la década de 1950, donde se desarrollaban competencias reales de conducción temeraria. La versión más conocida consistía en dos conductores dirigiéndose uno hacia el otro a alta velocidad; el primer conductor en desviarse era etiquetado como "gallina" (cobarde), mientras que quien mantenía el rumbo ganaba respeto.</p>
    
    <p>Este juego se hizo famoso en películas como "Rebelde sin causa" (1955) con James Dean, que presentaba una variante llamada "chicken run" donde los participantes conducían hacia un acantilado. El juego también ha aparecido en numerosas películas posteriores como metáfora de conflicto y escalada.</p>
    
    <p>Desde la perspectiva de la teoría de juegos, el Juego del Gallina fue formalizado por Anatol Rapoport y estudiado extensamente como un modelo para entender situaciones de conflicto y crisis donde ambas partes pueden sufrir tremendamente si ninguna cede. Representa un tipo diferente de dilema estratégico al del Dilema del Prisionero, ya que aquí la cooperación mutua no es necesariamente el mejor resultado colectivo.</p>
    
    <p>Durante la Guerra Fría, el Juego del Gallina se convirtió en una metáfora fundamental para entender las tensiones nucleares entre superpotencias, particularmente durante eventos como la Crisis de los Misiles en Cuba (1962), donde las estrategias de compromiso creíble, comunicación de intenciones y señalización fueron cruciales.</p>
    
    <p>En biología evolutiva, una variante llamada "Juego Halcón-Paloma" (Hawk-Dove) modela conflictos por recursos entre animales, donde las estrategias agresivas (halcón) y pasivas (paloma) coexisten en un equilibrio evolutivo estable, ayudando a explicar por qué observamos diferentes niveles de agresión dentro de las especies.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Chicken, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): ChickenState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: []
    };
  }
};

export default Chicken; 