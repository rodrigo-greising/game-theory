import { Game, GameState } from '@/types/games';

// Volunteer's Dilemma specific game state
export interface VolunteersDilemmaState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, VolunteersDilemmaPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Decision>;
    volunteersCount: number;
    scores: Record<string, number>;
  }>;
  benefitAll: number;
  costVolunteer: number;
}

export type Decision = 'volunteer' | 'not_volunteer';

export interface VolunteersDilemmaPlayerData {
  totalScore: number;
  currentDecision?: Decision | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  VOLUNTEER_COST: 4,  // Cost incurred by volunteering
  PUBLIC_BENEFIT: 10, // Benefit everyone gets if at least one person volunteers
  NO_VOLUNTEER_PENALTY: -8 // Penalty everyone gets if no one volunteers
};

// Implementation of the Volunteer's Dilemma Game
const VolunteersDilemma: Game = {
  id: 'volunteers-dilemma',
  name: 'Dilema del Voluntario',
  description: 'Un juego donde un grupo se beneficia si al menos una persona se ofrece como voluntaria para incurrir en un costo, pero si nadie se ofrece, todos sufren una pérdida mayor.',
  minPlayers: 2,
  maxPlayers: 10, // Can be played with various numbers of players
  rules: `
    En el Dilema del Voluntario, un grupo enfrenta una situación donde:
    
    - Si al menos un jugador se ofrece como voluntario, TODOS los jugadores reciben un beneficio (${SCORING.PUBLIC_BENEFIT} puntos)
    - Sin embargo, cada voluntario incurre en un costo personal (${SCORING.VOLUNTEER_COST} puntos)
    - Si NADIE se ofrece como voluntario, TODOS sufren una penalización (${SCORING.NO_VOLUNTEER_PENALTY} puntos)
    
    Cada jugador decide en secreto si ser voluntario o no.
    
    Las recompensas son:
    - Si te ofreces como voluntario: ${SCORING.PUBLIC_BENEFIT - SCORING.VOLUNTEER_COST} puntos (beneficio menos costo)
    - Si no te ofreces pero alguien más lo hace: ${SCORING.PUBLIC_BENEFIT} puntos (beneficio completo, sin costo)
    - Si nadie se ofrece: ${SCORING.NO_VOLUNTEER_PENALTY} puntos (penalización para todos)
    
    Por ejemplo, en un grupo de 5 jugadores:
    - Si 1 jugador es voluntario: Obtiene 6 puntos, los otros 4 jugadores obtienen 10 puntos cada uno
    - Si 2 jugadores son voluntarios: Ambos voluntarios obtienen 6 puntos, los otros 3 jugadores obtienen 10 puntos cada uno
    - Si nadie es voluntario: Todos obtienen -8 puntos
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
    
    Este juego explora la difusión de responsabilidad y el comportamiento de aprovechamiento gratuito.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Dilema del Voluntario</h3>
    
    <p>El Dilema del Voluntario fue analizado formalmente por la economista Anat Admati y el psicólogo social John M. Darley en la década de 1980. Surgió como una extensión de los estudios sobre el "efecto espectador" - el fenómeno donde la presencia de más observadores reduce la probabilidad de que alguien ofrezca ayuda en una emergencia.</p>
    
    <p>Este juego captura la tensión entre el interés colectivo (que alguien actúe como voluntario) y el interés individual (evitar el costo de ser voluntario). Es particularmente relevante en situaciones donde un grupo necesita que alguien asuma un costo individual para el beneficio de todos.</p>
    
    <p>A diferencia del Dilema del Prisionero, donde la cooperación mutua es la mejor solución colectiva, en el Dilema del Voluntario lo óptimo para el grupo es que exactamente una persona se ofrezca como voluntaria. Sin embargo, nadie quiere ser esa persona.</p>
    
    <p>Este dilema puede observarse en muchas situaciones reales: intervenir en una emergencia, denunciar prácticas corruptas, iniciar una acción colectiva, o incluso en contextos cotidianos como quién limpiará la cocina compartida en una residencia de estudiantes.</p>
    
    <p>Los estudios han demostrado que la probabilidad de que surja un voluntario disminuye paradójicamente a medida que aumenta el tamaño del grupo, un fenómeno conocido como "difusión de responsabilidad". Esta observación ha tenido importantes implicaciones para comprender la cooperación en grandes grupos y el diseño de políticas públicas.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Volunteer's Dilemma becomes more interesting with more players
    return playerCount >= 2 && playerCount <= 10;
  },
  getDefaultGameState: (): VolunteersDilemmaState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      benefitAll: 10, // Benefit to all if at least one volunteers
      costVolunteer: 4 // Cost incurred by each volunteer
    };
  }
};

export default VolunteersDilemma; 