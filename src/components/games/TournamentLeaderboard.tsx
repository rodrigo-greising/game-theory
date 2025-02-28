'use client';

import React from 'react';
import { useSession, TournamentPlayerResult } from '@/context/SessionContext';

interface TournamentLeaderboardProps {
  className?: string;
}

const TournamentLeaderboard: React.FC<TournamentLeaderboardProps> = ({ className }) => {
  const { currentSession } = useSession();
  
  if (!currentSession || !currentSession.isTournament || !currentSession.tournamentResults) {
    return null;
  }
  
  const results = Object.values(currentSession.tournamentResults);
  
  // Sort results by total score (descending)
  const sortedResults = [...results].sort((a, b) => b.totalScore - a.totalScore);
  
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className || ''}`}>
      <h3 className="text-xl font-bold mb-4 text-center">Clasificación del Torneo</h3>
      
      {sortedResults.length === 0 ? (
        <p className="text-center text-gray-500">Aún no hay resultados</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Posición</th>
                <th className="px-4 py-2 text-left">Jugador</th>
                <th className="px-4 py-2 text-right">Puntuación</th>
                <th className="px-4 py-2 text-right">Partidas</th>
                <th className="px-4 py-2 text-right">Victorias/Derrotas/Empates</th>
                <th className="px-4 py-2 text-center">% Cooperación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedResults.map((result, index) => {
                const playerName = currentSession.players[result.playerId]?.displayName || 'Desconocido';
                const totalDecisions = result.cooperateCount + result.defectCount;
                const cooperationPercentage = totalDecisions === 0 
                  ? 0 
                  : Math.round((result.cooperateCount / totalDecisions) * 100);
                
                return (
                  <tr key={result.playerId} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center text-purple-800 dark:text-purple-100 mr-2">
                          {playerName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{playerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                      {result.totalScore}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {result.matchesPlayed}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-green-600 dark:text-green-400">{result.wins}</span>/
                      <span className="text-red-600 dark:text-red-400">{result.losses}</span>/
                      <span className="text-gray-600 dark:text-gray-400">{result.draws}</span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mr-2">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${cooperationPercentage}%` }}
                          ></div>
                        </div>
                        <span>{cooperationPercentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold mb-2">Perspectivas de Teoría de Juegos</h4>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Esta clasificación muestra cómo diferentes jugadores se desempeñan en escenarios competitivos. 
          Observa cómo las tasas de cooperación se correlacionan con el éxito general.
        </p>
      </div>
    </div>
  );
};

export default TournamentLeaderboard; 