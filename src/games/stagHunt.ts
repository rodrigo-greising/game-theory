import { Game, GameState } from '@/types/games';

// Stag Hunt specific game state
export interface StagHuntState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, StagHuntPlayerData>;
  history: Array<{
    round: number;
    decisions: Record<string, Choice>;
    scores: Record<string, number>;
  }>;
}

export type Choice = 'stag' | 'hare';

export interface StagHuntPlayerData {
  totalScore: number;
  currentChoice?: Choice | null;
  ready: boolean;
}

// Constants for scoring
export const SCORING = {
  BOTH_HUNT_STAG: 4,    // Cooperation pays off (best outcome)
  BOTH_HUNT_HARE: 2,    // Safe but modest reward
  HUNT_STAG_ALONE: 0,   // Failure (worst outcome)
  HUNT_HARE_WHILE_OTHER_HUNTS_STAG: 3  // Safe individual choice
};

// Implementation of the Stag Hunt game
const StagHunt: Game = {
  id: 'stag-hunt',
  name: 'Caza del Ciervo',
  description: 'Un escenario de teoría de juegos donde dos cazadores deben decidir si cooperar para cazar un ciervo (alta recompensa, pero requiere cooperación) o cazar una liebre individualmente (menor recompensa, pero más seguro).',
  minPlayers: 2,
  maxPlayers: 2, // Classic version is for exactly 2 players
  rules: `
    En la Caza del Ciervo, tú y otro jugador son cazadores decidiendo qué animal cazar.
    
    En cada ronda, debes elegir entre cazar un ciervo (que requiere cooperación) o cazar una liebre (que puedes hacer solo).
    
    Las recompensas son:
    - Si ambos cazan ciervo: Ambos reciben ${SCORING.BOTH_HUNT_STAG} puntos (máxima recompensa)
    - Si ambos cazan liebre: Ambos reciben ${SCORING.BOTH_HUNT_HARE} puntos (recompensa moderada)
    - Si tú cazas ciervo pero el otro caza liebre: Tú recibes ${SCORING.HUNT_STAG_ALONE} puntos, el otro recibe ${SCORING.HUNT_HARE_WHILE_OTHER_HUNTS_STAG} puntos
    - Si tú cazas liebre pero el otro caza ciervo: Tú recibes ${SCORING.HUNT_HARE_WHILE_OTHER_HUNTS_STAG} puntos, el otro recibe ${SCORING.HUNT_STAG_ALONE} puntos
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
  `,
  educationalContent: `
    <h3>Orígenes e Historia de la Caza del Ciervo</h3>
    
    <p>La Caza del Ciervo (Stag Hunt) tiene su origen en un relato del filósofo Jean-Jacques Rousseau en su "Discurso sobre el origen y los fundamentos de la desigualdad entre los hombres" (1755). Rousseau describió a cazadores que debían elegir entre cooperar para cazar un ciervo o perseguir liebres individualmente.</p>
    
    <p>A diferencia del Dilema del Prisionero, la Caza del Ciervo es un juego de coordinación pura, donde la cooperación mutua (cazar el ciervo) produce el mejor resultado posible para ambos jugadores, pero también conlleva un riesgo si el otro jugador decide no cooperar.</p>
    
    <p>Este juego es particularmente relevante para entender problemas de cooperación social, contratos sociales y confianza. Ilustra situaciones donde la confianza mutua puede llevar a resultados óptimos, pero donde la incertidumbre sobre las intenciones del otro puede conducir a equilibrios subóptimos pero menos arriesgados.</p>
    
    <p>La Caza del Ciervo ha sido aplicada para entender fenómenos tan diversos como la formación de alianzas entre naciones, la cooperación en equipos de trabajo, y la evolución del comportamiento social en biología.</p>
    
    <p>Económicamente, representa el dilema entre la maximización de beneficios mediante la cooperación (que requiere confianza) y la minimización de riesgos mediante acciones independientes (que limita los beneficios potenciales).</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // For Stag Hunt, we require exactly 2 players
    return playerCount === 2; 
  },
  getDefaultGameState: (): StagHuntState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: []
    };
  }
};

export default StagHunt; 