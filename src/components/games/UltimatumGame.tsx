'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { UltimatumGameState, Proposal, Response, PlayerRole } from '@/games/ultimatumGame';
import { useRouter } from 'next/navigation';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebaseClient';

interface UltimatumGameProps {
  onGameUpdate?: (gameState: UltimatumGameState) => void;
}

const UltimatumGame: React.FC<UltimatumGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposalAmount, setProposalAmount] = useState<number>(50); // Default to 50% split
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as UltimatumGameState;
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
        try {
          // Initialize player data
          const initialPlayerData: Record<string, any> = {};
          const playerIds = Object.keys(currentSession.players);
          
          // Randomly assign initial roles
          const initialRoles: Record<string, PlayerRole> = {};
          const proposerIndex = Math.floor(Math.random() * playerIds.length);
          
          // Create player data and assign roles for each player
          playerIds.forEach((playerId, index) => {
            initialPlayerData[playerId] = {
              totalScore: 0,
              proposal: null,
              response: null,
              ready: false
            };
            
            initialRoles[playerId] = index === proposerIndex ? 'proposer' : 'responder';
          });
          
          // Update game state to in_progress
          const updatedGameState: UltimatumGameState = {
            ...gameState,
            status: 'in_progress',
            round: 1,
            playerData: initialPlayerData,
            playerRoles: initialRoles,
            currentStage: 'proposal',
            history: []
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
          <span className="text-5xl">💰 💼</span>
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
        <p className="text-sm mt-2 text-gray-400">This game requires 2 players</p>
      </div>
    );
  }
  
  // Get the opponent of the current player
  const getOpponent = (): Player | undefined => {
    if (!currentPlayerId || !players || players.length < 2) return undefined;
    return players.find(player => player.id !== currentPlayerId);
  };
  
  const opponent = getOpponent();
  
  // Check if the current player has made their move in the current stage
  const hasActed = currentPlayerId && gameState.playerData && 
    ((currentPlayerRole === 'proposer' && gameState.currentStage === 'proposal' && gameState.playerData[currentPlayerId]?.proposal !== null && gameState.playerData[currentPlayerId]?.proposal !== undefined) ||
     (currentPlayerRole === 'responder' && gameState.currentStage === 'response' && gameState.playerData[currentPlayerId]?.response !== null && gameState.playerData[currentPlayerId]?.response !== undefined));
  
  // Function to handle proposal submission
  const makeProposal = async (amount: number) => {
    if (!currentPlayerId || hasActed || !isInProgress || currentPlayerRole !== 'proposer' || gameState.currentStage !== 'proposal') return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Create the proposal
      const proposal: Proposal = {
        proposerId: currentPlayerId,
        amount: amount
      };
      
      // Update player data to mark the proposer as ready
      const updatedPlayerData = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...gameState.playerData[currentPlayerId],
          proposal: amount,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: UltimatumGameState = {
        ...gameState,
        playerData: updatedPlayerData,
        currentStage: 'response',
        history: gameState.history && gameState.history.length > 0
          ? [...gameState.history.slice(0, -1), {
              ...gameState.history[gameState.history.length - 1],
              proposal
            }]
          : [{
              round: gameState.round,
              proposal,
              scores: {}
            }]
      };
      
      await updateGameState(updatedGameState);
    } catch (err: any) {
      setError(err.message || 'Failed to submit proposal');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle response (accept/reject)
  const respondToProposal = async (response: Response) => {
    if (!currentPlayerId || hasActed || !isInProgress || currentPlayerRole !== 'responder' || gameState.currentStage !== 'response') return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure we have the current proposal
      if (!gameState.history || gameState.history.length === 0) {
        throw new Error('No game history found');
      }
      
      const currentHistory = gameState.history[gameState.history.length - 1];
      const proposerId = currentHistory.proposal?.proposerId;
      
      if (!proposerId || !currentHistory.proposal) {
        throw new Error('No proposal found to respond to');
      }
      
      // Calculate scores based on the response
      const proposerAmount = response === 'accept' 
        ? gameState.totalAmount - currentHistory.proposal.amount
        : 0;
      
      const responderAmount = response === 'accept'
        ? currentHistory.proposal.amount
        : 0;
      
      const updatedScores = {
        [proposerId]: proposerAmount,
        [currentPlayerId]: responderAmount
      };
      
      // Update player data
      const updatedPlayerData = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...gameState.playerData[currentPlayerId],
          response,
          ready: true
        },
        [proposerId]: {
          ...gameState.playerData[proposerId],
          totalScore: gameState.playerData[proposerId].totalScore + proposerAmount
        }
      };
      
      // Update current player's score as well
      updatedPlayerData[currentPlayerId].totalScore += responderAmount;
      
      // Prepare for the next round by swapping roles
      const nextRound = gameState.round >= gameState.maxRounds;
      const updatedRoles = { ...gameState.playerRoles };
      
      if (!nextRound) {
        // Swap roles for the next round
        Object.keys(updatedRoles).forEach(playerId => {
          updatedRoles[playerId] = updatedRoles[playerId] === 'proposer' ? 'responder' : 'proposer';
        });
      }
      
      // Update the game state
      const updatedGameState: UltimatumGameState = {
        ...gameState,
        round: nextRound ? gameState.round : gameState.round + 1,
        status: nextRound ? 'completed' : 'in_progress',
        playerData: updatedPlayerData,
        playerRoles: updatedRoles,
        currentStage: 'results',
        history: [
          ...(gameState.history ? gameState.history.slice(0, -1) : []),
          {
            ...currentHistory,
            response,
            scores: updatedScores
          }
        ]
      };
      
      // For tournament mode, update the tournament results in the session
      if (currentSession.isTournament && nextRound) {
        try {
          await updateTournamentResults(updatedPlayerData, proposerId, currentPlayerId);
        } catch (error) {
          console.error('Error updating tournament results:', error);
        }
      }
      
      await updateGameState(updatedGameState);
      
      // If not the last round, automatically progress to the next round after a delay
      if (!nextRound) {
        setTimeout(async () => {
          const resetPlayerData = { ...updatedPlayerData };
          
          // Reset player actions for the next round
          Object.keys(resetPlayerData).forEach(playerId => {
            resetPlayerData[playerId] = {
              ...resetPlayerData[playerId],
              proposal: null,
              response: null,
              ready: false
            };
          });
          
          const nextRoundState: UltimatumGameState = {
            ...updatedGameState,
            playerData: resetPlayerData,
            currentStage: 'proposal'
          };
          
          await updateGameState(nextRoundState);
        }, 3000); // Show results for 3 seconds before moving to next round
      }
      
      // Call the callback if provided
      if (onGameUpdate) {
        onGameUpdate(updatedGameState);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit response');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to update tournament results
  const updateTournamentResults = async (
    playerData: Record<string, any>,
    proposerId: string,
    responderId: string
  ) => {
    // Create updated tournament results
    const tournamentResults = currentSession.tournamentResults ? { ...currentSession.tournamentResults } : {};
    
    // Initialize player entries if they don't exist
    [proposerId, responderId].forEach(playerId => {
      if (!tournamentResults[playerId]) {
        tournamentResults[playerId] = {
          playerId,
          totalScore: 0,
          matchesPlayed: 0,
          cooperateCount: 0, // For Ultimatum, making a fair offer (>30) or accepting counts as cooperation
          defectCount: 0,    // Making an unfair offer (<30) or rejecting counts as defection
          wins: 0,
          losses: 0,
          draws: 0
        };
      }
    });
    
    // Update scores
    tournamentResults[proposerId].totalScore += playerData[proposerId].totalScore;
    tournamentResults[responderId].totalScore += playerData[responderId].totalScore;
    
    // Increment matches played
    tournamentResults[proposerId].matchesPlayed += 1;
    tournamentResults[responderId].matchesPlayed += 1;
    
    // Determine the winner
    const proposerTotalScore = playerData[proposerId].totalScore;
    const responderTotalScore = playerData[responderId].totalScore;
    
    if (proposerTotalScore > responderTotalScore) {
      tournamentResults[proposerId].wins += 1;
      tournamentResults[responderId].losses += 1;
    } else if (proposerTotalScore < responderTotalScore) {
      tournamentResults[proposerId].losses += 1;
      tournamentResults[responderId].wins += 1;
    } else {
      tournamentResults[proposerId].draws += 1;
      tournamentResults[responderId].draws += 1;
    }
    
    // Update the tournament results in the database
    const sessionRef = ref(database, `sessions/${currentSession.id}`);
    await update(sessionRef, { tournamentResults });
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
  
  // Function to start the next round
  const startNextRound = async () => {
    if (!isInProgress || gameState.currentStage !== 'results') return;
    
    setLoading(true);
    
    try {
      const updatedPlayerData = { ...gameState.playerData };
      
      // Reset player actions for the next round
      Object.keys(updatedPlayerData).forEach(playerId => {
        updatedPlayerData[playerId] = {
          ...updatedPlayerData[playerId],
          proposal: null,
          response: null,
          ready: false
        };
      });
      
      const updatedGameState: UltimatumGameState = {
        ...gameState,
        playerData: updatedPlayerData,
        currentStage: 'proposal'
      };
      
      await updateGameState(updatedGameState);
    } catch (err: any) {
      setError(err.message || 'Failed to start next round');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to render the current game stage
  const renderGameStage = () => {
    if (!currentPlayerRole || !isInProgress || isGameOver) return null;
    
    // Get the current history entry with safety check for undefined history
    const currentHistoryEntry = gameState.history && gameState.history.length > 0
      ? gameState.history[gameState.history.length - 1]
      : undefined;
    
    // Stage: Proposal (Proposer makes an offer)
    if (gameState.currentStage === 'proposal') {
      if (currentPlayerRole === 'proposer') {
        return (
          <div className="flex flex-col items-center mb-8">
            <h3 className="text-lg font-semibold mb-4">Make Your Offer</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              How much of the {gameState.totalAmount} points will you offer to your opponent?
            </p>
            
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between mb-2">
                <span>You get: {gameState.totalAmount - proposalAmount}</span>
                <span>They get: {proposalAmount}</span>
              </div>
              
              <input
                type="range"
                min="0"
                max={gameState.totalAmount}
                value={proposalAmount}
                onChange={(e) => setProposalAmount(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              
              <div className="flex items-center justify-between mt-1 text-sm text-gray-500">
                <span>0</span>
                <span>{gameState.totalAmount / 2}</span>
                <span>{gameState.totalAmount}</span>
              </div>
              
              <button
                onClick={() => makeProposal(proposalAmount)}
                disabled={loading || hasActed}
                className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : hasActed ? 'Offer Sent' : 'Submit Offer'}
              </button>
            </div>
          </div>
        );
      } else {
        // Responder waiting for proposer
        return (
          <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="animate-pulse mb-4">
              <span className="text-4xl">⏳</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Waiting for Offer</h3>
            <p className="text-gray-600 dark:text-gray-300">
              The other player is deciding how to split the {gameState.totalAmount} points.
            </p>
          </div>
        );
      }
    }
    
    // Stage: Response (Responder accepts or rejects the offer)
    if (gameState.currentStage === 'response') {
      if (currentPlayerRole === 'responder' && currentHistoryEntry && currentHistoryEntry.proposal) {
        const proposedAmount = currentHistoryEntry.proposal.amount;
        const proposerKeeps = gameState.totalAmount - proposedAmount;
        
        return (
          <div className="flex flex-col items-center mb-8">
            <h3 className="text-lg font-semibold mb-4">Respond to the Offer</h3>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mb-6 w-full max-w-md">
              <p className="text-center mb-4">
                Your opponent has offered you <span className="font-bold text-xl">{proposedAmount}</span> out of {gameState.totalAmount} points
              </p>
              
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Your Opponent Gets</p>
                  <p className="text-xl font-bold">{proposerKeeps}</p>
                </div>
                <div className="flex-1 px-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${(proposerKeeps / gameState.totalAmount) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2">
                <div className="text-center">
                  <p className="text-sm text-gray-500">You Get</p>
                  <p className="text-xl font-bold">{proposedAmount}</p>
                </div>
                <div className="flex-1 px-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500" 
                      style={{ width: `${(proposedAmount / gameState.totalAmount) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 w-full max-w-md">
              <button
                onClick={() => respondToProposal('accept')}
                disabled={loading || hasActed}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept
              </button>
              
              <button
                onClick={() => respondToProposal('reject')}
                disabled={loading || hasActed}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
            </div>
            
            {hasActed && (
              <p className="mt-4 text-gray-600 dark:text-gray-300">
                Your response has been recorded. Waiting for the next round...
              </p>
            )}
          </div>
        );
      } else {
        // Proposer waiting for responder
        return (
          <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="animate-pulse mb-4">
              <span className="text-4xl">⌛</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Waiting for Response</h3>
            <p className="text-gray-600 dark:text-gray-300">
              The other player is deciding whether to accept or reject your offer.
            </p>
            {currentHistoryEntry && currentHistoryEntry.proposal && (
              <div className="mt-4">
                <p className="font-medium">Your Offer:</p>
                <p className="text-lg">
                  You: {gameState.totalAmount - currentHistoryEntry.proposal.amount} points | 
                  Them: {currentHistoryEntry.proposal.amount} points
                </p>
              </div>
            )}
          </div>
        );
      }
    }
    
    // Stage: Results (Show outcome of the round)
    if (gameState.currentStage === 'results') {
      if (currentHistoryEntry && currentHistoryEntry.proposal && currentHistoryEntry.response !== undefined) {
        const proposedAmount = currentHistoryEntry.proposal.amount;
        const proposerKeeps = gameState.totalAmount - proposedAmount;
        const wasAccepted = currentHistoryEntry.response === 'accept';
        
        return (
          <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg mb-8">
            <h3 className="text-xl font-semibold mb-4">Round {gameState.round} Results</h3>
            
            <div className="mb-6">
              <p className="text-lg mb-2">
                The offer was <span className={`font-bold ${wasAccepted ? 'text-green-600' : 'text-red-600'}`}>
                  {wasAccepted ? 'ACCEPTED' : 'REJECTED'}
                </span>
              </p>
              
              <div className="flex justify-between items-center mt-4 p-4 bg-white dark:bg-gray-700 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Proposer</p>
                  <p className="font-bold">
                    {wasAccepted ? proposerKeeps : 0} points
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Responder</p>
                  <p className="font-bold">
                    {wasAccepted ? proposedAmount : 0} points
                  </p>
                </div>
              </div>
            </div>
            
            {gameState.round < gameState.maxRounds && (
              <div className="mt-6">
                <p className="mb-2 text-gray-600 dark:text-gray-300">
                  For the next round, roles will be switched.
                </p>
                
                {isHost && (
                  <button
                    onClick={startNextRound}
                    className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded-lg font-medium"
                  >
                    Start Next Round
                  </button>
                )}
              </div>
            )}
          </div>
        );
      }
    }
    
    return null;
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
            : currentPlayerRole 
              ? `You are the ${currentPlayerRole} this round` 
              : "Waiting..."}
        </p>
      </div>
      
      {/* Game Board */}
      {isInProgress && !isGameOver && renderGameStage()}
      
      {/* Game History */}
      {gameState.history && gameState.history.length > 0 && (
        <div className="mt-auto mb-8">
          <h3 className="font-semibold text-lg mb-3">Game History</h3>
          
          <div className="overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left">Round</th>
                  <th className="py-2 text-left">Proposer</th>
                  <th className="py-2 text-left">Offer</th>
                  <th className="py-2 text-left">Response</th>
                  <th className="py-2 text-right">Proposer Points</th>
                  <th className="py-2 text-right">Responder Points</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  // Skip rendering if round data is incomplete
                  if (!round || !round.proposal) {
                    return null;
                  }
                  
                  const proposerId = round.proposal.proposerId;
                  const responderId = Object.keys(gameState.playerRoles).find(
                    id => id !== proposerId
                  );
                  
                  if (!responderId) return null;
                  
                  const proposerName = currentSession.players[proposerId]?.displayName || 'Unknown';
                  const responderName = currentSession.players[responderId]?.displayName || 'Unknown';
                  const wasAccepted = round.response === 'accept';
                  const proposerScore = round.scores ? round.scores[proposerId] || 0 : 0;
                  const responderScore = round.scores ? round.scores[responderId] || 0 : 0;
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2">{proposerName}</td>
                      <td className="py-2">{round.proposal.amount} / {gameState.totalAmount - round.proposal.amount}</td>
                      <td className="py-2">
                        {round.response 
                          ? round.response === 'accept' 
                            ? '✅ Accepted' 
                            : '❌ Rejected' 
                          : '⏳ Waiting...'}
                      </td>
                      <td className="py-2 text-right">{proposerScore}</td>
                      <td className="py-2 text-right">{responderScore}</td>
                    </tr>
                  );
                })}
              </tbody>
              {isGameOver && gameState.playerData && (
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={4} className="py-2 text-right">Final Score:</td>
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
      )}
      
      {/* Final Scores */}
      {isGameOver && (
        <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-6 rounded-lg mb-8">
          <h3 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-100">Final Scores</h3>
          <div className="grid grid-cols-2 gap-4">
            {players.map(player => {
              const playerData = gameState.playerData[player.id];
              if (!playerData) return null;
              
              const isCurrentPlayer = player.id === currentPlayerId;
              const isWinner = Object.values(gameState.playerData).every(
                p => p.totalScore <= playerData.totalScore
              );
              
              return (
                <div 
                  key={player.id} 
                  className={`p-4 rounded-lg ${
                    isWinner 
                      ? 'bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 border border-yellow-300 dark:border-yellow-600' 
                      : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="font-bold text-lg mb-1 flex items-center">
                    {player.displayName}
                    {isCurrentPlayer && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                    {isWinner && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                        Winner
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
      
      {/* Return to Dashboard Button */}
      {isGameOver && (
        <div className="text-center">
          <button
            onClick={handleExitGame}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default UltimatumGame; 