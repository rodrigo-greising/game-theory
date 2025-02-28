'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { CournotCompetitionState, CournotPlayerData } from '@/games/cournotCompetition';
import { useRouter } from 'next/navigation';
import { database } from '@/config/firebaseClient';
import { ref, update } from 'firebase/database';

interface CournotCompetitionGameProps {
  onGameUpdate?: (gameState: CournotCompetitionState) => void;
}

const CournotCompetitionGame: React.FC<CournotCompetitionGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(10); // Default quantity in the middle of the range
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as CournotCompetitionState;
  const currentPlayerId = currentUser?.uid;
  const isGameOver = gameState.status === 'completed';
  const isInProgress = gameState.status === 'in_progress';
  const players = Object.values(currentSession.players || {});
  
  // Initialize playerData if it doesn't exist yet
  useEffect(() => {
    const initializePlayerData = async () => {
      if (
        currentPlayerId && 
        players.length >= 2 && 
        gameState && 
        gameState.status === 'in_progress' && 
        (!gameState.playerData || Object.keys(gameState.playerData).length === 0 || !gameState.playerData[currentPlayerId])
      ) {
        setLoading(true);
        try {
          // Create initial player data for all players
          const initialPlayerData: Record<string, CournotPlayerData> = {};
          
          players.forEach(player => {
            initialPlayerData[player.id] = {
              totalScore: 0,
              currentQuantity: null,
              ready: false
            };
          });
          
          // Update the game state with initialized player data
          const updatedGameState: CournotCompetitionState = {
            ...gameState,
            playerData: initialPlayerData
          };
          
          await updateGameState(updatedGameState);
        } catch (err: any) {
          console.error('Error initializing player data:', err);
          setError(err.message || 'Failed to initialize game data');
        } finally {
          setLoading(false);
        }
      }
    };
    
    initializePlayerData();
  }, [currentPlayerId, gameState, players, updateGameState]);
  
  // Add safety check for players
  if (!players || players.length < 2) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Waiting for all players to connect...</p>
        <p className="text-sm mt-2 text-gray-400">This game requires at least 2 players</p>
      </div>
    );
  }
  
  // Ensure gameState.playerData exists before trying to access it
  if (!gameState.playerData) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Initializing game data...</p>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  // Check if player has already set a quantity this round
  const hasSubmitted = currentPlayerId && 
    gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentQuantity !== undefined &&
    gameState.playerData[currentPlayerId]?.currentQuantity !== null;
  
  // Auto start game if needed (on first load)
  useEffect(() => {
    const autoStartGame = async () => {
      if (
        gameState.status === 'setup' && 
        players.length >= 2 && 
        currentUser?.uid && 
        !loading
      ) {
        setLoading(true);
        try {
          // Initialize the game if it's in setup state
          const playerData: Record<string, CournotPlayerData> = {};
          
          players.forEach(player => {
            playerData[player.id] = {
              totalScore: 0,
              ready: false
            };
          });
          
          const updatedGameState: CournotCompetitionState = {
            ...gameState,
            status: 'in_progress',
            round: 1,
            playerData: playerData
          };
          
          await updateGameState(updatedGameState);
          
          if (onGameUpdate) {
            onGameUpdate(updatedGameState);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to start game');
        } finally {
          setLoading(false);
        }
      }
    };
    
    autoStartGame();
  }, [gameState, players, currentUser, updateGameState, onGameUpdate, loading]);
  
  // Function to set a quantity
  const setCompetitionQuantity = async () => {
    if (!currentPlayerId || hasSubmitted || !isInProgress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the quantity is within valid range
      const validQuantity = Math.min(
        Math.max(quantity, gameState.minQuantity),
        gameState.maxQuantity
      );
      
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: 0,
        ready: false
      };
      
      // Create updated player data
      const updatedPlayerData: Record<string, CournotPlayerData> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentQuantity: validQuantity,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: CournotCompetitionState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have set quantities
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          // Add safety check to make sure the player exists in updatedPlayerData
          const playerData = updatedPlayerData[playerId];
          return playerData && 'ready' in playerData ? playerData.ready : false;
        }
      );
      
      // If all players have set quantities, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit quantity');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: CournotCompetitionState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length < 2) {
      console.error("Cournot Competition requires at least 2 players");
      return; // Requires at least 2 players
    }
    
    // Gather all player quantities
    const playerQuantities: Record<string, number | null | undefined> = {};
    let allQuantitiesValid = true;
    
    playerIds.forEach(playerId => {
      const quantity = currentState.playerData[playerId]?.currentQuantity;
      playerQuantities[playerId] = quantity;
      
      // Check if any quantities are undefined or null
      if (quantity === undefined || quantity === null) {
        allQuantitiesValid = false;
      }
    });
    
    // Safety check to make sure all quantities are defined
    if (!allQuantitiesValid) {
      console.error('Cannot evaluate round: one or more players have not set a quantity');
      return; // Cannot proceed without all quantities
    }
    
    // Convert the record to an array of valid quantities for calculations
    const validQuantities = Object.entries(playerQuantities)
      .filter(([_, quantity]) => quantity !== null && quantity !== undefined)
      .map(([playerId, quantity]) => ({ playerId, quantity: quantity as number }));
    
    // Calculate total quantity across all firms
    const totalQuantity = validQuantities.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate market price using demand function: P = a - b*Q
    const marketPrice = Math.max(
      0, // Price can't be negative
      currentState.demandIntercept - currentState.demandSlope * totalQuantity
    );
    
    // Calculate profits and scores for each player
    const profits: Record<string, number> = {};
    const scores: Record<string, number> = {};
    
    validQuantities.forEach(({ playerId, quantity }) => {
      // Profit = (market price - marginal cost) * quantity
      const profit = (marketPrice - currentState.marginalCost) * quantity;
      
      profits[playerId] = profit;
      scores[playerId] = profit; // In this game, profit equals score
    });
    
    // Create the round result
    const roundResult = {
      round: currentState.round,
      quantities: playerQuantities as Record<string, number>,
      totalQuantity,
      marketPrice,
      profits,
      scores
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData: Record<string, CournotPlayerData> = {};
    
    playerIds.forEach(playerId => {
      updatedPlayerData[playerId] = {
        totalScore: (currentState.playerData[playerId]?.totalScore || 0) + profits[playerId],
        currentQuantity: null,
        ready: false
      };
    });
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: CournotCompetitionState = {
      ...currentState,
      round: isLastRound ? currentState.round : currentState.round + 1,
      status: isLastRound ? 'completed' : 'in_progress',
      playerData: updatedPlayerData,
      history: Array.isArray(currentState.history) ? [...currentState.history, roundResult] : [roundResult]
    };
    
    // For tournament mode, update the tournament results in the session
    if (currentSession.isTournament) {
      try {
        // Create updated tournament results
        const tournamentResults = currentSession.tournamentResults ? { ...currentSession.tournamentResults } : {};
        
        // Update tournament stats for each player
        playerIds.forEach(playerId => {
          if (!tournamentResults[playerId]) {
            tournamentResults[playerId] = {
              playerId,
              totalScore: 0,
              matchesPlayed: 0,
              cooperateCount: 0,
              defectCount: 0,
              wins: 0,
              losses: 0,
              draws: 0
            };
          }
          
          // Update players' tournament scores
          tournamentResults[playerId].totalScore += profits[playerId];
        });
        
        // If game is completed, update matches played and win/loss/draw counts
        if (isLastRound) {
          // Find the highest score
          const playerScores = playerIds.map(playerId => ({
            playerId,
            score: updatedPlayerData[playerId].totalScore
          }));
          
          const highestScore = Math.max(...playerScores.map(p => p.score));
          const lowestScore = Math.min(...playerScores.map(p => p.score));
          
          // Check if there are multiple winners (tied for highest score)
          const winners = playerScores.filter(p => p.score === highestScore);
          const isMultipleWinners = winners.length > 1;
          
          // Update tournament stats for each player
          playerIds.forEach(playerId => {
            // Increment matches played
            tournamentResults[playerId].matchesPlayed += 1;
            
            const playerScore = updatedPlayerData[playerId].totalScore;
            
            if (isMultipleWinners && playerScore === highestScore) {
              // This is a draw among multiple top players
              tournamentResults[playerId].draws += 1;
            } else if (playerScore === highestScore) {
              // Single winner
              tournamentResults[playerId].wins += 1;
            } else if (playerScore === lowestScore && playerScores.length > 2) {
              // Lowest score in game with more than 2 players
              tournamentResults[playerId].losses += 1;
            } else if (playerScores.length === 2 && playerScore !== highestScore) {
              // In a two-player game, if not the winner
              tournamentResults[playerId].losses += 1;
            } else {
              // Middle scorers in games with more than 2 players
              tournamentResults[playerId].draws += 1;
            }
          });
        }
        
        // Update the tournament results in the database
        const sessionRef = ref(database, `sessions/${currentSession.id}`);
        await update(sessionRef, { tournamentResults });
      } catch (error) {
        console.error('Error updating tournament results:', error);
      }
    }
    
    // Update the game state
    await updateGameState(updatedGameState);
    
    // Call the callback if provided
    if (onGameUpdate) {
      onGameUpdate(updatedGameState);
    }
  };
  
  // Get all other players (not the current user)
  const getOtherPlayers = (): Player[] => {
    if (!currentPlayerId || !players || players.length < 2) return [];
    return players.filter(player => player.id !== currentPlayerId);
  };
  
  const otherPlayers = getOtherPlayers();
  
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
            : hasSubmitted 
              ? "Waiting for other players..." 
              : "Set your production quantity"}
        </p>
      </div>
      
      {/* Game Board - Quantity Input */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-lg mb-4 text-center">Your Production Quantity</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
              Choose your production quantity between {gameState.minQuantity} and {gameState.maxQuantity} units.
              Remember, the market price is determined by the total quantity produced by all firms.
              The price will be: ${gameState.demandIntercept} - (Total Quantity)
            </p>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span>{gameState.minQuantity}</span>
                <span>{gameState.maxQuantity}</span>
              </div>
              <input
                type="range"
                min={gameState.minQuantity}
                max={gameState.maxQuantity}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                disabled={loading || hasSubmitted}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="mt-2 text-center">
                <span className="text-2xl font-bold">{quantity} units</span>
              </div>
            </div>
            
            <button
              onClick={setCompetitionQuantity}
              disabled={loading || hasSubmitted}
              className={`w-full p-3 rounded-md text-white font-medium transition-all
                ${loading || hasSubmitted
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
                }`}
            >
              {loading ? 'Submitting...' : hasSubmitted ? 'Quantity Submitted' : 'Submit Quantity'}
            </button>
          </div>
          
          {hasSubmitted && gameState.playerData && currentPlayerId && gameState.playerData[currentPlayerId] && (
            <div className="mt-6 text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p>You've set a quantity of <strong>{gameState.playerData[currentPlayerId]?.currentQuantity} units</strong></p>
              <p className="text-sm text-gray-500 mt-1">
                Waiting for {Object.values(currentSession.players || {}).filter(p => 
                  p.id !== currentPlayerId && 
                  (!gameState.playerData[p.id] || 
                   !gameState.playerData[p.id].ready)
                ).map(p => p.displayName).join(', ')} to set quantities...
              </p>
            </div>
          )}
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
                  <th className="py-2 text-right">Your Quantity</th>
                  <th className="py-2 text-right">Total Quantity</th>
                  <th className="py-2 text-right">Market Price</th>
                  <th className="py-2 text-right">Your Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  if (!currentPlayerId) return null;
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2 text-right">{round.quantities[currentPlayerId]}</td>
                      <td className="py-2 text-right">{round.totalQuantity}</td>
                      <td className="py-2 text-right">${round.marketPrice.toFixed(2)}</td>
                      <td className="py-2 text-right">${round.profits[currentPlayerId].toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Current Round Results (after evaluation) */}
      {gameState.history && gameState.history.length > 0 && !isGameOver && (
        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-3">Round {gameState.round - 1} Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Market Overview</h4>
              <dl>
                <div className="grid grid-cols-2 py-1">
                  <dt>Total Quantity:</dt>
                  <dd className="text-right font-medium">
                    {gameState.history[gameState.history.length - 1].totalQuantity} units
                  </dd>
                </div>
                <div className="grid grid-cols-2 py-1">
                  <dt>Market Price:</dt>
                  <dd className="text-right font-medium">
                    ${gameState.history[gameState.history.length - 1].marketPrice.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Player Quantities</h4>
              <ul className="space-y-2">
                {Object.entries(gameState.history[gameState.history.length - 1].quantities).map(([playerId, qty]) => {
                  const player = players.find(p => p.id === playerId);
                  const isCurrentPlayer = playerId === currentPlayerId;
                  
                  return (
                    <li key={playerId} className="flex justify-between items-center">
                      <span className={isCurrentPlayer ? 'font-medium' : ''}>
                        {player?.displayName} {isCurrentPlayer ? '(You)' : ''}:
                      </span>
                      <span className="font-medium">{qty} units</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Final Scores */}
      {isGameOver && (
        <div className="mt-6">
          <h3 className="font-semibold text-xl mb-4">Final Scores</h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="grid gap-4">
              {players.map(player => {
                if (!gameState.playerData[player.id]) return null;
                
                const playerData = gameState.playerData[player.id];
                const isCurrentPlayer = player.id === currentPlayerId;
                const isWinner = Object.values(gameState.playerData).every(
                  p => p.totalScore <= playerData.totalScore
                );
                
                return (
                  <div 
                    key={player.id} 
                    className={`p-4 rounded-lg ${
                      isWinner 
                        ? 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-30 border border-yellow-200 dark:border-yellow-600' 
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`font-medium ${isCurrentPlayer ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                          {player.displayName} {isCurrentPlayer ? '(You)' : ''}
                        </span>
                        {isWinner && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                            Winner
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-lg">${playerData.totalScore.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={handleExitGame}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CournotCompetitionGame; 