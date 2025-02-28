'use client';

import React from 'react';
import { useSession, GameSession } from '@/context/SessionContext';
import { getGameById, isValidPlayerCount } from '@/games/gameRegistry';

interface GameInfoProps {
  session?: GameSession;
}

const GameInfo: React.FC<GameInfoProps> = ({ session }) => {
  // Use the current session from context if none is provided
  const { currentSession } = useSession();
  const gameSession = session || currentSession;
  
  if (!gameSession) {
    return null;
  }
  
  // Check if game data exists in the session
  if (!gameSession.gameData || !gameSession.gameData.gameId) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-200 dark:border-yellow-700 rounded-md p-4 text-yellow-800 dark:text-yellow-200">
        <h3 className="text-lg font-medium">No hay juego seleccionado</h3>
        <p className="mt-1">No hay ningún juego asociado con esta sesión.</p>
      </div>
    );
  }
  
  // Get game details from registry
  const game = getGameById(gameSession.gameData.gameId);
  
  // Handle unknown games
  if (!game) {
    return (
      <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-700 rounded-md p-4 text-red-800 dark:text-red-200">
        <h3 className="text-lg font-medium">Juego desconocido</h3>
        <p className="mt-1">El juego "{gameSession.gameData.gameId}" no se encontró en el registro.</p>
      </div>
    );
  }
  
  // Count players
  const playerCount = Object.keys(gameSession.players || {}).length;
  const isTournament = gameSession.isTournament;
  
  // For tournament mode, player count validation is different
  const isValidPlayers = isTournament 
    ? playerCount >= 2 
    : isValidPlayerCount(game.id, playerCount);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">{game.name}</h3>
        
        {isTournament ? (
          <div className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:bg-opacity-20 dark:text-purple-200">
            Modo Torneo
          </div>
        ) : (
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isValidPlayers 
              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:bg-opacity-20 dark:text-green-200' 
              : 'bg-red-100 text-red-800 dark:bg-red-800 dark:bg-opacity-20 dark:text-red-200'
          }`}>
            {playerCount} / {game.minPlayers === game.maxPlayers ? game.maxPlayers : `${game.minPlayers}-${game.maxPlayers}`} Jugadores
          </div>
        )}
      </div>
      
      <p className="text-gray-600 dark:text-gray-300 mb-4">{game.description}</p>
      
      {isTournament ? (
        <div className="bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 border border-purple-200 dark:border-purple-700 rounded-md p-3 mb-4">
          <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-1">Modo Torneo</h4>
          <p className="text-sm text-purple-600 dark:text-purple-300">
            Los jugadores son emparejados aleatoriamente para los partidos. Los resultados de todos los juegos se agregan en una tabla de clasificación.
          </p>
          <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">
            Total de jugadores: {playerCount} (se requieren al menos 2)
          </p>
        </div>
      ) : !isValidPlayers && (
        <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-700 rounded-md p-3 mb-4 text-red-800 dark:text-red-200 text-sm">
          {playerCount < game.minPlayers
            ? `Este juego requiere al menos ${game.minPlayers} jugadores. Actualmente solo ${playerCount} ${playerCount === 1 ? 'jugador ha' : 'jugadores han'} unido.`
            : `Este juego admite un máximo de ${game.maxPlayers} jugadores. Actualmente ${playerCount} jugadores se han unido.`
          }
        </div>
      )}
      
      <div className="mt-4">
        <h4 className="font-medium mb-2 text-gray-700 dark:text-gray-200">Reglas del Juego</h4>
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md text-sm whitespace-pre-line">
          {game.rules}
        </div>
      </div>
      
      {game.id === 'prisoners-dilemma' && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-700 rounded-md">
          <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-200">Dilema del Prisionero</h4>
          <p className="text-sm text-blue-600 dark:text-blue-300">
            Este escenario clásico de teoría de juegos demuestra por qué dos individuos completamente racionales podrían no cooperar, incluso si parece que es lo más beneficioso para ambos.
          </p>
        </div>
      )}
      
      {game.id === 'stag-hunt' && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border border-green-200 dark:border-green-700 rounded-md">
          <h4 className="font-medium mb-2 text-green-700 dark:text-green-200">Caza del Ciervo</h4>
          <p className="text-sm text-green-600 dark:text-green-300">
            La Caza del Ciervo ilustra la tensión entre la cooperación social y la seguridad individual. Demuestra cómo la confianza mutua puede llevar a resultados óptimos, pero el miedo a la traición podría llevar a elecciones más seguras pero menos gratificantes.
          </p>
        </div>
      )}
    </div>
  );
};

export default GameInfo; 