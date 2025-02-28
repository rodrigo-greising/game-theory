'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { PublicGoodsGameState, PublicGoodsPlayerData } from '@/games/publicGoodsGame';
import { useRouter } from 'next/navigation';
import { database } from '@/config/firebaseClient';
import { ref, update } from 'firebase/database';

interface PublicGoodsGameProps {
  onGameUpdate?: (gameState: PublicGoodsGameState) => void;
}

const PublicGoodsGame: React.FC<PublicGoodsGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contribution, setContribution] = useState<number>(0);
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as PublicGoodsGameState;
  const currentPlayerId = currentUser?.uid;
  const isGameOver = gameState.status === 'completed';
  const isInProgress = gameState.status === 'in_progress';
  const players = Object.values(currentSession.players || {});
  
  // Add safety check for players
  if (!players || players.length < 3) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Waiting for all players to connect...</p>
        <p className="text-sm mt-2 text-gray-400">This game requires at least 3 players</p>
      </div>
    );
  }
  
  // Check if player has already made a contribution this round
  const hasContributed = currentPlayerId && gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentContribution !== undefined &&
    gameState.playerData[currentPlayerId]?.currentContribution !== null;
  
  // Function to make a contribution
  const makeContribution = async (amount: number) => {
    if (!currentPlayerId || hasContributed || !isInProgress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: 0,
        ready: false
      };
      
      // Create updated player data
      const updatedPlayerData: Record<string, PublicGoodsPlayerData> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentContribution: amount,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: PublicGoodsGameState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have made contributions
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          // Add safety check to make sure the player exists in updatedPlayerData
          const playerData = updatedPlayerData[playerId as string];
          return playerData && 'ready' in playerData ? playerData.ready : false;
        }
      );
      
      // If all players have made contributions, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
      
      setContribution(amount);
    } catch (err: any) {
      setError(err.message || 'Failed to submit contribution');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: PublicGoodsGameState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length < 3) {
      console.error("Public Goods Game requires at least 3 players");
      return;
    }
    
    // Calculate the public pool
    let publicPool = 0;
    const contributions: Record<string, number> = {};
    
    // Get all contributions and sum them
    for (const playerId of playerIds) {
      const playerData = currentState.playerData[playerId];
      const contribution = playerData && playerData.currentContribution !== undefined && playerData.currentContribution !== null 
        ? playerData.currentContribution 
        : 0;
      
      publicPool += contribution;
      contributions[playerId] = contribution;
    }
    
    // Calculate the return after multiplying the public pool
    const totalReturn = publicPool * currentState.multiplier;
    const individualReturn = totalReturn / playerIds.length;
    
    // Calculate each player's score for this round
    const scores: Record<string, number> = {};
    const returns: Record<string, number> = {};
    
    for (const playerId of playerIds) {
      const contribution = contributions[playerId];
      const initialPoints = currentState.initialEndowment;
      const kept = initialPoints - contribution;
      const received = individualReturn;
      const roundScore = kept + received;
      
      scores[playerId] = roundScore;
      returns[playerId] = received;
    }
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      contributions: contributions,
      publicPool: publicPool,
      multiplier: currentState.multiplier,
      returns: returns,
      scores: scores
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData: Record<string, PublicGoodsPlayerData> = {};
    
    for (const playerId of playerIds) {
      const currentPlayerData = currentState.playerData[playerId] || { totalScore: 0, ready: false };
      updatedPlayerData[playerId] = {
        totalScore: currentPlayerData.totalScore + scores[playerId],
        currentContribution: null,
        ready: false
      };
    }
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: PublicGoodsGameState = {
      ...currentState,
      round: isLastRound ? currentState.round : currentState.round + 1,
      status: isLastRound ? 'completed' : 'in_progress',
      playerData: updatedPlayerData,
      history: Array.isArray(currentState.history) ? [...currentState.history, roundResult] : [roundResult]
    };
    
    // Update the game state
    await updateGameState(updatedGameState);
    
    // Call the callback if provided
    if (onGameUpdate) {
      onGameUpdate(updatedGameState);
    }
  };
  
  // Function to handle exiting the game
  const handleExitGame = async () => {
    setLoading(true);
    try {
      await finishGame();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to exit game');
    } finally {
      setLoading(false);
    }
  };

  // Function to get player name by ID
  const getPlayerName = (playerId: string): string => {
    const player = players.find(p => p.id === playerId);
    return player ? player.displayName : 'Unknown';
  };
  
  // Calculate the average contribution from all players in previous rounds
  const calculateAverageContribution = (): number => {
    if (!gameState.history || gameState.history.length === 0) return 0;
    
    const totalContributions = gameState.history.reduce((sum, round) => {
      const roundTotal = Object.values(round.contributions).reduce((a, b) => a + b, 0);
      return sum + roundTotal;
    }, 0);
    
    const numberOfContributions = gameState.history.length * Object.keys(gameState.history[0].contributions).length;
    return numberOfContributions > 0 ? totalContributions / numberOfContributions : 0;
  };
  
  // Function to find the player with the highest score
  const getLeader = (): { playerId: string, score: number } | null => {
    if (!gameState.playerData) return null;
    
    let leader = null;
    let highestScore = -1;
    
    Object.entries(gameState.playerData).forEach(([playerId, data]) => {
      if (data.totalScore > highestScore) {
        highestScore = data.totalScore;
        leader = { playerId, score: highestScore };
      }
    });
    
    return leader;
  };
  
  const leader = getLeader();
  const averageContribution = calculateAverageContribution();
  
  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Game Status */}
      <div className="mb-6 text-center">
        <h3 className="text-xl font-semibold mb-2">
          {isGameOver 
            ? "Game Over" 
            : `Round ${gameState.round} of ${gameState.maxRounds}`}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {isGameOver 
            ? "Final results are in!" 
            : hasContributed 
              ? "Waiting for other players..." 
              : `Choose your contribution (0-${gameState.initialEndowment})`}
        </p>
      </div>
      
      {/* Game Board - Contribution Input */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h4 className="font-semibold text-lg mb-4">Make Your Contribution</h4>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              You have {gameState.initialEndowment} points. How much would you like to contribute to the public pool?
            </p>
            
            {!hasContributed ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <input
                    type="range"
                    min="0"
                    max={gameState.initialEndowment}
                    value={contribution}
                    onChange={(e) => setContribution(parseInt(e.target.value))}
                    className="w-full"
                    disabled={loading || hasContributed}
                  />
                </div>
                <div className="flex justify-between mb-6">
                  <span>0</span>
                  <span className="font-bold">{contribution}</span>
                  <span>{gameState.initialEndowment}</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <div>
                    <p className="font-medium">You keep:</p>
                    <p className="text-lg">{gameState.initialEndowment - contribution}</p>
                  </div>
                  <div>
                    <p className="font-medium">You contribute:</p>
                    <p className="text-lg">{contribution}</p>
                  </div>
                </div>
                <button
                  onClick={() => makeContribution(contribution)}
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Confirming...' : 'Confirm Contribution'}
                </button>
              </>
            ) : (
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="mb-2">You've contributed <strong>{gameState.playerData[currentPlayerId!]?.currentContribution}</strong> points</p>
                <p className="text-sm text-gray-500">Waiting for other players to make their contributions...</p>
              </div>
            )}
          </div>
          
          {/* Info Box */}
          <div className="w-full max-w-md mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <h4 className="font-semibold mb-2">How it works:</h4>
            <p className="text-sm mb-2">
              All contributions are added to a public pool, which is then multiplied by {gameState.multiplier} and 
              divided equally among all players regardless of their individual contributions.
            </p>
            <p className="text-sm">
              Your final points for the round = (Points you keep) + (Your share of the public pool)
            </p>
          </div>
        </div>
      )}
      
      {/* Game Results */}
      {Array.isArray(gameState.history) && gameState.history.length > 0 && (
        <div className="mt-auto">
          <h3 className="font-semibold text-lg mb-3">Game History</h3>
          
          <div className="overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left">Round</th>
                  <th className="py-2 text-left">Your Contribution</th>
                  <th className="py-2 text-left">Public Pool</th>
                  <th className="py-2 text-right">Your Return</th>
                  <th className="py-2 text-right">Your Score</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  // Skip rendering if round data is incomplete
                  if (!round || !round.contributions || !round.scores) {
                    return null;
                  }
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2">
                        {currentPlayerId && round.contributions[currentPlayerId]}
                      </td>
                      <td className="py-2">
                        {round.publicPool} × {round.multiplier} = {round.publicPool * round.multiplier}
                      </td>
                      <td className="py-2 text-right">
                        {currentPlayerId && round.returns && round.returns[currentPlayerId].toFixed(1)}
                      </td>
                      <td className="py-2 text-right">
                        {currentPlayerId && round.scores && round.scores[currentPlayerId].toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {isGameOver && gameState.playerData && (
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={4} className="py-2 text-right">Final Score:</td>
                    <td className="py-2 text-right">
                      {currentPlayerId && gameState.playerData && 
                       gameState.playerData[currentPlayerId]?.totalScore.toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          
          {/* Game Stats */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-1">Average Contribution</h4>
              <p className="text-xl font-bold">{averageContribution.toFixed(1)} points</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-1">Your Score</h4>
              <p className="text-xl font-bold">
                {currentPlayerId && gameState.playerData && 
                 gameState.playerData[currentPlayerId]?.totalScore.toFixed(1)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-1">Current Leader</h4>
              <p className="text-xl font-bold">
                {leader ? `${getPlayerName(leader.playerId)} (${leader.score.toFixed(1)})` : 'N/A'}
              </p>
            </div>
          </div>
          
          {/* Add Game Over summary with leaderboard */}
          {isGameOver && (
            <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <h2 className="text-2xl font-bold mb-4 text-center">Game Complete!</h2>
              
              <h3 className="text-lg font-semibold mb-2">Final Scores</h3>
              <div className="overflow-hidden bg-white dark:bg-gray-700 rounded-lg shadow mb-4">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800">
                      <th className="py-2 px-4 text-left">Player</th>
                      <th className="py-2 px-4 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players
                      .filter(player => gameState.playerData[player.id])
                      .sort((a, b) => 
                        (gameState.playerData[b.id]?.totalScore || 0) - 
                        (gameState.playerData[a.id]?.totalScore || 0)
                      )
                      .map((player, idx) => (
                        <tr 
                          key={player.id} 
                          className={`border-t border-gray-200 dark:border-gray-600 ${
                            player.id === currentPlayerId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <td className="py-2 px-4 flex items-center">
                            <span className="mr-2 text-sm font-bold">{idx + 1}.</span>
                            <span>{player.displayName}</span>
                            {idx === 0 && <span className="ml-2">🏆</span>}
                          </td>
                          <td className="py-2 px-4 text-right font-medium">
                            {gameState.playerData[player.id]?.totalScore.toFixed(1)}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
              
              <div className="mt-6 text-center">
                <button
                  onClick={handleExitGame}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicGoodsGame; 