'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { CentipedeGameState, Decision, CentipedePlayerData } from '@/games/centipedeGame';
import { useRouter } from 'next/navigation';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebaseClient';

interface CentipedeGameProps {
  onGameUpdate?: (gameState: CentipedeGameState) => void;
}

const CentipedeGame: React.FC<CentipedeGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as CentipedeGameState;
  const currentPlayerId = currentUser?.uid;
  const isGameOver = gameState.isGameOver;
  const isInProgress = gameState.status === 'in_progress';
  const players = Object.values(currentSession.players || {});
  const playerIds = Object.keys(currentSession.players || {});
  
  // Add safety check for players
  if (!players || players.length < 2) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Waiting for all players to connect...</p>
        <p className="text-sm mt-2 text-gray-400">This game requires 2 players</p>
      </div>
    );
  }
  
  // Determine if it's the current player's turn
  const isMyTurn = currentPlayerId && gameState.currentTurnPlayerId === currentPlayerId;
  
  // Function to make a decision (continue or stop)
  const makeDecision = async (choice: Decision) => {
    if (!currentPlayerId || !isMyTurn || !isInProgress || isGameOver) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: 0,
        ready: false
      };
      
      // Create updated player data
      const updatedPlayerData: Record<string, CentipedePlayerData> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentDecision: choice,
          ready: true
        }
      };
      
      let updatedGameState: CentipedeGameState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Handle the decision
      if (choice === 'stop') {
        // Player decided to stop - game ends at current node
        await evaluateGameEnd(updatedGameState, currentPlayerId);
      } else {
        // Player decided to continue - move to next node
        const nextNode = gameState.currentNode + 1;
        
        // Check if we've reached the last node
        if (nextNode >= gameState.payoffSchedule.length) {
          // We've reached the final node, end the game automatically
          await evaluateGameEnd(updatedGameState, undefined); // undefined means it ended automatically at final node
        } else {
          // Change turn to the other player
          const otherPlayerId = getOpponent()?.id;
          
          if (!otherPlayerId) {
            throw new Error('Could not find opponent');
          }
          
          updatedGameState = {
            ...updatedGameState,
            currentNode: nextNode,
            currentTurnPlayerId: otherPlayerId
          };
          
          await updateGameState(updatedGameState);
        }
      }
      
      setDecision(choice);
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the game end and update scores
  const evaluateGameEnd = async (currentState: CentipedeGameState, stoppedById: string | undefined) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length !== 2) {
      console.error("Centipede Game requires exactly 2 players");
      return;
    }
    
    const player1 = playerIds[0];
    const player2 = playerIds[1];
    
    // Get payoffs for the current node
    const nodePayoffs = currentState.payoffSchedule[currentState.currentNode];
    
    if (!nodePayoffs) {
      console.error(`No payoffs defined for node ${currentState.currentNode}`);
      return;
    }
    
    // Get the payoffs based on the payoff schedule
    // In the Centipede Game, the payoffs at each node are fixed regardless of who's making the decision
    const score1 = nodePayoffs[0]; // Player 1's payoff
    const score2 = nodePayoffs[1]; // Player 2's payoff
    
    // Update scores and game state
    const roundResult = {
      round: currentState.round,
      nodeReached: currentState.currentNode,
      stoppedById: stoppedById,
      scores: {
        [player1]: score1,
        [player2]: score2
      }
    };
    
    // Update player data with new scores
    const updatedPlayerData = {
      [player1]: {
        totalScore: currentState.playerData[player1] ? 
                   (currentState.playerData[player1].totalScore || 0) + score1 : score1,
        currentDecision: null,
        ready: false
      },
      [player2]: {
        totalScore: currentState.playerData[player2] ? 
                   (currentState.playerData[player2].totalScore || 0) + score2 : score2,
        currentDecision: null,
        ready: false
      }
    };
    
    // Prepare updated game state
    const updatedGameState: CentipedeGameState = {
      ...currentState,
      status: 'completed',
      isGameOver: true,
      playerData: updatedPlayerData,
      history: Array.isArray(currentState.history) ? 
               [...currentState.history, roundResult] : [roundResult]
    };
    
    // For tournament mode, update the tournament results in the session
    if (currentSession.isTournament) {
      try {
        // Create updated tournament results
        const tournamentResults = currentSession.tournamentResults ? 
                                 { ...currentSession.tournamentResults } : {};
        
        // Update tournament stats for player 1
        if (!tournamentResults[player1]) {
          tournamentResults[player1] = {
            playerId: player1,
            totalScore: 0,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            cooperateCount: 0,
            defectCount: 0
          };
        }
        
        // Update tournament stats for player 2
        if (!tournamentResults[player2]) {
          tournamentResults[player2] = {
            playerId: player2,
            totalScore: 0,
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            cooperateCount: 0,
            defectCount: 0
          };
        }
        
        // Update players' tournament scores
        tournamentResults[player1].totalScore += score1;
        tournamentResults[player2].totalScore += score2;
        
        // For Centipede Game, track "continue" as cooperate and "stop" as defect for stats
        if (stoppedById) {
          if (stoppedById === player1) {
            tournamentResults[player1].defectCount += 1;
          } else if (stoppedById === player2) {
            tournamentResults[player2].defectCount += 1;
          }
        }
        
        // Increment matches played
        tournamentResults[player1].matchesPlayed += 1;
        tournamentResults[player2].matchesPlayed += 1;
        
        // Determine winner
        if (score1 > score2) {
          // Player 1 wins
          tournamentResults[player1].wins += 1;
          tournamentResults[player2].losses += 1;
        } else if (score1 < score2) {
          // Player 2 wins
          tournamentResults[player1].losses += 1;
          tournamentResults[player2].wins += 1;
        } else {
          // Draw
          tournamentResults[player1].draws += 1;
          tournamentResults[player2].draws += 1;
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
  
  // Get the opponent of the current player
  const getOpponent = (): Player | undefined => {
    if (!currentPlayerId || !players || players.length < 2) return undefined;
    return players.find(player => player.id !== currentPlayerId);
  };
  
  const opponent = getOpponent();
  
  // Render decision emoji
  const renderDecisionEmoji = (playerDecision: Decision | null | undefined) => {
    if (!playerDecision) return '❓';
    return playerDecision === 'continue' ? '➡️' : '🛑';
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
  
  // Function to determine whose turn it is
  const getActivePlayerName = () => {
    if (!gameState.currentTurnPlayerId) return 'Unknown';
    
    const activePlayer = players.find(player => player.id === gameState.currentTurnPlayerId);
    return activePlayer?.displayName || 'Unknown Player';
  };
  
  // Function to get the current payoff display
  const getCurrentPayoffs = () => {
    const payoffs = gameState.payoffSchedule[gameState.currentNode];
    if (!payoffs) return { player1: 0, player2: 0 };
    
    return {
      player1: payoffs[0],
      player2: payoffs[1]
    };
  };
  
  const currentPayoffs = getCurrentPayoffs();
  
  // Helper to determine which player is which
  const getPlayerIndex = (id: string) => {
    return playerIds.indexOf(id);
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
            : `Centipede Game - Node ${gameState.currentNode + 1}`}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {isGameOver 
            ? "Final results are in!" 
            : `It's ${getActivePlayerName()}'s turn to decide`}
        </p>
      </div>
      
      {/* Game Board - Visual representation of the centipede */}
      <div className="w-full mb-8 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex items-center">
            {gameState.payoffSchedule.map((_, index) => (
              <div 
                key={index} 
                className={`relative flex-1 h-12 flex items-center justify-center
                  ${index < gameState.currentNode ? 'bg-green-100 dark:bg-green-900' : 
                    index === gameState.currentNode ? 'bg-yellow-100 dark:bg-yellow-900' : 
                    'bg-gray-100 dark:bg-gray-800'}
                  ${index === 0 ? 'rounded-l-lg' : ''}
                  ${index === gameState.payoffSchedule.length - 1 ? 'rounded-r-lg' : ''}
                  border-r border-gray-300 dark:border-gray-600
                `}
              >
                {index === gameState.currentNode && (
                  <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                    <span className="text-xl">🚶</span>
                  </div>
                )}
                <span className="text-xs font-medium">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
          
          {/* Payoffs */}
          <div className="flex mt-2">
            {gameState.payoffSchedule.map((payoff, index) => (
              <div 
                key={index}
                className="flex-1 text-center text-xs"
              >
                <div>({payoff[0]}, {payoff[1]})</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Current Payoffs and Decision Buttons */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6 w-full max-w-md">
            <h4 className="font-medium mb-2 text-center">Current Node Payoffs</h4>
            <div className="flex justify-around">
              <div className="text-center">
                <p className="text-sm">Your Payoff</p>
                <p className="text-2xl font-bold">
                  {currentPlayerId && getPlayerIndex(currentPlayerId) === 0 
                    ? currentPayoffs.player1 
                    : currentPayoffs.player2}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm">Opponent's Payoff</p>
                <p className="text-2xl font-bold">
                  {currentPlayerId && getPlayerIndex(currentPlayerId) === 0 
                    ? currentPayoffs.player2 
                    : currentPayoffs.player1}
                </p>
              </div>
            </div>
          </div>
          
          {isMyTurn ? (
            <div className="grid grid-cols-2 gap-6 w-full max-w-md">
              <button
                onClick={() => makeDecision('continue')}
                disabled={loading || !isMyTurn}
                className={`p-6 rounded-lg border-2 transition-all
                  border-gray-300 hover:border-blue-500 dark:border-gray-600 dark:hover:border-blue-400
                  ${!isMyTurn || loading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="text-center">
                  <div className="text-5xl mb-4">➡️</div>
                  <h4 className="font-bold text-lg mb-1">Continue</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Pass to next player</p>
                </div>
              </button>
              
              <button
                onClick={() => makeDecision('stop')}
                disabled={loading || !isMyTurn}
                className={`p-6 rounded-lg border-2 transition-all
                  border-gray-300 hover:border-red-500 dark:border-gray-600 dark:hover:border-red-400
                  ${!isMyTurn || loading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="text-center">
                  <div className="text-5xl mb-4">🛑</div>
                  <h4 className="font-bold text-lg mb-1">Stop</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">End the game here</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
              <p className="text-lg mb-2">Waiting for {getActivePlayerName()} to make a decision...</p>
              <p className="text-sm text-gray-500">They will decide whether to continue or stop the game.</p>
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
                  <th className="py-2 text-left">Node Reached</th>
                  <th className="py-2 text-left">Stopped By</th>
                  <th className="py-2 text-right">Your Score</th>
                  <th className="py-2 text-right">Opponent Score</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  // Skip rendering if round data is incomplete
                  if (!round || !round.scores) {
                    return null;
                  }
                  
                  // Determine who stopped the game
                  const stoppedBy = round.stoppedById ? 
                    (round.stoppedById === currentPlayerId ? 'You' : opponent?.displayName || 'Opponent') : 
                    'Final Node';
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2">{round.nodeReached + 1}</td>
                      <td className="py-2">{stoppedBy}</td>
                      <td className="py-2 text-right">
                        {currentPlayerId && round.scores && round.scores[currentPlayerId]}
                      </td>
                      <td className="py-2 text-right">
                        {opponent && opponent.id && round.scores && round.scores[opponent.id]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {isGameOver && gameState.playerData && (
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={3} className="py-2 text-right">Final Score:</td>
                    <td className="py-2 text-right">
                      {currentPlayerId && gameState.playerData && 
                       gameState.playerData[currentPlayerId]?.totalScore}
                    </td>
                    <td className="py-2 text-right">
                      {opponent && opponent.id && gameState.playerData && 
                       gameState.playerData[opponent.id]?.totalScore}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          
          {/* Game Over summary */}
          {isGameOver && (
            <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
              <h2 className="text-2xl font-bold mb-4">Game Complete!</h2>
              <div className="flex justify-center items-center gap-8">
                <div className="flex flex-col items-center">
                  <p className="text-lg font-medium">Your Score</p>
                  <p className="text-4xl font-bold mt-2">
                    {currentPlayerId && gameState.playerData && 
                     gameState.playerData[currentPlayerId]?.totalScore}
                  </p>
                </div>
                <div className="text-2xl font-bold">vs</div>
                <div className="flex flex-col items-center">
                  <p className="text-lg font-medium">{opponent?.displayName || 'Opponent'}'s Score</p>
                  <p className="text-4xl font-bold mt-2">
                    {opponent && opponent.id && gameState.playerData && 
                     gameState.playerData[opponent.id]?.totalScore}
                  </p>
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

export default CentipedeGame; 