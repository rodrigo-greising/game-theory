'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { BertrandCompetitionState, BertrandPlayerData } from '@/games/bertrandCompetition';
import { useRouter } from 'next/navigation';
import { database } from '@/config/firebaseClient';
import { ref, update } from 'firebase/database';

interface BertrandCompetitionGameProps {
  onGameUpdate?: (gameState: BertrandCompetitionState) => void;
}

const BertrandCompetitionGame: React.FC<BertrandCompetitionGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<number>(30); // Default price in the middle of the range
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as BertrandCompetitionState;
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
          const initialPlayerData: Record<string, BertrandPlayerData> = {};
          
          players.forEach(player => {
            initialPlayerData[player.id] = {
              totalScore: 0,
              currentPrice: null,
              ready: false
            };
          });
          
          // Update the game state with initialized player data
          const updatedGameState: BertrandCompetitionState = {
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
  
  // Check if player has already set a price this round
  const hasPriced = currentPlayerId && 
    gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentPrice !== undefined &&
    gameState.playerData[currentPlayerId]?.currentPrice !== null;
  
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
          const playerData: Record<string, BertrandPlayerData> = {};
          
          players.forEach(player => {
            playerData[player.id] = {
              totalScore: 0,
              ready: false
            };
          });
          
          const updatedGameState: BertrandCompetitionState = {
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
  
  // Function to set a price
  const setCompetitionPrice = async () => {
    if (!currentPlayerId || hasPriced || !isInProgress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the price is within valid range
      const validPrice = Math.min(
        Math.max(price, gameState.minPrice),
        gameState.maxPrice
      );
      
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: 0,
        ready: false
      };
      
      // Create updated player data
      const updatedPlayerData: Record<string, BertrandPlayerData> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentPrice: validPrice,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: BertrandCompetitionState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have set prices
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          // Add safety check to make sure the player exists in updatedPlayerData
          const playerData = updatedPlayerData[playerId];
          return playerData && 'ready' in playerData ? playerData.ready : false;
        }
      );
      
      // If all players have set prices, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit price');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: BertrandCompetitionState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length < 2) {
      console.error("Bertrand Competition requires at least 2 players");
      return; // Requires at least 2 players
    }
    
    // Gather all player prices
    const playerPrices: Record<string, number | null | undefined> = {};
    let allPricesValid = true;
    
    playerIds.forEach(playerId => {
      const price = currentState.playerData[playerId]?.currentPrice;
      playerPrices[playerId] = price;
      
      // Check if any prices are undefined or null
      if (price === undefined || price === null) {
        allPricesValid = false;
      }
    });
    
    // Safety check to make sure all prices are defined
    if (!allPricesValid) {
      console.error('Cannot evaluate round: one or more players have not set a price');
      return; // Cannot proceed without all prices
    }
    
    // Convert the record to an array of valid prices for calculations
    const validPrices = Object.entries(playerPrices)
      .filter(([_, price]) => price !== null && price !== undefined)
      .map(([playerId, price]) => ({ playerId, price: price as number }));
    
    // Find the lowest price
    const lowestPrice = Math.min(...validPrices.map(item => item.price));
    
    // Identify players who set the lowest price
    const lowestPricePlayerIds = validPrices
      .filter(item => item.price === lowestPrice)
      .map(item => item.playerId);
    
    // Calculate market shares, profits, and scores
    const marketShares: Record<string, number> = {};
    const profits: Record<string, number> = {};
    const scores: Record<string, number> = {};
    
    // If multiple players set the lowest price, they share the market equally
    const marketSharePerLowestPlayer = lowestPricePlayerIds.length > 0 
      ? currentState.marketDemand / lowestPricePlayerIds.length 
      : 0;
    
    validPrices.forEach(({ playerId, price }) => {
      // Only players with the lowest price get market share
      const marketShare = lowestPricePlayerIds.includes(playerId) ? marketSharePerLowestPlayer : 0;
      
      // Calculate profit: (price - marginal cost) * market share
      const profit = (price - currentState.marginalCost) * marketShare;
      
      marketShares[playerId] = marketShare;
      profits[playerId] = profit;
      scores[playerId] = profit; // In this game, profit equals score
    });
    
    // Create the round result
    const roundResult = {
      round: currentState.round,
      prices: playerPrices as Record<string, number>,
      marketShares,
      profits,
      scores
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData: Record<string, BertrandPlayerData> = {};
    
    playerIds.forEach(playerId => {
      updatedPlayerData[playerId] = {
        totalScore: (currentState.playerData[playerId]?.totalScore || 0) + profits[playerId],
        currentPrice: null,
        ready: false
      };
    });
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: BertrandCompetitionState = {
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
            : hasPriced 
              ? "Waiting for other players..." 
              : "Set your price"}
        </p>
      </div>
      
      {/* Game Board - Price Input */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-lg mb-4 text-center">Your Price</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
              Choose a price between ${gameState.minPrice} and ${gameState.maxPrice}.
              Remember, consumers will buy from the firm offering the lowest price.
              If multiple firms set the same lowest price, they share the market equally.
            </p>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span>${gameState.minPrice}</span>
                <span>${gameState.maxPrice}</span>
              </div>
              <input
                type="range"
                min={gameState.minPrice}
                max={gameState.maxPrice}
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value))}
                disabled={loading || hasPriced}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="mt-2 text-center">
                <span className="text-2xl font-bold">${price}</span>
              </div>
            </div>
            
            <button
              onClick={setCompetitionPrice}
              disabled={loading || hasPriced}
              className={`w-full p-3 rounded-md text-white font-medium transition-all
                ${loading || hasPriced
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
                }`}
            >
              {loading ? 'Submitting...' : hasPriced ? 'Price Submitted' : 'Submit Price'}
            </button>
          </div>
          
          {hasPriced && gameState.playerData && currentPlayerId && gameState.playerData[currentPlayerId] && (
            <div className="mt-6 text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p>You've set a price of <strong>${gameState.playerData[currentPlayerId]?.currentPrice}</strong></p>
              <p className="text-sm text-gray-500 mt-1">
                Waiting for {Object.values(currentSession.players || {}).filter(p => 
                  p.id !== currentPlayerId && 
                  (!gameState.playerData[p.id] || 
                   !gameState.playerData[p.id].ready)
                ).map(p => p.displayName).join(', ')} to set prices...
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
                  <th className="py-2 text-right">Your Price</th>
                  <th className="py-2 text-right">Lowest Price</th>
                  <th className="py-2 text-right">Your Market Share</th>
                  <th className="py-2 text-right">Your Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  // Skip rendering if round data is incomplete
                  if (!round || !round.prices || !round.marketShares || !round.profits) {
                    return null;
                  }
                  
                  // Calculate lowest price in this round
                  const lowestPrice = Math.min(...Object.values(round.prices));
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2 text-right">
                        ${currentPlayerId && round.prices[currentPlayerId]}
                      </td>
                      <td className="py-2 text-right font-medium">
                        ${lowestPrice}
                      </td>
                      <td className="py-2 text-right">
                        {currentPlayerId && round.marketShares[currentPlayerId].toFixed(1)} units
                      </td>
                      <td className="py-2 text-right">
                        ${currentPlayerId && round.profits[currentPlayerId].toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {isGameOver && gameState.playerData && (
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={4} className="py-2 text-right">Total Profit:</td>
                    <td className="py-2 text-right">
                      ${currentPlayerId && gameState.playerData[currentPlayerId]?.totalScore.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          
          {/* Add Game Over summary with larger display of total points */}
          {isGameOver && (
            <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
              <h2 className="text-2xl font-bold mb-4">Game Complete!</h2>
              <div className="flex flex-col justify-center items-center gap-4">
                <h3 className="text-xl font-semibold">Final Profits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full mt-4">
                  {players.map(player => {
                    const isCurrentPlayer = player.id === currentPlayerId;
                    const playerScore = gameState.playerData[player.id]?.totalScore || 0;
                    const highestScore = Math.max(...Object.values(gameState.playerData).map(p => p.totalScore));
                    const isWinner = playerScore === highestScore;
                    
                    return (
                      <div 
                        key={player.id} 
                        className={`p-4 rounded-lg ${isWinner ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-white dark:bg-gray-700'} 
                                   ${isCurrentPlayer ? 'border-2 border-blue-500' : ''}`}
                      >
                        <div className="font-medium text-lg">
                          {isCurrentPlayer ? 'You' : player.displayName}
                          {isWinner && <span className="ml-2">🏆</span>}
                        </div>
                        <div className="text-3xl font-bold mt-2">${playerScore.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={handleExitGame}
                  className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg"
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

export default BertrandCompetitionGame; 