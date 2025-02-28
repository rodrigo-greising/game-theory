import { Game, GameState } from '@/types/games';

// Bertrand Competition specific game state
export interface BertrandCompetitionState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, BertrandPlayerData>;
  history: Array<{
    round: number;
    prices: Record<string, number>;
    marketShares: Record<string, number>;
    profits: Record<string, number>;
    scores: Record<string, number>;
  }>;
  maxPrice: number; // Maximum allowed price
  minPrice: number; // Minimum allowed price
  marginalCost: number; // Cost to produce one unit
  marketDemand: number; // Total market demand at lowest price
}

export interface BertrandPlayerData {
  totalScore: number;
  currentPrice?: number | null;
  ready: boolean;
}

// Implementation of the Bertrand Competition Game
const BertrandCompetition: Game = {
  id: 'bertrand-competition',
  name: 'Competencia de Bertrand',
  description: 'Un juego económico donde las empresas compiten en precio, con los consumidores comprando a la empresa que ofrece el precio más bajo.',
  minPlayers: 2,
  maxPlayers: 5, // Can be played with various numbers of players
  rules: `
    En la Competencia de Bertrand, eres una empresa compitiendo con otras mediante la fijación de precios.
    
    En cada ronda:
    - Todas las empresas fijan simultáneamente su precio para un producto idéntico.
    - Los consumidores comprarán solo a la(s) empresa(s) que ofrezca(n) el precio más bajo.
    - Si múltiples empresas fijan el mismo precio más bajo, comparten el mercado equitativamente.
    
    Los parámetros del juego:
    - Costo marginal (costo de producir una unidad): $10
    - Precio máximo: $50
    - Precio mínimo: $10 (no se puede vender por debajo del costo)
    - Demanda del mercado: 100 unidades (al precio más bajo)
    
    Cálculo de beneficios:
    - Tu beneficio = (Tu precio - Costo marginal) × Tu cuota de mercado × Demanda del mercado
    
    Por ejemplo:
    - Si fijas $20 y otra empresa fija $30, obtienes todo el mercado.
      Tu beneficio: ($20 - $10) × 100 = $1,000
    - Si tú y otra empresa fijan ambos $20, se reparten el mercado.
      Tu beneficio: ($20 - $10) × 50 = $500
    - Si tu precio es mayor que el de otra empresa, no obtienes clientes y tu beneficio es cero.
    
    El juego consiste en múltiples rondas. El jugador con el mayor beneficio total al final gana.
    
    Este juego ilustra la competencia en precios, el equilibrio de Nash, y la teoría de la empresa.
  `,
  educationalContent: `
    <h3>Orígenes e Historia de la Competencia de Bertrand</h3>
    
    <p>La Competencia de Bertrand fue formulada por el matemático y economista francés Joseph Bertrand en 1883 como una crítica al modelo de competencia de Cournot (que se centraba en la competencia por cantidades). Bertrand argumentó que en muchos mercados, las empresas compiten fijando precios en lugar de cantidades de producción.</p>
    
    <p>Este modelo ha sido fundamental en el desarrollo de la teoría microeconómica y la organización industrial. Predice un resultado sorprendente: con solo dos empresas que venden productos idénticos y tienen los mismos costos, el precio bajará hasta igualar el costo marginal, eliminando todos los beneficios (conocido como "la paradoja de Bertrand"). Este resultado contrasta notablemente con el monopolio y con el modelo de Cournot.</p>
    
    <p>En la práctica, varios factores pueden mitigar esta competencia extrema en precios, como la diferenciación de productos, las restricciones de capacidad, la colusión tácita o explícita entre empresas, y la repetición de interacciones que permite el desarrollo de estrategias de cooperación.</p>
    
    <p>La Competencia de Bertrand proporciona información crucial para entender industrias como las telecomunicaciones, aerolíneas, servicios financieros, y comercio electrónico, donde las empresas pueden ajustar rápidamente sus precios en respuesta a los competidores.</p>
    
    <p>Este modelo también ha sido importante para la política de competencia y regulación antimonopolio, ayudando a los responsables políticos a comprender cómo la estructura del mercado afecta a los precios y al bienestar del consumidor, y cómo detectar y prevenir prácticas anticompetitivas como la fijación de precios.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Bertrand Competition works with 2 or more players
    return playerCount >= 2 && playerCount <= 5;
  },
  getDefaultGameState: (): BertrandCompetitionState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      maxPrice: 50,
      minPrice: 10,
      marginalCost: 10,
      marketDemand: 100
    };
  },
  
  // Initialize the game for the specific players
  initializeGame: (gameState: BertrandCompetitionState, playerIds: string[]): BertrandCompetitionState => {
    // Make sure there are at least 2 players
    if (playerIds.length < 2) {
      throw new Error('Bertrand Competition requires at least 2 players');
    }
    
    // Initialize player data
    const playerData: Record<string, BertrandPlayerData> = {};
    playerIds.forEach(playerId => {
      playerData[playerId] = {
        totalScore: 0,
        currentPrice: null,
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

export default BertrandCompetition; 