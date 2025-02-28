'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { TravelersDilemmaState, TravelersDilemmaPlayerData } from '@/games/travelersDilemma';
import { useRouter } from 'next/navigation';
import { database } from '@/config/firebaseClient';
import { ref, update } from 'firebase/database';

interface TravelersDilemmaGameProps {
  onGameUpdate?: (gameState: TravelersDilemmaState) => void;
}

const TravelersDilemmaGame: React.FC<TravelersDilemmaGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimValue, setClaimValue] = useState<number>(50); // Default claim in the middle of the range
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as TravelersDilemmaState;
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
          const initialPlayerData: Record<string, TravelersDilemmaPlayerData> = {};
          
          players.forEach(player => {
            initialPlayerData[player.id] = {
              totalScore: 0,
              currentClaim: null,
              ready: false
            };
          });
          
          // Update the game state with initialized player data
          const updatedGameState: TravelersDilemmaState = {
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
        <p className="text-sm mt-2 text-gray-400">This game requires 2 players</p>
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
  
  // Check if player has already made a claim this round
  const hasClaimed = currentPlayerId && 
    gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentClaim !== undefined &&
    gameState.playerData[currentPlayerId]?.currentClaim !== null;
  
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
          const playerData: Record<string, TravelersDilemmaPlayerData> = {};
          
          players.forEach(player => {
            playerData[player.id] = {
              totalScore: 0,
              ready: false
            };
          });
          
          const updatedGameState: TravelersDilemmaState = {
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
  
  // Function to make a claim
  const makeClaim = async () => {
    if (!currentPlayerId || hasClaimed || !isInProgress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the claim is within valid range
      const validClaim = Math.min(
        Math.max(claimValue, gameState.minClaim),
        gameState.maxClaim
      );
      
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: 0,
        ready: false
      };
      
      // Create updated player data
      const updatedPlayerData: Record<string, TravelersDilemmaPlayerData> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentClaim: validClaim,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: TravelersDilemmaState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have made claims
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          // Add safety check to make sure the player exists in updatedPlayerData
          const playerData = updatedPlayerData[playerId as string];
          return playerData && 'ready' in playerData ? playerData.ready : false;
        }
      );
      
      // If all players have made claims, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit claim');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: TravelersDilemmaState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length < 2) {
      console.error("Traveler's Dilemma requires at least 2 players");
      return; // Traveler's Dilemma requires at least 2 players
    }
    
    // Gather all player claims
    const playerClaims: Record<string, number | null | undefined> = {};
    let allClaimsValid = true;
    
    playerIds.forEach(playerId => {
      const claim = currentState.playerData[playerId]?.currentClaim;
      playerClaims[playerId] = claim;
      
      // Check if any claims are undefined or null
      if (claim === undefined || claim === null) {
        allClaimsValid = false;
      }
    });
    
    // Safety check to make sure all claims are defined
    if (!allClaimsValid) {
      console.error('Cannot evaluate round: one or more players have not made a claim');
      return; // Cannot proceed without all claims
    }
    
    // Convert the record to an array of valid claims for calculations
    const validClaims = Object.entries(playerClaims)
      .filter(([_, claim]) => claim !== null && claim !== undefined)
      .map(([playerId, claim]) => ({ playerId, claim: claim as number }));
    
    // Find the lowest claim
    const lowestClaim = Math.min(...validClaims.map(item => item.claim));
    
    // Identify players who made the lowest claim
    const lowestClaimPlayerIds = validClaims
      .filter(item => item.claim === lowestClaim)
      .map(item => item.playerId);
    
    // Calculate rewards for each player
    const rewards: Record<string, number> = {};
    const scores: Record<string, number> = {};
    
    validClaims.forEach(({ playerId, claim }) => {
      // Base payment is the lowest claim for all players
      let reward = lowestClaim;
      
      // Only apply bonus/penalty if not all claims are the same
      if (new Set(validClaims.map(vc => vc.claim)).size > 1) {
        // Add bonus for players with the lowest claim
        if (lowestClaimPlayerIds.includes(playerId)) {
          reward += currentState.bonus;
        } else {
          // Apply penalty for players who claimed higher
          reward -= currentState.bonus;
        }
      }
      
      rewards[playerId] = reward;
      scores[playerId] = reward;
    });
    
    // Create the round result
    const roundResult = {
      round: currentState.round,
      claims: playerClaims as Record<string, number>,
      rewards,
      scores
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData: Record<string, TravelersDilemmaPlayerData> = {};
    
    playerIds.forEach(playerId => {
      updatedPlayerData[playerId] = {
        totalScore: (currentState.playerData[playerId]?.totalScore || 0) + rewards[playerId],
        currentClaim: null,
        ready: false
      };
    });
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: TravelersDilemmaState = {
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
          tournamentResults[playerId].totalScore += rewards[playerId];
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
            : hasClaimed 
              ? "Waiting for other players..." 
              : "Make your claim"}
        </p>
      </div>
      
      {/* Game Board - Claim Input */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-lg mb-4 text-center">Your Claim</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
              Choose a value between {gameState.minClaim} and {gameState.maxClaim}.
              Remember, if your claim is the lowest, you'll get a bonus of {gameState.bonus} points.
              But if your claim is higher than the lowest, you'll incur a penalty of {gameState.bonus} points.
            </p>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span>{gameState.minClaim}</span>
                <span>{gameState.maxClaim}</span>
              </div>
              <input
                type="range"
                min={gameState.minClaim}
                max={gameState.maxClaim}
                value={claimValue}
                onChange={(e) => setClaimValue(parseInt(e.target.value))}
                disabled={loading || hasClaimed}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="mt-2 text-center">
                <span className="text-2xl font-bold">{claimValue}</span>
              </div>
            </div>
            
            <button
              onClick={makeClaim}
              disabled={loading || hasClaimed}
              className={`w-full p-3 rounded-md text-white font-medium transition-all
                ${loading || hasClaimed
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
                }`}
            >
              {loading ? 'Submitting...' : hasClaimed ? 'Claim Submitted' : 'Submit Claim'}
            </button>
          </div>
          
          {hasClaimed && gameState.playerData && currentPlayerId && gameState.playerData[currentPlayerId] && (
            <div className="mt-6 text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p>You've claimed <strong>{gameState.playerData[currentPlayerId]?.currentClaim}</strong></p>
              <p className="text-sm text-gray-500 mt-1">
                Waiting for {Object.values(currentSession.players || {}).filter(p => 
                  p.id !== currentPlayerId && 
                  (!gameState.playerData[p.id] || 
                   !gameState.playerData[p.id].ready)
                ).map(p => p.displayName).join(', ')} to make claims...
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
                  <th className="py-2 text-right">Your Claim</th>
                  {players.map(player => 
                    player.id !== currentPlayerId && (
                      <th key={player.id} className="py-2 text-right">{player.displayName}'s Claim</th>
                    )
                  )}
                  <th className="py-2 text-right">Lowest Claim</th>
                  <th className="py-2 text-right">Your Points</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  // Skip rendering if round data is incomplete
                  if (!round || !round.claims || !round.rewards) {
                    return null;
                  }
                  
                  // Calculate lowest claim in this round
                  const lowestClaim = Math.min(...Object.values(round.claims));
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2 text-right">
                        {currentPlayerId && round.claims[currentPlayerId]}
                      </td>
                      {players.map(player => 
                        player.id !== currentPlayerId && (
                          <td key={player.id} className="py-2 text-right">
                            {round.claims[player.id]}
                          </td>
                        )
                      )}
                      <td className="py-2 text-right font-medium">
                        {lowestClaim}
                      </td>
                      <td className="py-2 text-right">
                        {currentPlayerId && round.rewards[currentPlayerId]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {isGameOver && gameState.playerData && (
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={3 + otherPlayers.length} className="py-2 text-right">Final Score:</td>
                    <td className="py-2 text-right">
                      {currentPlayerId && gameState.playerData[currentPlayerId]?.totalScore}
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
                <h3 className="text-xl font-semibold">Final Scores</h3>
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
                        <div className="text-3xl font-bold mt-2">{playerScore}</div>
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

export default TravelersDilemmaGame; 