import { Game, GameState } from '@/types/games';

// Prisoner's Dilemma specific game state
export interface PrisonersDilemmaState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, PrisonerPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Decision>;
    scores: Record<string, number>;
  }>;
}

export type Decision = 'cooperate' | 'defect';

export interface PrisonerPlayerData {
  totalScore: number;
  currentDecision?: Decision | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  BOTH_COOPERATE: 3, // Both get a medium reward
  BOTH_DEFECT: 1,    // Both get a small punishment
  COOPERATE_WHEN_OTHER_DEFECTS: 0, // Sucker's payoff (worst outcome)
  DEFECT_WHEN_OTHER_COOPERATES: 5  // Temptation payoff (best outcome)
};

// Implementation of the Prisoner's Dilemma game (follows Liskov Substitution Principle)
const PrisonersDilemma: Game = {
  id: 'prisoners-dilemma',
  name: 'Dilema del Prisionero',
  description: 'Un escenario clásico de teoría de juegos donde dos jugadores deben decidir si cooperar o delatar, con recompensas basadas en la combinación de sus elecciones.',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En el Dilema del Prisionero, tú y otro jugador son sospechosos de un crimen.
    
    En cada ronda, debes elegir entre cooperar (permanecer en silencio) o delatar (traicionar al otro jugador).
    
    Las recompensas son:
    - Si ambos cooperan: Ambos reciben ${SCORING.BOTH_COOPERATE} puntos
    - Si ambos delatan: Ambos reciben ${SCORING.BOTH_DEFECT} puntos
    - Si tú cooperas pero el otro delata: Tú recibes ${SCORING.COOPERATE_WHEN_OTHER_DEFECTS} puntos, el otro recibe ${SCORING.DEFECT_WHEN_OTHER_COOPERATES} puntos
    - Si tú delatas pero el otro coopera: Tú recibes ${SCORING.DEFECT_WHEN_OTHER_COOPERATES} puntos, el otro recibe ${SCORING.COOPERATE_WHEN_OTHER_DEFECTS} puntos
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Dilema del Prisionero</h3>
    
    <p>El Dilema del Prisionero fue formalmente presentado por Merrill Flood y Melvin Dresher en 1950 mientras trabajaban en RAND Corporation. Más tarde, Albert W. Tucker formalizó el juego con la terminología de penas de prisión y le dio el nombre por el que se conoce hoy.</p>
    
    <p>Este juego es fundamental en la teoría de juegos por ilustrar por qué dos personas racionales podrían no cooperar incluso cuando claramente beneficiaría a ambas hacerlo. Representa una situación donde la estrategia individual que parece más segura conduce a un resultado colectivamente peor.</p>
    
    <p>El Dilema del Prisionero ha sido estudiado extensivamente en muchas disciplinas, incluyendo economía, ciencias políticas, ética, psicología y biología evolutiva, pues modela comportamientos clave relacionados con la cooperación humana.</p>
    
    <p>Una variante influyente es el Dilema del Prisionero Iterado, donde los participantes juegan múltiples rondas con el mismo oponente, lo que permite estrategias más complejas como "tit-for-tat" (tal para cual), que resultó sorprendentemente efectiva en torneos computarizados organizados por Robert Axelrod en los años 80.</p>
    
    <p>El dilema ilustra tensiones entre la racionalidad individual y grupal, y ayuda a explicar comportamientos en situaciones tan diversas como acuerdos de desarme nuclear, cambio climático, publicidad competitiva y muchas interacciones sociales cotidianas.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    return playerCount === 2; // Exactly 2 players required for this game
  },
  getDefaultGameState: (): PrisonersDilemmaState => {
    return {
      round: 0,
      maxRounds: 6,
      status: 'setup',
      playerData: {},
      history: []
    };
  }
};

export default PrisonersDilemma; 