import { Game, GameState } from '@/types/games';

// Public Goods Game specific game state
export interface PublicGoodsGameState extends GameState {
  round: number;
  maxRounds: number;
  playerData: Record<string, PublicGoodsPlayerData>;
  history: Array<{
    round: number;
    contributions: Record<string, number>;
    publicPool: number;
    multiplier: number;
    returns: Record<string, number>;
    scores: Record<string, number>;
  }>;
  initialEndowment: number; // Starting amount each player gets per round
  multiplier: number; // How much the public pool is multiplied before redistribution
}

export interface PublicGoodsPlayerData {
  totalScore: number;
  currentContribution?: number | null;
  ready: boolean;
}

// Implementation of the Public Goods Game
const PublicGoodsGame: Game = {
  id: 'public-goods-game',
  name: 'Juego de Bienes Públicos',
  description: 'Un juego donde los jugadores deciden cuánto contribuir a un fondo común, que luego se multiplica y redistribuye equitativamente entre todos los jugadores.',
  minPlayers: 3,
  maxPlayers: 10, // Can be played with various numbers of players
  rules: `
    En el Juego de Bienes Públicos, cada jugador comienza con una dotación inicial de 20 puntos en cada ronda.
    
    Los jugadores deciden simultáneamente cuánto de su dotación contribuir a un fondo común (de 0 a 20 puntos).
    Conservan cualquier cantidad que no contribuyan.
    
    La cantidad total en el fondo común se multiplica por 2 y luego se divide equitativamente entre todos los jugadores, independientemente de sus contribuciones individuales.
    
    Por ejemplo, con 4 jugadores:
    - Si todos contribuyen con 20 puntos, el fondo común será de 80 puntos.
    - Después de multiplicar por 2, hay 160 puntos para dividir.
    - Cada jugador recibe 40 puntos (más que su contribución inicial).
    - Si un jugador contribuye con 0 mientras que otros contribuyen con 20, ese jugador conserva sus 20 puntos más recibe una parte igual del fondo común.
    
    El juego consiste en múltiples rondas. El jugador con la puntuación total más alta al final gana.
    
    Este juego explora dilemas sociales, cooperación y comportamiento de aprovechamiento gratuito.
  `,
  educationalContent: `
    <h3>Orígenes e Historia del Juego de Bienes Públicos</h3>
    
    <p>El Juego de Bienes Públicos fue desarrollado formalmente por economistas en la década de 1970 como una extensión de los modelos de provisión de bienes públicos en economía. Académicos como John Ledyard, Werner Güth y otros pioneros en economía experimental lo utilizaron para estudiar cómo las personas toman decisiones sobre contribuciones a bienes colectivos.</p>
    
    <p>Este juego modela situaciones reales donde los individuos deben decidir cuánto contribuir a recursos compartidos como parques públicos, investigación científica, infraestructura comunitaria o esfuerzos para mitigar el cambio climático. El desafío fundamental es que, aunque todos se benefician de la cooperación colectiva, cada individuo tiene un incentivo para "aprovecharse gratuitamente" de las contribuciones de los demás.</p>
    
    <p>Los experimentos con el Juego de Bienes Públicos han revelado varios patrones interesantes en el comportamiento humano. Típicamente, las personas comienzan contribuyendo cantidades significativas (aproximadamente el 40-60% de su dotación), pero las contribuciones tienden a disminuir con el tiempo a medida que algunos jugadores adoptan estrategias de aprovechamiento gratuito.</p>
    
    <p>Investigaciones posteriores han explorado modificaciones que pueden fomentar la cooperación, como la comunicación entre jugadores, la posibilidad de castigar a los no contribuyentes, la formación de reputación, y los efectos de diferentes marcos culturales e institucionales.</p>
    
    <p>El Juego de Bienes Públicos ha proporcionado información crucial para el diseño de políticas en áreas como impuestos, gestión de recursos comunes, financiamiento de infraestructura pública y cooperación internacional en problemas globales como el cambio climático y la salud pública.</p>
  `,
  validatePlayerCount: (playerCount: number): boolean => {
    // Public Goods Game needs at least 3 players to be interesting
    return playerCount >= 3 && playerCount <= 10; 
  },
  getDefaultGameState: (): PublicGoodsGameState => {
    return {
      round: 1,
      maxRounds: 6,
      status: 'in_progress',
      playerData: {},
      history: [],
      initialEndowment: 20, // Each player starts with 20 points per round
      multiplier: 2 // The public pool is multiplied by 2
    };
  }
};

export default PublicGoodsGame; 