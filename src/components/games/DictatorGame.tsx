'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { DictatorGameState, PlayerRole, Allocation } from '@/games/dictatorGame';
import { useRouter } from 'next/navigation';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebaseClient';

interface DictatorGameProps {
  onGameUpdate?: (gameState: DictatorGameState) => void;
}

const DictatorGame: React.FC<DictatorGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allocationAmount, setAllocationAmount] = useState<number>(0); // Default to 0
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as DictatorGameState;
  const currentPlayerId = currentUser?.uid;
  const isGameOver = gameState.status === 'completed';
  const isInProgress = gameState.status === 'in_progress';
  const isSetup = gameState.status === 'setup';
  const isRoundZero = gameState.round === 0;
  const isHost = currentUser?.uid && currentSession.players[currentUser.uid]?.isHost;
  const needsInitialization = isSetup || isRoundZero || !gameState.playerData || Object.keys(gameState.playerData).length === 0;
  const players = Object.values(currentSession.players || {});
  
  // Get current player's role
  const currentPlayerRole: PlayerRole | undefined = 
    currentPlayerId && gameState.playerRoles 
      ? gameState.playerRoles[currentPlayerId] 
      : undefined;
  
  // Auto-start game when needed
  useEffect(() => {
    if (needsInitialization && isHost && !loading) {
      const autoStartGame = async () => {
        setLoading(true);
        setError(null);
        
        try {
          // Ensure we have exactly 2 players
          if (players.length !== 2) {
            throw new Error('Dictator Game requires exactly 2 players');
          }
          
          // Initialize player data
          const playerIds = players.map(p => p.id);
          const playerData: Record<string, any> = {};
          
          playerIds.forEach(id => {
            playerData[id] = {
              totalScore: 0,
              allocation: null,
              ready: false
            };
          });
          
          // Assign initial roles randomly
          const randomIndex = Math.floor(Math.random() * 2);
          const dictatorId = playerIds[randomIndex];
          const recipientId = playerIds[1 - randomIndex];
          
          const playerRoles: Record<string, PlayerRole> = {
            [dictatorId]: 'dictator',
            [recipientId]: 'recipient'
          };
          
          // Create initial game state
          const initialGameState: DictatorGameState = {
            ...gameState,
            round: 1,
            maxRounds: 6,
            status: 'in_progress',
            playerData,
            playerRoles,
            history: [],
            totalAmount: 100 // Default amount to divide
          };
          
          await updateGameState(initialGameState);
        } catch (err: any) {
          setError(err.message || 'Failed to initialize game');
        } finally {
          setLoading(false);
        }
      };
      
      autoStartGame();
    }
  }, [gameState, isHost, needsInitialization, loading, players, updateGameState]);
  
  // Get the opponent of the current player
  const getOpponent = (): Player | undefined => {
    if (!currentPlayerId || !players || players.length < 2) return undefined;
    return players.find(player => player.id !== currentPlayerId);
  };
  
  const opponent = getOpponent();
  
  // Function to make allocation (for dictator)
  const makeAllocation = async (amount: number) => {
    if (!currentPlayerId || !isInProgress || currentPlayerRole !== 'dictator') return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Calculate how much the dictator keeps
      const dictatorAmount = gameState.totalAmount - amount;
      
      // Create allocation object
      const allocation: Allocation = {
        dictatorId: currentPlayerId,
        recipientAmount: amount
      };
      
      // Get opponent ID (recipient)
      const recipientId = opponent?.id;
      if (!recipientId) {
        throw new Error('Recipient not found');
      }
      
      // Update player data
      const updatedPlayerData = { ...gameState.playerData };
      
      // Update dictator's data
      updatedPlayerData[currentPlayerId] = {
        ...updatedPlayerData[currentPlayerId],
        allocation: amount,
        ready: true
      };
      
      // Create the updated game state
      const updatedGameState: DictatorGameState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Evaluate the round immediately since the dictator's decision is final
      await evaluateRound(updatedGameState, allocation);
    } catch (err: any) {
      setError(err.message || 'Failed to submit allocation');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: DictatorGameState, allocation: Allocation) => {
    if (!allocation || !allocation.dictatorId) {
      console.error('Invalid allocation');
      return;
    }
    
    const dictatorId = allocation.dictatorId;
    const recipientId = currentState.playerRoles ? Object.keys(currentState.playerRoles).find(
      id => currentState.playerRoles[id] === 'recipient'
    ) : undefined;
    
    if (!recipientId) {
      console.error('Recipient not found');
      return;
    }
    
    // Calculate scores based on allocation
    const dictatorAmount = currentState.totalAmount - allocation.recipientAmount;
    const recipientAmount = allocation.recipientAmount;
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      allocation,
      scores: {
        [dictatorId]: dictatorAmount,
        [recipientId]: recipientAmount
      }
    };
    
    // Update player data with new scores
    const updatedPlayerData = {
      [dictatorId]: {
        totalScore: currentState.playerData[dictatorId].totalScore + dictatorAmount,
        allocation: null,
        ready: false
      },
      [recipientId]: {
        totalScore: currentState.playerData[recipientId].totalScore + recipientAmount,
        allocation: null,
        ready: false
      }
    };
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    
    // Switch roles for the next round
    let updatedPlayerRoles = { ...currentState.playerRoles };
    if (!isLastRound) {
      updatedPlayerRoles = {
        [dictatorId]: 'recipient',
        [recipientId]: 'dictator'
      };
    }
    
    const updatedGameState: DictatorGameState = {
      ...currentState,
      round: isLastRound ? currentState.round : currentState.round + 1,
      status: isLastRound ? 'completed' : 'in_progress',
      playerData: updatedPlayerData,
      playerRoles: updatedPlayerRoles,
      history: Array.isArray(currentState.history) ? [...currentState.history, roundResult] : [roundResult]
    };
    
    // For tournament mode, update the tournament results in the session
    if (currentSession.isTournament) {
      try {
        // Create updated tournament results
        const tournamentResults = currentSession.tournamentResults ? { ...currentSession.tournamentResults } : {};
        
        // Update tournament stats for dictator
        if (!tournamentResults[dictatorId]) {
          tournamentResults[dictatorId] = {
            playerId: dictatorId,
            totalScore: 0,
            matchesPlayed: 0,
            cooperateCount: 0,
            defectCount: 0,
            wins: 0,
            losses: 0,
            draws: 0
          };
        }
        
        // Update tournament stats for recipient
        if (!tournamentResults[recipientId]) {
          tournamentResults[recipientId] = {
            playerId: recipientId,
            totalScore: 0,
            matchesPlayed: 0,
            cooperateCount: 0,
            defectCount: 0,
            wins: 0,
            losses: 0,
            draws: 0
          };
        }
        
        // Update scores
        tournamentResults[dictatorId].totalScore += dictatorAmount;
        tournamentResults[recipientId].totalScore += recipientAmount;
        
        // If game is completed, update matches played and win/loss/draw counts
        if (isLastRound) {
          // Increment matches played
          tournamentResults[dictatorId].matchesPlayed += 1;
          tournamentResults[recipientId].matchesPlayed += 1;
          
          // Determine winner
          const totalScore1 = updatedPlayerData[dictatorId].totalScore;
          const totalScore2 = updatedPlayerData[recipientId].totalScore;
          
          if (totalScore1 > totalScore2) {
            tournamentResults[dictatorId].wins += 1;
            tournamentResults[recipientId].losses += 1;
          } else if (totalScore1 < totalScore2) {
            tournamentResults[dictatorId].losses += 1;
            tournamentResults[recipientId].wins += 1;
          } else {
            tournamentResults[dictatorId].draws += 1;
            tournamentResults[recipientId].draws += 1;
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
  
  // Render functions
  const renderDictatorInterface = () => {
    const maxAmount = gameState.totalAmount;
    const hasDecided = currentPlayerId && 
      gameState.playerData && 
      gameState.playerData[currentPlayerId] && 
      gameState.playerData[currentPlayerId].ready;
    
    return (
      <div className="flex flex-col items-center mt-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">You are the Dictator</h3>
        <p className="mb-4 text-center">
          Decide how to split {gameState.totalAmount} points between yourself and the other player. 
          The recipient must accept your decision.
        </p>
        
        {!hasDecided ? (
          <>
            <div className="w-full max-w-md mb-4">
              <label className="block text-sm font-medium mb-2">
                Amount to give to recipient: {allocationAmount} points
              </label>
              <input
                type="range"
                min="0"
                max={maxAmount}
                value={allocationAmount}
                onChange={(e) => setAllocationAmount(parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>0</span>
                <span>{maxAmount / 2}</span>
                <span>{maxAmount}</span>
              </div>
            </div>
            <div className="flex justify-between w-full max-w-md mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="text-center">
                <p className="text-sm text-gray-500">You will keep</p>
                <p className="text-2xl font-bold">{maxAmount - allocationAmount}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Recipient will get</p>
                <p className="text-2xl font-bold">{allocationAmount}</p>
              </div>
            </div>
            <button
              onClick={() => makeAllocation(allocationAmount)}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Confirm Allocation'}
            </button>
          </>
        ) : (
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg w-full max-w-md">
            <p className="mb-2">You have allocated {gameState.playerData && gameState.playerData[currentPlayerId] ? gameState.playerData[currentPlayerId].allocation : 0} points to the recipient.</p>
            <p className="text-sm text-gray-500">Waiting for the next round...</p>
          </div>
        )}
      </div>
    );
  };
  
  const renderRecipientInterface = () => {
    // Add null check for playerRoles
    const dictatorId = gameState.playerRoles ? Object.keys(gameState.playerRoles).find(
      id => gameState.playerRoles[id] === 'dictator'
    ) : undefined;
    const dictatorName = dictatorId && currentSession.players[dictatorId] 
      ? currentSession.players[dictatorId].displayName 
      : 'The Dictator';
    
    // Find the most recent allocation in history that affects this recipient
    const latestRound = gameState.history && gameState.history.length > 0 
      ? gameState.history[gameState.history.length - 1] 
      : null;
    
    const allocation = latestRound && latestRound.allocation;
    
    return (
      <div className="flex flex-col items-center mt-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">You are the Recipient</h3>
        
        {allocation ? (
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg w-full max-w-md">
            <p className="mb-2">{dictatorName} has allocated {allocation.recipientAmount} points to you.</p>
            <p className="mb-4">You must accept this allocation.</p>
            <p className="text-sm text-gray-500">Waiting for the next round...</p>
          </div>
        ) : (
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg w-full max-w-md">
            <p className="mb-2">Waiting for {dictatorName} to make an allocation...</p>
            <div className="mt-4 animate-pulse flex space-x-4 justify-center">
              <div className="rounded-full bg-gray-200 dark:bg-gray-600 h-3 w-3"></div>
              <div className="rounded-full bg-gray-200 dark:bg-gray-600 h-3 w-3"></div>
              <div className="rounded-full bg-gray-200 dark:bg-gray-600 h-3 w-3"></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGameHistory = () => {
    // Ensure history exists and has items
    if (!gameState.history || !Array.isArray(gameState.history) || gameState.history.length === 0) {
      return null;
    }

    return (
      <div className="mt-8">
        <h3 className="font-semibold text-lg mb-3">Game History</h3>
        
        <div className="overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 text-left">Round</th>
                <th className="py-2 text-left">Dictator</th>
                <th className="py-2 text-left">Allocation</th>
                <th className="py-2 text-right">Dictator Points</th>
                <th className="py-2 text-right">Recipient Points</th>
              </tr>
            </thead>
            <tbody>
              {gameState.history.map((round, index) => {
                // Skip rendering if round data is incomplete
                if (!round || !round.allocation || !round.scores) {
                  return null;
                }
                
                const dictatorId = round.allocation.dictatorId;
                const recipientId = gameState.playerRoles ? Object.keys(gameState.playerRoles).find(
                  id => id !== dictatorId
                ) : undefined;
                
                if (!dictatorId || !recipientId) return null;
                
                const dictatorName = currentSession.players[dictatorId]?.displayName || 'Dictator';
                const recipientName = currentSession.players[recipientId]?.displayName || 'Recipient';
                
                return (
                  <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-2">{round.round}</td>
                    <td className="py-2">{dictatorName}</td>
                    <td className="py-2">
                      {round.allocation.recipientAmount} to recipient
                    </td>
                    <td className="py-2 text-right">
                      {round.scores[dictatorId]}
                    </td>
                    <td className="py-2 text-right">
                      {round.scores[recipientId]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {isGameOver && gameState.playerData && (
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={3} className="py-2 text-right">Final Score:</td>
                  {players.map(player => (
                    <td key={player.id} className="py-2 text-right">
                      {gameState.playerData[player.id]?.totalScore || 0}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };
  
  // Render game over summary
  const renderGameOver = () => {
    if (!isGameOver) return null;
    
    const playerScores = players.map(player => ({
      id: player.id,
      name: player.displayName,
      score: gameState.playerData[player.id]?.totalScore || 0
    }));
    
    // Sort by score (highest first)
    playerScores.sort((a, b) => b.score - a.score);
    
    return (
      <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">Game Complete!</h2>
        
        <div className="flex justify-center items-center gap-8 mb-6">
          {playerScores.map((player, index) => (
            <div key={player.id} className="flex flex-col items-center">
              <p className="text-lg font-medium">{player.name}</p>
              <p className="text-4xl font-bold mt-2">{player.score}</p>
              {index === 0 && playerScores.length > 1 && playerScores[0].score > playerScores[1].score && (
                <span className="mt-2 text-2xl">👑</span>
              )}
            </div>
          ))}
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
    );
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
            : currentPlayerRole === 'dictator'
              ? "You are the Dictator for this round" 
              : "You are the Recipient for this round"}
        </p>
      </div>
      
      {/* Game Board */}
      {isInProgress && !isGameOver && (
        <>
          {currentPlayerRole === 'dictator' ? renderDictatorInterface() : renderRecipientInterface()}
        </>
      )}
      
      {/* Game History */}
      {renderGameHistory()}
      
      {/* Game Over Summary */}
      {renderGameOver()}
    </div>
  );
};

export default DictatorGame; 