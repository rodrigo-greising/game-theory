import { Game, GameState } from '@/types/games';

// Event Coordination Dilemma specific game state
export interface BattleOfTheSexesState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, BattleOfTheSexesPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Preference>;
    scores: Record<string, number>;
  }>;
  playerRoles: Record<string, Preference>;
}

export type Preference = 'opera' | 'football';

export interface BattleOfTheSexesPlayerData {
  totalScore: number;
  currentPreference?: Preference | null;
  ready: boolean;
  preferredEvent: Preference; // Each player has their own preference
}

// Constants for scoring
export const SCORING = {
  BOTH_CHOOSE_OPERA: { OPERA_LOVER: 3, FOOTBALL_LOVER: 2 },    // Opera fan gets more utility
  BOTH_CHOOSE_FOOTBALL: { OPERA_LOVER: 2, FOOTBALL_LOVER: 3 }, // Football fan gets more utility
  DIFFERENT_CHOICES: 0                                         // Both get nothing if they don't coordinate
};

// Implementation of the Event Coordination Dilemma game
const BattleOfTheSexes: Game = {
  id: 'battle-of-the-sexes',
  name: 'Dilema de Coordinación de Eventos',
  description: 'Un juego de coordinación donde dos jugadores prefieren eventos diferentes pero ambos preferirían asistir al mismo evento que ir a eventos separados.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En el Dilema de Coordinación de Eventos, tú y otro jugador están decidiendo a qué evento asistir: Ópera o Fútbol.
    
    Un jugador prefiere la Ópera, el otro prefiere el Fútbol, pero ambos preferirían asistir al mismo evento juntos que ir a eventos diferentes.
    
    En cada ronda, debes elegir a qué evento asistir.
    
    Las recompensas son:
    - Si ambos eligen Ópera: El aficionado a la Ópera obtiene 3 puntos, el aficionado al Fútbol obtiene 2 puntos
    - Si ambos eligen Fútbol: El aficionado a la Ópera obtiene 2 puntos, el aficionado al Fútbol obtiene 3 puntos
    - Si eligen eventos diferentes: Ambos obtienen 0 puntos (peor resultado)
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Dilema de Coordinación de Eventos</h3>
    
    <p>El Dilema de Coordinación de Eventos, conocido originalmente como "Battle of the Sexes" (Batalla de los Sexos), fue introducido en la teoría de juegos en la década de 1950. El nombre original reflejaba un estereotipo de la época donde se asumía que un hombre preferiría ver un evento deportivo mientras que una mujer preferiría asistir a un evento cultural, aunque ambos preferirían estar juntos que separados.</p>
    
    <p>A diferencia del Dilema del Prisionero, donde hay un conflicto directo de intereses, este juego presenta un problema de coordinación con preferencias parcialmente alineadas. Hay dos equilibrios de Nash (donde ambos eligen la ópera o ambos eligen el fútbol), pero los jugadores difieren en cuál preferirían.</p>
    
    <p>Este juego ha sido estudiado extensamente por su relevancia para entender problemas de coordinación social y negociación donde hay intereses parcialmente compatibles. Modeliza situaciones donde la coordinación es mutuamente beneficiosa, pero existe desacuerdo sobre qué equilibrio es preferible.</p>
    
    <p>Las aplicaciones incluyen decisiones de pareja sobre actividades compartidas, negociaciones comerciales donde diferentes partes prefieren diferentes estándares técnicos pero todos se benefician de un estándar común, y situaciones diplomáticas donde los países se benefician de la coordinación pero tienen diferentes preferencias sobre qué política adoptar.</p>
    
    <p>Investigaciones posteriores han explorado variantes de este juego con comunicación previa, rondas repetidas, o más de dos jugadores, revelando dinámicas fascinantes sobre cómo las personas resuelven dilemas de coordinación cuando hay preferencias divergentes pero intereses fundamentalmente compatibles.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Event Coordination Dilemma, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): BattleOfTheSexesState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      playerRoles: {} // Maps player IDs to roles (preferences)
    };
  }
};

export default BattleOfTheSexes; 