import { Game, GameOption, GameRegistry } from '@/types/games';
import PrisonersDilemma from './prisonersDilemma';
import StagHunt from './stagHunt';
import Chicken from './chicken';
import BattleOfTheSexes from './battleOfTheSexes';
import MatchingPennies from './matchingPennies';
import UltimatumGame from './ultimatumGame';
import DictatorGame from './dictatorGame';
import PublicGoodsGame from './publicGoodsGame';
import CentipedeGame from './centipedeGame';
import TravelersDilemma from './travelersDilemma';
import CoordinationGame from './coordinationGame';
import VolunteersDilemma from './volunteersdilemma';
import RockPaperScissors from './rockPaperScissors';
import BertrandCompetition from './bertrandCompetition';
import CournotCompetition from './cournotCompetition';

// Registry of all available games (follows Open/Closed principle)
const games: GameRegistry = {
  [PrisonersDilemma.id]: PrisonersDilemma,
  [StagHunt.id]: StagHunt,
  [Chicken.id]: Chicken,
  [BattleOfTheSexes.id]: BattleOfTheSexes,
  [MatchingPennies.id]: MatchingPennies,
  [UltimatumGame.id]: UltimatumGame,
  [DictatorGame.id]: DictatorGame,
  [PublicGoodsGame.id]: PublicGoodsGame,
  [CentipedeGame.id]: CentipedeGame,
  [TravelersDilemma.id]: TravelersDilemma,
  [CoordinationGame.id]: CoordinationGame,
  [VolunteersDilemma.id]: VolunteersDilemma,
  [RockPaperScissors.id]: RockPaperScissors,
  [BertrandCompetition.id]: BertrandCompetition,
  [CournotCompetition.id]: CournotCompetition,
  // Additional games will be added here in the future
};

// Get a list of all available games for the UI
export const getGameOptions = (): GameOption[] => {
  return Object.values(games).map(game => ({
    id: game.id,
    name: game.name,
    description: game.description,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers
  }));
};

// Get a specific game by ID
export const getGameById = (gameId: string): Game | undefined => {
  return games[gameId];
};

// Validate if a game exists
export const gameExists = (gameId: string): boolean => {
  return !!games[gameId];
};

// Check if the player count is valid for a specific game
export const isValidPlayerCount = (gameId: string, playerCount: number): boolean => {
  const game = games[gameId];
  if (!game) return false;
  
  return game.validatePlayerCount(playerCount);
};

export default games; 