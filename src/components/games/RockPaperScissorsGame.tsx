'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { RockPaperScissorsState, RockPaperScissorsPlayerData, Move, Result, SCORING } from '@/games/rockPaperScissors';
import { useRouter } from 'next/navigation';
import { database } from '@/config/firebaseClient';
import { ref, update } from 'firebase/database';

interface RockPaperScissorsGameProps {
  onGameUpdate?: (gameState: RockPaperScissorsState) => void;
}

const RockPaperScissorsGame: React.FC<RockPaperScissorsGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as RockPaperScissorsState;
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
          const initialPlayerData: Record<string, RockPaperScissorsPlayerData> = {};
          
          // Create player data for each player
          Object.keys(currentSession.players).forEach(playerId => {
            initialPlayerData[playerId] = {
              totalScore: 0,
              currentMove: "", // Explicitly set to empty string to ensure it's saved in Firebase
              ready: false
            };
          });
          
          console.log("Initializing player data with explicit currentMove:", initialPlayerData);
          
          // Update game state to in_progress
          const updatedGameState: RockPaperScissorsState = {
            ...gameState,
            status: 'in_progress',
            round: 1, // Start at round 1 instead of 0
            playerData: initialPlayerData,
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
  
  // Add effect to initialize move from game state when component mounts
  useEffect(() => {
    if (currentPlayerId && 
        gameState?.playerData && 
        gameState.playerData[currentPlayerId] && 
        gameState.playerData[currentPlayerId].currentMove) {
      const currentMove = gameState.playerData[currentPlayerId].currentMove;
      console.log(`Initializing move from game state: ${currentMove}`);
      setMove(currentMove);
    }
  }, [gameState?.playerData, currentPlayerId]);
  
  // Add an effect to reset the move state when the round changes
  useEffect(() => {
    // Reset move at the start of each round
    if (isInProgress && !isGameOver) {
      console.log(`Round ${gameState.round} started, resetting move state`);
      setMove(null);
    }
  }, [gameState.round, isInProgress, isGameOver]);
  
  // If game is loading or needs initialization, show a simple loading UI
  if (loading || needsInitialization) {
    return (
      <div className="flex flex-col items-center text-center p-6">
        <div className="animate-pulse mb-4">
          <span className="text-5xl">✊ ✋ ✌️</span>
        </div>
        <h3 className="text-xl font-semibold mb-4">Loading Game...</h3>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
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
  
  // Improved check to determine if player has moved
  const checkHasMoved = (): boolean => {
    // Check local state first (faster response)
    if (move === 'rock' || move === 'paper' || move === 'scissors') {
      return true;
    }
    
    // Then check Firebase state
    if (currentPlayerId && 
        gameState.playerData && 
        gameState.playerData[currentPlayerId]) {
      
      const firebaseMove = gameState.playerData[currentPlayerId].currentMove;
      
      // Check if the move is a valid move (not null, undefined, or empty string)
      return firebaseMove === 'rock' || firebaseMove === 'paper' || firebaseMove === 'scissors';
    }
    
    return false;
  };

  // Use the enhanced check
  const hasMoved = checkHasMoved();
  
  // Function to render the emoji for a move
  const renderMoveEmoji = (playerMove: Move | null | undefined) => {
    if (playerMove === 'rock') return '✊';
    if (playerMove === 'paper') return '✋';
    if (playerMove === 'scissors') return '✌️';
    return '❓';
  };
  
  // Helper function to get the move display text
  const getMoveDisplayText = (selectedMove: Move | null | undefined) => {
    if (selectedMove === 'rock') return '✊ Rock';
    if (selectedMove === 'paper') return '✋ Paper';
    if (selectedMove === 'scissors') return '✌️ Scissors';
    return '❓ Unknown';
  };
  
  // Function to get the most reliable move value to display
  const getDisplayMove = (): Move | null => {
    // Log both states for debugging
    const localMove = move;
    const firebaseMove = currentPlayerId && 
                        gameState.playerData && 
                        gameState.playerData[currentPlayerId] ? 
                        gameState.playerData[currentPlayerId].currentMove : null;
    
    console.log(`getDisplayMove - Local: ${localMove}, Firebase: ${firebaseMove}`);
    
    // First, check if we have a valid local move
    if (localMove === 'rock' || localMove === 'paper' || localMove === 'scissors') {
      console.log(`Using local move state: ${localMove}`);
      return localMove;
    }
    
    // Then check Firebase state
    if (firebaseMove === 'rock' || firebaseMove === 'paper' || firebaseMove === 'scissors') {
      console.log(`Using Firebase move state: ${firebaseMove}`);
      return firebaseMove;
    }
    
    // If firebaseMove is empty string, it means no selection yet
    if (firebaseMove === "") {
      console.log("Firebase move is empty string (no selection yet)");
    }
    
    console.log('No valid move found in either local or Firebase state');
    return null;
  };
  
  // Function to make a move
  const makeMove = async (selectedMove: Move) => {
    if (!currentPlayerId || !isInProgress) {
      console.log("Cannot make move: player ID missing or game not in progress");
      return;
    }
    
    // Check if player has already moved in this round
    if (hasMoved) {
      console.log("Player has already moved this round");
      return;
    }
    
    // Immediately update the local state for UI response
    setMove(selectedMove);
    console.log("Setting move:", selectedMove);
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: 0,
        ready: false
      };
      
      // Create updated player data with current move
      const updatedPlayerData = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentMove: selectedMove, // Set the move on the player data
          ready: true
        }
      };
      
      console.log("Player data with move:", updatedPlayerData[currentPlayerId]);
      
      // Update the game state
      const updatedGameState: RockPaperScissorsState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have made choices
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          const playerData = updatedPlayerData[playerId];
          // Check both ready flag and existence of a valid move
          return playerData && playerData.ready && 
                (playerData.currentMove === 'rock' || 
                 playerData.currentMove === 'paper' || 
                 playerData.currentMove === 'scissors');
        }
      );
      
      // If all players have made moves, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
    } catch (err: any) {
      console.error("Error making move:", err);
      setError(err.message || 'Failed to submit move');
      // Reset move in case of error
      setMove(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: RockPaperScissorsState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length !== 2) {
      console.error("Rock-Paper-Scissors requires exactly 2 players");
      return;
    }
    
    const player1 = playerIds[0];
    const player2 = playerIds[1];
    const move1 = currentState.playerData[player1].currentMove;
    const move2 = currentState.playerData[player2].currentMove;
    
    // Calculate results based on moves
    let result1: Result = 'draw';
    let result2: Result = 'draw';
    let score1 = SCORING.DRAW;
    let score2 = SCORING.DRAW;
    
    // Add safety check to make sure moves are defined
    if (move1 && move2) {
      if (move1 === move2) {
        // Draw
        result1 = 'draw';
        result2 = 'draw';
        score1 = SCORING.DRAW;
        score2 = SCORING.DRAW;
      } else if (
        (move1 === 'rock' && move2 === 'scissors') ||
        (move1 === 'paper' && move2 === 'rock') ||
        (move1 === 'scissors' && move2 === 'paper')
      ) {
        // Player 1 wins
        result1 = 'win';
        result2 = 'lose';
        score1 = SCORING.WIN;
        score2 = SCORING.LOSE;
      } else {
        // Player 2 wins
        result1 = 'lose';
        result2 = 'win';
        score1 = SCORING.LOSE;
        score2 = SCORING.WIN;
      }
    } else {
      console.error('Cannot evaluate round: one or both players have not made a move');
      return; // Cannot proceed without moves
    }
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      moves: {
        [player1]: move1,
        [player2]: move2
      },
      results: {
        [player1]: result1,
        [player2]: result2
      },
      scores: {
        [player1]: score1,
        [player2]: score2
      }
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData = {
      [player1]: {
        totalScore: currentState.playerData[player1].totalScore + score1,
        currentMove: "", // Using empty string instead of null to ensure it's preserved in Firebase
        ready: false
      },
      [player2]: {
        totalScore: currentState.playerData[player2].totalScore + score2,
        currentMove: "", // Using empty string instead of null to ensure it's preserved in Firebase
        ready: false
      }
    };
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: RockPaperScissorsState = {
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
        
        // Update tournament stats for player 1
        if (!tournamentResults[player1]) {
          tournamentResults[player1] = {
            playerId: player1,
            totalScore: 0,
            matchesPlayed: 0,
            cooperateCount: 0,
            defectCount: 0,
            wins: 0,
            losses: 0,
            draws: 0
          };
        }
        
        // Update tournament stats for player 2
        if (!tournamentResults[player2]) {
          tournamentResults[player2] = {
            playerId: player2,
            totalScore: 0,
            matchesPlayed: 0,
            cooperateCount: 0,
            defectCount: 0,
            wins: 0,
            losses: 0,
            draws: 0
          };
        }
        
        // Update player 1's tournament stats
        tournamentResults[player1].totalScore += score1;
        
        // Update player 2's tournament stats
        tournamentResults[player2].totalScore += score2;
        
        // If game is completed, update matches played and win/loss/draw counts
        if (isLastRound) {
          // Increment matches played
          tournamentResults[player1].matchesPlayed += 1;
          tournamentResults[player2].matchesPlayed += 1;
          
          // Determine winner based on total score
          const totalScore1 = updatedPlayerData[player1].totalScore;
          const totalScore2 = updatedPlayerData[player2].totalScore;
          
          if (totalScore1 > totalScore2) {
            // Player 1 wins
            tournamentResults[player1].wins += 1;
            tournamentResults[player2].losses += 1;
          } else if (totalScore1 < totalScore2) {
            // Player 2 wins
            tournamentResults[player1].losses += 1;
            tournamentResults[player2].wins += 1;
          } else {
            // Draw
            tournamentResults[player1].draws += 1;
            tournamentResults[player2].draws += 1;
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
  
  // Get the opponent of the current player
  const getOpponent = (): Player | undefined => {
    if (!currentPlayerId || !players || players.length < 2) return undefined;
    return players.find(player => player.id !== currentPlayerId);
  };
  
  const opponent = getOpponent();
  
  // Function to get result text
  const getResultText = (result: Result) => {
    if (result === 'win') return 'Win';
    if (result === 'lose') return 'Loss';
    return 'Draw';
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
            : hasMoved 
              ? "Waiting for your opponent..." 
              : "Make your move"}
        </p>
      </div>
      
      {/* Current Round Overview (if game has history) */}
      {gameState.history && gameState.history.length > 0 && !isGameOver && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Last Round</h3>
          <div className="grid grid-cols-2 gap-4">
            {players.map(player => {
              const isCurrentPlayer = player.id === currentPlayerId;
              const lastRound = gameState.history[gameState.history.length - 1];
              const playerMove = lastRound.moves[player.id];
              const playerResult = lastRound.results[player.id];
              const playerScore = lastRound.scores[player.id];
              const totalScore = gameState.playerData[player.id]?.totalScore || 0;
              
              return (
                <div key={player.id} className={`rounded-lg p-3 ${isCurrentPlayer ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{player.displayName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
                      {isCurrentPlayer ? 'You' : 'Opponent'}
                    </span>
                  </div>
                  <div className="flex items-center mb-1">
                    <span className="text-2xl mr-2">{renderMoveEmoji(playerMove)}</span>
                    <span className={`font-medium ${
                      playerResult === 'win' ? 'text-green-600 dark:text-green-400' : 
                      playerResult === 'lose' ? 'text-red-600 dark:text-red-400' : 
                      'text-gray-600 dark:text-gray-400'
                    }`}>
                      {getResultText(playerResult)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>This round: {playerScore > 0 ? '+' : ''}{playerScore} pts</span>
                    <span className="font-bold">Total: {totalScore} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Game Board - Move Buttons */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="grid grid-cols-3 gap-4 w-full max-w-md">
            <button
              onClick={() => {
                console.log("Rock button clicked, hasMoved:", hasMoved, "move:", move);
                if (!hasMoved && isInProgress) makeMove('rock');
              }}
              disabled={loading || hasMoved}
              className={`p-6 rounded-lg border-2 transition-all ${
                move === 'rock'
                  ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-400'
                  : 'border-gray-300 hover:border-blue-500 dark:border-gray-600 dark:hover:border-blue-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">✊</span>
                <h4 className="font-bold">Rock</h4>
              </div>
            </button>
            
            <button
              onClick={() => {
                console.log("Paper button clicked, hasMoved:", hasMoved, "move:", move);
                if (!hasMoved && isInProgress) makeMove('paper');
              }}
              disabled={loading || hasMoved}
              className={`p-6 rounded-lg border-2 transition-all ${
                move === 'paper'
                  ? 'bg-green-100 border-green-500 dark:bg-green-900 dark:border-green-400'
                  : 'border-gray-300 hover:border-green-500 dark:border-gray-600 dark:hover:border-green-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">✋</span>
                <h4 className="font-bold">Paper</h4>
              </div>
            </button>
            
            <button
              onClick={() => {
                console.log("Scissors button clicked, hasMoved:", hasMoved, "move:", move);
                if (!hasMoved && isInProgress) makeMove('scissors');
              }}
              disabled={loading || hasMoved}
              className={`p-6 rounded-lg border-2 transition-all ${
                move === 'scissors'
                  ? 'bg-purple-100 border-purple-500 dark:bg-purple-900 dark:border-purple-400'
                  : 'border-gray-300 hover:border-purple-500 dark:border-gray-600 dark:hover:border-purple-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">✌️</span>
                <h4 className="font-bold">Scissors</h4>
              </div>
            </button>
          </div>
          
          {hasMoved && (
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              You chose <span className="font-medium">
                {getMoveDisplayText(getDisplayMove())}
              </span>. Waiting for your opponent...
            </p>
          )}
        </div>
      )}
      
      {/* Game Results */}
      {isGameOver && gameState.history && gameState.history.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Game Results</h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-5 font-medium border-b dark:border-gray-700 pb-2 mb-2">
              <div>Round</div>
              <div>Your Move</div>
              <div>Opponent's Move</div>
              <div>Result</div>
              <div>Points</div>
            </div>
            {gameState.history.map((round, index) => {
              if (!currentPlayerId || !opponent) return null;
              const yourMove = round.moves[currentPlayerId];
              const opponentMove = round.moves[opponent.id];
              const yourResult = round.results[currentPlayerId];
              const yourScore = round.scores[currentPlayerId];
              
              return (
                <div key={index} className="grid grid-cols-5 py-2 border-b dark:border-gray-700 last:border-0">
                  <div>{round.round}</div>
                  <div className="flex items-center">
                    <span className="text-xl mr-1">{renderMoveEmoji(yourMove)}</span> 
                    {yourMove}
                  </div>
                  <div className="flex items-center">
                    <span className="text-xl mr-1">{renderMoveEmoji(opponentMove)}</span>
                    {opponentMove}
                  </div>
                  <div className={`${
                    yourResult === 'win' ? 'text-green-600 dark:text-green-400' : 
                    yourResult === 'lose' ? 'text-red-600 dark:text-red-400' : 
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {getResultText(yourResult)}
                  </div>
                  <div>{yourScore > 0 ? '+' : ''}{yourScore}</div>
                </div>
              );
            })}
            
            <div className="grid grid-cols-2 mt-4 pt-3 border-t dark:border-gray-700">
              {players.map(player => {
                const playerData = gameState.playerData[player.id];
                if (!playerData) return null;
                const isCurrentPlayer = player.id === currentPlayerId;
                
                return (
                  <div key={player.id} className="text-center">
                    <div className="font-medium mb-1">{player.displayName} {isCurrentPlayer ? '(You)' : ''}</div>
                    <div className="text-2xl font-bold">{playerData.totalScore} pts</div>
                  </div>
                );
              })}
            </div>
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
      
      {/* Play Again Button */}
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

export default RockPaperScissorsGame; 