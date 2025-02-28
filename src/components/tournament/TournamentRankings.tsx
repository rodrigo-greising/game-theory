import React from 'react';
import { useSession } from '@/context/SessionContext';
import { TournamentPlayerResult } from '@/context/SessionContext';

const TournamentRankings: React.FC = () => {
  const { currentSession } = useSession();
  
  if (!currentSession?.isTournament || !currentSession?.tournamentResults) {
    return null;
  }
  
  // Convert tournamentResults object to array for sorting
  const resultsArray = Object.values(currentSession.tournamentResults);
  
  // Sort by totalScore in descending order
  const sortedResults = [...resultsArray].sort((a, b) => b.totalScore - a.totalScore);
  
  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">Tournament Rankings</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-800/30 rounded-lg overflow-hidden">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200">Rank</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200">Player</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200">Score</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200">Matches</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200">W/L/D</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200">Cooperate</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-200">Defect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {sortedResults.map((result, index) => {
              // Find player name from the player ID
              const player = currentSession.players[result.playerId];
              const playerName = player ? player.displayName : 'Unknown Player';
              
              return (
                <tr key={result.playerId} className={index === 0 ? "bg-yellow-500/10" : ""}>
                  <td className="px-4 py-3 text-sm">
                    {index === 0 && (
                      <span className="inline-block mr-1">🏆</span>
                    )}
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {playerName}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-blue-400">
                    {result.totalScore}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {result.matchesPlayed}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-green-400">{result.wins}</span>/
                    <span className="text-red-400">{result.losses}</span>/
                    <span className="text-gray-400">{result.draws}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-green-400">
                    {result.cooperateCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-400">
                    {result.defectCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {sortedResults.length === 0 && (
        <p className="text-center text-gray-400 py-4">No tournament data available yet.</p>
      )}
    </div>
  );
};

export default TournamentRankings; 