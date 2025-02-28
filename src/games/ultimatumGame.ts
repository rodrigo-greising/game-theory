import { Game, GameState } from '@/types/games';

// Ultimatum Game specific game state
export interface UltimatumGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, UltimatumPlayerData>;
  history: Array<{
    round: number;
    proposal?: Proposal;
    response?: Response;
    scores: Record<string, number>;
  }>;
  playerRoles: Record<string, PlayerRole>; // Track which player is proposer/responder
  totalAmount: number; // The amount to be divided
  currentStage: 'proposal' | 'response' | 'results'; // Track the stage within a round
}

export interface Proposal {
  proposerId: string;
  amount: number; // Amount offered to the responder
}

export type Response = 'accept' | 'reject';
export type PlayerRole = 'proposer' | 'responder';

export interface UltimatumPlayerData {
  totalScore: number;
  proposal?: number | null; // For proposer
  response?: Response | null; // For responder
  ready: boolean;
}

// Implementation of the Ultimatum Game
const UltimatumGame: Game = {
  id: 'ultimatum-game',
  name: 'Juego del Ultimátum',
  description: 'Un juego donde un jugador propone cómo dividir una suma de dinero, y el otro jugador puede aceptar o rechazar la oferta. Si es rechazada, ambos no reciben nada.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En el Juego del Ultimátum, una suma de dinero (100 puntos) debe dividirse entre dos jugadores.
    
    Un jugador es designado como el "proponente" y el otro como el "respondedor".
    
    El juego tiene dos etapas en cada ronda:
    1. El proponente ofrece una división del dinero (p.ej., "Me quedo con 60, tú recibes 40").
    2. El respondedor puede aceptar o rechazar la oferta.
    
    Si el respondedor acepta, ambos jugadores reciben las cantidades propuestas.
    Si el respondedor rechaza, ambos jugadores no reciben nada en esa ronda.
    
    El juego consiste en múltiples rondas, con los jugadores intercambiando roles entre rondas.
    El jugador con la puntuación total más alta al final gana.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Juego del Ultimátum</h3>
    
    <p>El Juego del Ultimátum fue propuesto por primera vez por Werner Güth, Rolf Schmittberger y Bernd Schwarze en 1982. Este experimento económico se diseñó para poner a prueba las predicciones de la teoría económica clásica sobre la racionalidad y el interés propio.</p>
    
    <p>Según la teoría económica estándar, los respondedores deberían aceptar cualquier oferta positiva, ya que recibir algo es mejor que nada. Sin embargo, los estudios experimentales han demostrado consistentemente que las personas suelen rechazar ofertas consideradas "injustas" (típicamente menos del 30% del total), prefiriendo no recibir nada antes que aceptar una división muy desigual.</p>
    
    <p>Este juego ha sido crucial para el desarrollo de la economía conductual y la neuroeconomía, revelando cómo conceptos como la equidad, la reciprocidad y la justicia influyen en las decisiones económicas. Los resultados contradicen el modelo del "homo economicus" (humano perfectamente racional y egoísta) de la economía clásica.</p>
    
    <p>Estudios interculturales del Juego del Ultimátum en diversas sociedades han mostrado variaciones significativas en lo que se considera una oferta "justa", aunque todas las culturas muestran algún nivel de rechazo a ofertas extremadamente bajas, lo que sugiere que hay tanto elementos universales como culturalmente específicos en las nociones de justicia.</p>
    
    <p>Las imágenes cerebrales de los respondedores han mostrado que las ofertas injustas activan áreas cerebrales asociadas con emociones negativas y disgusto, lo que proporciona una base neurobiológica para comprender por qué las personas a menudo actúan contra su interés económico inmediato en favor de principios morales como la equidad.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Ultimatum Game, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): UltimatumGameState => {
    return {
      round: 0,
      maxRounds: 6,
      status: 'setup',
      playerData: {},
      history: [],
      playerRoles: {},
      totalAmount: 100, // Default amount to divide
      currentStage: 'proposal'
    };
  }
};

export default UltimatumGame; 