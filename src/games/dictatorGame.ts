import { Game, GameState } from '@/types/games';

// Dictator Game specific game state
export interface DictatorGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, DictatorPlayerData>;
  history: Array<{
    round: number;
    allocation?: Allocation;
    scores: Record<string, number>;
  }>;
  playerRoles: Record<string, PlayerRole>; // Track which player is dictator/recipient
  totalAmount: number; // The amount to be divided
}

export interface Allocation {
  dictatorId: string;
  recipientAmount: number; // Amount given to the recipient
}

export type PlayerRole = 'dictator' | 'recipient';

export interface DictatorPlayerData {
  totalScore: number;
  allocation?: number | null; // For dictator (amount to give to recipient)
  ready: boolean;
}

// Implementation of the Dictator Game
const DictatorGame: Game = {
  id: 'dictator-game',
  name: 'Juego del Dictador',
  description: 'Un juego donde un jugador decide unilateralmente cómo dividir una suma de dinero entre él mismo y otro jugador.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En el Juego del Dictador, una suma de dinero (100 puntos) debe dividirse entre dos jugadores.
    
    Un jugador es designado como el "dictador" y el otro como el "receptor".
    
    El dictador decide unilateralmente cómo dividir el dinero, sin ninguna aportación del receptor.
    El receptor debe aceptar cualquier cantidad que el dictador ofrezca.
    
    Por ejemplo, si el dictador decide quedarse con 70 puntos y dar 30 al receptor, esa es la asignación final.
    
    El juego consiste en múltiples rondas, con los jugadores intercambiando roles entre rondas.
    El jugador con la puntuación total más alta al final gana.
    
    Este juego explora conceptos de equidad, altruismo e interés propio.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Juego del Dictador</h3>
    
    <p>El Juego del Dictador fue desarrollado como una variación del Juego del Ultimátum por Daniel Kahneman, Jack Knetsch y Richard Thaler a finales de la década de 1980. Su diseño eliminaba el elemento de respuesta presente en el Juego del Ultimátum, permitiendo una medición más directa de las preferencias sociales sin la complicación estratégica de anticipar el rechazo.</p>
    
    <p>Este simple experimento ha tenido un impacto profundo en la economía, desafiando directamente el modelo del "homo economicus" (persona puramente racional y egoísta). Según la teoría económica estándar, un dictador racional debería quedarse con todo el dinero y no dar nada. Sin embargo, los numerosos estudios experimentales muestran consistentemente que la mayoría de los dictadores dan cantidades significativas, típicamente entre el 20% y el 30% del monto total.</p>
    
    <p>La sorprendente generosidad observada en este juego ha contribuido significativamente al desarrollo de la economía conductual y a teorías sobre preferencias sociales, sugiriendo que las personas tienen motivaciones intrínsecas hacia la equidad, el altruismo, y las normas sociales que van más allá de la maximización de ganancia material.</p>
    
    <p>Investigaciones posteriores han explorado cómo las asignaciones en el Juego del Dictador varían en diferentes contextos culturales, con distintos métodos de implementación, con varios grados de anonimato, y con diferentes marcos de referencia, revelando la compleja interacción entre normas sociales, contexto y comportamiento prosocial.</p>
    
    <p>A pesar de su simplicidad, el Juego del Dictador sigue siendo una herramienta invaluable para estudiar el comportamiento humano en áreas tan diversas como economía, psicología, antropología, neurociencia y ética, ofreciendo perspectivas sobre la naturaleza fundamental de la cooperación y el comportamiento prosocial humano.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Dictator Game, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): DictatorGameState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      playerRoles: {},
      totalAmount: 100 // Default amount to divide
    };
  }
};

export default DictatorGame; 