import { Game, GameState } from '@/types/games';

// Cournot Competition specific game state
export interface CournotCompetitionState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, CournotPlayerData>;
  history: Array<{
    round: number;
    quantities: Record<string, number>;
    totalQuantity: number;
    marketPrice: number;
    profits: Record<string, number>;
    scores: Record<string, number>;
  }>;
  maxQuantity: number; // Maximum production quantity per player
  minQuantity: number; // Minimum production quantity
  marginalCost: number; // Cost to produce one unit
  demandIntercept: number; // Price when quantity is 0
  demandSlope: number; // How price drops as quantity increases
}

export interface CournotPlayerData {
  totalScore: number;
  currentQuantity?: number | null;
  ready: boolean;
}

// Implementation of the Cournot Competition Game
const CournotCompetition: Game = {
  id: 'cournot-competition',
  name: 'Competencia de Cournot',
  description: 'Un juego económico donde las empresas compiten eligiendo cantidades de producción, que juntas determinan el precio del mercado.',
  minPlayers: 2,
  maxPlayers: 5, // Can be played with various numbers of players
  rules: `
    En la Competencia de Cournot, eres una empresa compitiendo con otras eligiendo cuánto producir.
    
    En cada ronda:
    - Todas las empresas eligen simultáneamente su cantidad de producción.
    - La cantidad total del mercado determina el precio del mercado según la curva de demanda.
    - El precio del mercado se aplica a todas las empresas.
    
    Los parámetros del juego:
    - Costo marginal (costo de producir una unidad): $10
    - Producción máxima: 20 unidades por empresa
    - Producción mínima: 0 unidades
    - Función de demanda: P = 100 - Q (Precio = 100 - Cantidad Total)
    
    Cálculo de beneficios:
    - Precio del mercado = 100 - (Suma de todas las cantidades)
    - Tu beneficio = (Precio del mercado - Costo marginal) × Tu cantidad
    
    Por ejemplo, con dos empresas:
    - Si produces 20 unidades y la otra empresa produce 30 unidades:
    - Precio del mercado = 100 - (20 + 30) = $50
    - Tu beneficio = ($50 - $10) × 20 = $800
    
    El juego consiste en múltiples rondas. El jugador con el mayor beneficio total al final gana.
    
    Este juego ilustra la competencia en cantidades, el equilibrio de Nash y la teoría del oligopolio.
  `,
  educationalContent: `
    <h3>Orígenes e Historia de la Competencia de Cournot</h3>
    
    <p>La Competencia de Cournot fue formulada por el matemático francés Antoine Augustin Cournot en 1838 en su obra "Investigaciones sobre los principios matemáticos de la teoría de la riqueza". Este modelo representa uno de los primeros intentos de aplicar análisis matemático formal a la economía y es considerado un precursor de la teoría de juegos moderna.</p>
    
    <p>Cournot desarrolló su modelo inicialmente para analizar la competencia en un duopolio (mercado con dos empresas), donde las empresas compiten eligiendo cantidades de producción en lugar de precios. El modelo predice que las empresas elegirán niveles de producción que maximicen sus beneficios dado lo que esperan que haga su competidor, llegando a un equilibrio donde ninguna tiene incentivo para cambiar unilateralmente su decisión (lo que más tarde se conocería como equilibrio de Nash).</p>
    
    <p>Este modelo ha sido fundamental en la teoría microeconómica y la organización industrial para entender cómo funcionan los mercados imperfectamente competitivos, particularmente los oligopolios. A diferencia del modelo de competencia perfecta (donde las empresas no tienen influencia individual sobre el precio) o del monopolio (donde una única empresa controla el mercado), la Competencia de Cournot captura situaciones donde un pequeño número de empresas tienen poder de mercado significativo.</p>
    
    <p>La solución del modelo de Cournot predice un resultado intermedio entre competencia perfecta y monopolio, con precios más altos y cantidades totales más bajas que en competencia perfecta, pero no tan extremos como en monopolio. Este resultado teórico ha sido validado en numerosos estudios empíricos de industrias como petróleo, electricidad, telecomunicaciones y otras donde operan pocas empresas grandes.</p>
    
    <p>El modelo de Cournot sigue siendo relevante para el análisis de políticas de competencia, fusiones y adquisiciones, y regulación de mercados. La formalización matemática que Cournot introdujo hace casi dos siglos sentó las bases para el desarrollo posterior de la teoría de juegos aplicada a la economía, que culminaría con los trabajos de John von Neumann, John Nash y otros en el siglo XX.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Cournot Competition works with 2 or more players
    return playerCount >= 2 && playerCount <= 5;
  },
  getDefaultGameState: (): CournotCompetitionState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      maxQuantity: 20,
      minQuantity: 0,
      marginalCost: 10,
      demandIntercept: 100,
      demandSlope: 1
    };
  },
  
  // Initialize the game for the specific players
  initializeGame: (gameState: CournotCompetitionState, playerIds: string[]): CournotCompetitionState => {
    // Make sure there are at least 2 players
    if (playerIds.length < 2) {
      throw new Error('Cournot Competition requires at least 2 players');
    }
    
    // Initialize player data
    const playerData: Record<string, CournotPlayerData> = {};
    playerIds.forEach(playerId => {
      playerData[playerId] = {
        totalScore: 0,
        currentQuantity: null,
        ready: false
      };
    });
    
    return {
      ...gameState,
      playerData,
      status: 'in_progress',
      round: 1,
      history: []
    };
  }
};

export default CournotCompetition; 