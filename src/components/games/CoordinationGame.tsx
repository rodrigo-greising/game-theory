'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { CoordinationGameState, Choice, SCORING } from '@/games/coordinationGame';
import { useRouter } from 'next/navigation';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebaseClient';

interface CoordinationGameProps {
  onGameUpdate?: (gameState: CoordinationGameState) => void;
}

const CoordinationGame: React.FC<CoordinationGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as CoordinationGameState;
  const currentPlayerId = currentUser?.uid;
  const isGameOver = gameState.status === 'completed';
  const isInProgress = gameState.status === 'in_progress';
  const isSetup = gameState.status === 'setup';
  const isRoundZero = gameState.round === 0;
  const isHost = currentUser?.uid && currentSession.players[currentUser.uid]?.isHost;
  const needsInitialization = isSetup || isRoundZero || !gameState.playerData || Object.keys(gameState.playerData).length === 0;
  const players = Object.values(currentSession.players || {});
  
  // Auto-start game when needed
  useEffect(() => {
    if (needsInitialization && isHost && !loading) {
      const autoStartGame = async () => {
        setLoading(true);
        try {
          // Initialize player data
          const initialPlayerData: Record<string, any> = {};
          
          // Create player data for each player
          Object.keys(currentSession.players).forEach(playerId => {
            initialPlayerData[playerId] = {
              totalScore: 0,
              currentChoice: null,
              ready: false
            };
          });
          
          // Update game state to in_progress
          const updatedGameState: CoordinationGameState = {
            ...gameState,
            status: 'in_progress',
            round: 1, // Start at round 1 instead of 0
            playerData: initialPlayerData
          };
          
          await updateGameState(updatedGameState);
        } catch (err: any) {
          setError(err.message || 'Failed to start game');
        } finally {
          setLoading(false);
        }
      };
      
      autoStartGame();
    }
  }, [needsInitialization, isHost, loading, gameState, currentSession, updateGameState]);
  
  // If game is loading or needs initialization, show a simple loading UI
  if (loading || needsInitialization) {
    return (
      <div className="flex flex-col items-center text-center p-6">
        <div className="animate-pulse mb-4">
          <span className="text-5xl">🅰️ 🅱️</span>
        </div>
        <h3 className="text-xl font-semibold mb-4">Loading Game...</h3>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  // Add safety check for players
  if (!players || players.length < 2) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Waiting for all players to connect...</p>
        <p className="text-sm mt-2 text-gray-400">This game requires at least 2 players</p>
      </div>
    );
  }
  
  // Check if player has already made a choice this round
  const hasChosen = currentPlayerId && 
    gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentChoice !== null &&
    gameState.playerData[currentPlayerId]?.currentChoice !== undefined;
  
  // Function to make a choice
  const makeChoice = async (selectedChoice: Choice) => {
    if (!currentPlayerId || hasChosen || !isInProgress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: 0,
        ready: false
      };
      
      // Create updated player data
      const updatedPlayerData: Record<string, {
        totalScore: number;
        currentChoice?: Choice | null;
        ready: boolean;
      }> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentChoice: selectedChoice,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: CoordinationGameState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have made choices
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          // Add safety check to make sure the player exists in updatedPlayerData
          const playerData = updatedPlayerData[playerId as string];
          return playerData && 'ready' in playerData ? playerData.ready : false;
        }
      );
      
      // If all players have made choices, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
      
      setChoice(selectedChoice);
    } catch (err: any) {
      setError(err.message || 'Failed to submit choice');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: CoordinationGameState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length < 2) {
      console.error("Coordination Game requires at least 2 players");
      return;
    }
    
    // Get all player choices
    const playerChoices: Array<{ playerId: string, choice: Choice }> = [];
    
    for (const playerId of playerIds) {
      const choice = currentState.playerData[playerId]?.currentChoice;
      if (!choice) {
        console.error('Cannot evaluate round: one or more players have not made a choice');
        return; // Cannot proceed without all choices
      }
      
      playerChoices.push({ playerId, choice });
    }
    
    // Check if all players chose the same option
    const firstChoice = playerChoices[0].choice;
    const allSameChoice = playerChoices.every(pc => pc.choice === firstChoice);
    
    // Calculate the scores for this round
    const scores: Record<string, number> = {};
    
    playerIds.forEach(playerId => {
      // If all players chose the same option, everyone gets the coordination score
      // Otherwise, everyone gets the fail score
      scores[playerId] = allSameChoice ? SCORING.COORDINATE : SCORING.FAIL;
    });
    
    // Create the round result
    const roundResult = {
      round: currentState.round,
      choices: playerChoices.reduce((acc, pc) => {
        acc[pc.playerId] = pc.choice;
        return acc;
      }, {} as Record<string, Choice>),
      scores
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData: Record<string, {
      totalScore: number;
      currentChoice: null;
      ready: boolean;
    }> = {};
    
    playerIds.forEach(playerId => {
      updatedPlayerData[playerId] = {
        totalScore: (currentState.playerData[playerId]?.totalScore || 0) + scores[playerId],
        currentChoice: null,
        ready: false
      };
    });
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: CoordinationGameState = {
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
          
          // Update tournament scores
          tournamentResults[playerId].totalScore += scores[playerId];
          
          // For coordination game:
          // - Count choosing the most popular option as "cooperation"
          // - Count choosing the less popular option as "defection"
          const playerChoice = currentState.playerData[playerId]?.currentChoice;
          
          if (playerChoice) {
            // Count choices for each option
            const optionCounts = playerChoices.reduce((counts, pc) => {
              counts[pc.choice] = (counts[pc.choice] || 0) + 1;
              return counts;
            }, {} as Record<Choice, number>);
            
            // Find the most popular choice
            const mostPopularChoice = Object.entries(optionCounts)
              .sort(([, countA], [, countB]) => countB - countA)[0][0] as Choice;
            
            if (playerChoice === mostPopularChoice) {
              tournamentResults[playerId].cooperateCount += 1;
            } else {
              tournamentResults[playerId].defectCount += 1;
            }
          }
        });
        
        // If game is completed, update matches played and win/loss/draw counts
        if (isLastRound) {
          // Find the highest and lowest scores
          const playerScores = playerIds.map(playerId => ({
            playerId,
            score: updatedPlayerData[playerId].totalScore
          }));
          
          const highestScore = Math.max(...playerScores.map(p => p.score));
          
          // In coordination games, either everyone wins or no one does
          if (highestScore > 0) {
            // Check if there are multiple winners (tied for highest score)
            const winners = playerScores.filter(p => p.score === highestScore);
            
            playerIds.forEach(playerId => {
              // Increment matches played
              tournamentResults[playerId].matchesPlayed += 1;
              
              const playerScore = updatedPlayerData[playerId].totalScore;
              
              if (playerScore === highestScore) {
                if (winners.length === playerIds.length) {
                  // Everyone tied - it's a draw
                  tournamentResults[playerId].draws += 1;
                } else {
                  // This player is a winner
                  tournamentResults[playerId].wins += 1;
                }
              } else {
                // This player scored lower than the winners
                tournamentResults[playerId].losses += 1;
              }
            });
          } else {
            // Everyone scored 0 - it's a draw for everyone
            playerIds.forEach(playerId => {
              tournamentResults[playerId].matchesPlayed += 1;
              tournamentResults[playerId].draws += 1;
            });
          }
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
  
  // Function to get the count of each choice in the current round
  const getCurrentRoundChoiceCounts = () => {
    if (!gameState.playerData) return { A: 0, B: 0 };
    
    const counts = { A: 0, B: 0 };
    
    Object.values(gameState.playerData).forEach(playerData => {
      if (playerData.currentChoice === 'A') {
        counts.A += 1;
      } else if (playerData.currentChoice === 'B') {
        counts.B += 1;
      }
    });
    
    return counts;
  };
  
  // Function to render the emoji for a choice
  const renderChoiceEmoji = (playerChoice: Choice | null | undefined) => {
    if (playerChoice === 'A') return '🅰️';
    if (playerChoice === 'B') return '🅱️';
    return '❓';
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
            : hasChosen 
              ? "Waiting for other players..." 
              : "Make your choice"}
        </p>
      </div>
      
      {/* Current Round Overview (if game has history) */}
      {gameState.history && gameState.history.length > 0 && !isGameOver && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Previous Round Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
              <h4 className="font-medium mb-2">Results</h4>
              {(() => {
                const lastRound = gameState.history[gameState.history.length - 1];
                const choices = Object.values(lastRound.choices);
                const allSame = choices.every(c => c === choices[0]);
                
                return (
                  <div>
                    <p className="mb-2">
                      {allSame
                        ? `Everyone chose ${choices[0]} - Coordination successful! ✅`
                        : "Players chose different options - Coordination failed! ❌"}
                    </p>
                    <div className="flex space-x-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">🅰️</span>
                        <span className="font-medium">{choices.filter(c => c === 'A').length} players</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">🅱️</span>
                        <span className="font-medium">{choices.filter(c => c === 'B').length} players</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="bg-white dark:bg-gray-700 p-3 rounded-lg">
              <h4 className="font-medium mb-2">Your Score</h4>
              {currentPlayerId && (
                <div>
                  <p className="mb-2">
                    This round: {gameState.history[gameState.history.length - 1].scores[currentPlayerId]} points
                  </p>
                  <p className="font-bold">
                    Total score: {gameState.playerData[currentPlayerId]?.totalScore} points
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Game Board - Choice Buttons */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 text-center">
            <p className="text-lg">Choose either Option A or Option B</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You'll get {SCORING.COORDINATE} points if everyone chooses the same option, 
              and {SCORING.FAIL} points if there are any disagreements.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            <button
              onClick={() => makeChoice('A')}
              disabled={loading || hasChosen}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasChosen && choice === 'A'
                  ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-400'
                  : 'border-gray-300 hover:border-blue-500 dark:border-gray-600 dark:hover:border-blue-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">🅰️</span>
                <h4 className="font-bold mb-1">Option A</h4>
              </div>
            </button>
            
            <button
              onClick={() => makeChoice('B')}
              disabled={loading || hasChosen}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasChosen && choice === 'B'
                  ? 'bg-purple-100 border-purple-500 dark:bg-purple-900 dark:border-purple-400'
                  : 'border-gray-300 hover:border-purple-500 dark:border-gray-600 dark:hover:border-purple-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">🅱️</span>
                <h4 className="font-bold mb-1">Option B</h4>
              </div>
            </button>
          </div>
          
          {hasChosen && (
            <div className="mt-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-center mb-2">
                You chose Option {choice} {renderChoiceEmoji(choice)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Waiting for the other players to make their choices...
              </p>
              <div className="mt-3">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ 
                      width: `${(Object.values(gameState.playerData).filter(pd => pd.ready).length / 
                               Object.keys(currentSession.players).length) * 100}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Game Results */}
      {isGameOver && gameState.history && gameState.history.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Game Results</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="py-2 px-4 text-left">Round</th>
                  <th className="py-2 px-4 text-left">Your Choice</th>
                  <th className="py-2 px-4 text-left">Group Outcome</th>
                  <th className="py-2 px-4 text-right">Your Points</th>
                  <th className="py-2 px-4 text-right">Success</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  if (!currentPlayerId) return null;
                  
                  const yourChoice = round.choices[currentPlayerId];
                  const allChoices = Object.values(round.choices);
                  const isSuccess = allChoices.every(c => c === allChoices[0]);
                  const yourScore = round.scores[currentPlayerId];
                  
                  return (
                    <tr key={index} className="border-b dark:border-gray-700">
                      <td className="py-2 px-4">{round.round}</td>
                      <td className="py-2 px-4 flex items-center">
                        <span className="mr-1">{renderChoiceEmoji(yourChoice)}</span> 
                        Option {yourChoice}
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex flex-col">
                          <div className="flex space-x-2">
                            <span className="flex items-center">
                              <span className="text-xl mr-1">🅰️</span> 
                              {allChoices.filter(c => c === 'A').length}
                            </span>
                            <span className="flex items-center">
                              <span className="text-xl mr-1">🅱️</span> 
                              {allChoices.filter(c => c === 'B').length}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-4 text-right">{yourScore}</td>
                      <td className="py-2 px-4 text-right">
                        {isSuccess ? '✅' : '❌'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Final Scores */}
      {isGameOver && (
        <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-6 rounded-lg mb-8">
          <h3 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-100">Final Scores</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {players.map(player => {
              const playerData = gameState.playerData[player.id];
              if (!playerData) return null;
              
              const isCurrentPlayer = player.id === currentPlayerId;
              const isWinner = Object.values(gameState.playerData).every(
                p => p.totalScore <= playerData.totalScore
              );
              const hasHighestScore = playerData.totalScore > 0 && isWinner;
              
              return (
                <div 
                  key={player.id} 
                  className={`p-4 rounded-lg ${
                    hasHighestScore 
                      ? 'bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 border border-yellow-300 dark:border-yellow-600' 
                      : 'bg-white dark:bg-gray-800'
                  } ${isCurrentPlayer ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="font-bold text-lg mb-1 flex items-center">
                    {player.displayName}
                    {isCurrentPlayer && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold">
                    {playerData.totalScore} pts
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Play Again Button */}
      {isGameOver && (
        <div className="text-center">
          <button
            onClick={handleExitGame}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default CoordinationGame; 