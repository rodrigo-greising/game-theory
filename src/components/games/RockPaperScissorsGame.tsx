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
        <p className="text-red-500">Estado del juego no disponible.</p>
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
          const initialPlayerData: Record<string, any> = {};
          
          // Create player data for each player
          Object.keys(currentSession.players).forEach(playerId => {
            initialPlayerData[playerId] = {
              totalScore: 0,
              currentMove: null,
              ready: false
            };
          });
          
          // Update game state to in_progress
          const updatedGameState: RockPaperScissorsState = {
            ...gameState,
            status: 'in_progress',
            round: 1, // Start at round 1 instead of 0
            playerData: initialPlayerData
          };
          
          await updateGameState(updatedGameState);
        } catch (err: any) {
          setError(err.message || 'Error al iniciar el juego');
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
          <span className="text-5xl">👊 ✌️ ✋</span>
        </div>
        <h3 className="text-xl font-semibold mb-4">Cargando Juego...</h3>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  // Add safety check for players
  if (!players || players.length < 2) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Esperando a que todos los jugadores se conecten...</p>
        <p className="text-sm mt-2 text-gray-400">Este juego requiere 2 jugadores</p>
      </div>
    );
  }
  
  // Get the opponent of the current player
  const getOpponent = (): Player | undefined => {
    if (!currentPlayerId || !players || players.length < 2) return undefined;
    return players.find(player => player.id !== currentPlayerId);
  };
  
  const opponent = getOpponent();
  
  // Check if player has already made a move this round
  const hasMoved = currentPlayerId && gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentMove;
  
  // Function to make a move
  const makeMove = async (selectedMove: Move) => {
    if (!currentPlayerId || hasMoved || !isInProgress) return;
    
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
        currentMove?: Move;
        ready: boolean;
      }> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentMove: selectedMove,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: RockPaperScissorsState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have made moves
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          // Add safety check to make sure the player exists in updatedPlayerData
          const playerData = updatedPlayerData[playerId as string];
          return playerData && 'ready' in playerData ? playerData.ready : false;
        }
      );
      
      // If all players have made moves, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
      
      setMove(selectedMove);
    } catch (err: any) {
      setError(err.message || 'Error al realizar el movimiento');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: RockPaperScissorsState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length !== 2) {
      console.error("Rock Paper Scissors requires exactly 2 players");
      return; // RPS requires exactly 2 players
    }
    
    const player1 = playerIds[0];
    const player2 = playerIds[1];
    const move1 = currentState.playerData[player1].currentMove;
    const move2 = currentState.playerData[player2].currentMove;
    
    // Determine the result
    let result: Result = 'draw';
    
    // Add safety check to make sure moves are defined
    if (move1 && move2) {
      if (move1 === move2) {
        // Draw
        result = 'draw';
      } else if (
        (move1 === 'rock' && move2 === 'scissors') ||
        (move1 === 'paper' && move2 === 'rock') ||
        (move1 === 'scissors' && move2 === 'paper')
      ) {
        // Player 1 wins
        result = 'player1';
      } else {
        // Player 2 wins
        result = 'player2';
      }
    } else {
      console.error('Cannot evaluate round: one or both players have not made a move');
      return; // Cannot proceed without moves
    }
    
    // Calculate scores based on result
    let score1 = 0;
    let score2 = 0;
    
    if (result === 'draw') {
      score1 = SCORING.DRAW;
      score2 = SCORING.DRAW;
    } else if (result === 'player1') {
      score1 = SCORING.WIN;
      score2 = SCORING.LOSE;
    } else {
      score1 = SCORING.LOSE;
      score2 = SCORING.WIN;
    }
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      moves: {
        [player1]: move1,
        [player2]: move2
      } as Record<string, Move>, // Add type assertion to fix TypeScript error
      result,
      scores: {
        [player1]: score1,
        [player2]: score2
      }
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData = {
      [player1]: {
        totalScore: currentState.playerData[player1].totalScore + score1,
        currentMove: null,
        ready: false
      },
      [player2]: {
        totalScore: currentState.playerData[player2].totalScore + score2,
        currentMove: null,
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
        
        // Update wins/losses/draws counts based on the result
        if (result === 'draw') {
          tournamentResults[player1].draws += 1;
          tournamentResults[player2].draws += 1;
        } else if (result === 'player1') {
          tournamentResults[player1].wins += 1;
          tournamentResults[player2].losses += 1;
        } else {
          tournamentResults[player1].losses += 1;
          tournamentResults[player2].wins += 1;
        }
        
        // If game is completed, update matches played
        if (isLastRound) {
          // Increment matches played
          tournamentResults[player1].matchesPlayed += 1;
          tournamentResults[player2].matchesPlayed += 1;
          
          // Determine overall winner
          const totalScore1 = updatedPlayerData[player1].totalScore;
          const totalScore2 = updatedPlayerData[player2].totalScore;
          
          if (totalScore1 > totalScore2) {
            // Player 1 wins overall
            tournamentResults[player1].wins += 1;
            tournamentResults[player2].losses += 1;
          } else if (totalScore1 < totalScore2) {
            // Player 2 wins overall
            tournamentResults[player1].losses += 1;
            tournamentResults[player2].wins += 1;
          } else {
            // Draw overall
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
  
  // Function to render the emoji for a move
  const renderMoveEmoji = (playerMove: Move | null | undefined) => {
    if (playerMove === 'rock') return '👊';
    if (playerMove === 'paper') return '✋';
    if (playerMove === 'scissors') return '✌️';
    return '❓';
  };
  
  // Function to get the game result description
  const getResultDescription = (roundResult: Result, isCurrentUser: boolean): string => {
    if (roundResult === 'draw') return 'Empate';
    
    if (isCurrentUser) {
      return roundResult === 'player1' ? 'Victoria' : 'Derrota';
    } else {
      return roundResult === 'player2' ? 'Victoria' : 'Derrota';
    }
  };
  
  // Function to handle exiting the game
  const handleExitGame = async () => {
    setLoading(true);
    try {
      await finishGame();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al salir del juego');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to get move name in Spanish
  const getMoveName = (moveType: Move | null | undefined): string => {
    if (moveType === 'rock') return 'Piedra';
    if (moveType === 'paper') return 'Papel';
    if (moveType === 'scissors') return 'Tijeras';
    return 'Desconocido';
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
            ? "Juego Terminado" 
            : `Ronda ${gameState.round} de ${gameState.maxRounds}`}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {isGameOver 
            ? "Los resultados finales están listos" 
            : hasMoved 
              ? "Esperando a tu oponente..." 
              : "Elige tu movimiento"}
        </p>
      </div>
      
      {/* Current Round Overview (if game has history) */}
      {gameState.history && gameState.history.length > 0 && !isGameOver && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Última Ronda</h3>
          <div className="grid grid-cols-2 gap-4">
            {players.map(player => {
              const isCurrentPlayer = player.id === currentPlayerId;
              const lastRound = gameState.history[gameState.history.length - 1];
              const playerMove = lastRound.moves[player.id];
              const playerScore = lastRound.scores[player.id];
              const totalScore = gameState.playerData[player.id]?.totalScore || 0;
              const roundResult = isCurrentPlayer 
                ? (player.id === Object.keys(currentSession.players)[0] ? lastRound.result === 'player1' : lastRound.result === 'player2') 
                : (player.id === Object.keys(currentSession.players)[0] ? lastRound.result === 'player2' : lastRound.result === 'player1');
              
              return (
                <div key={player.id} className={`rounded-lg p-3 ${isCurrentPlayer ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{player.displayName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
                      {isCurrentPlayer ? 'Tú' : 'Oponente'}
                    </span>
                  </div>
                  <div className="flex items-center mb-1">
                    <span className="text-2xl mr-2">{renderMoveEmoji(playerMove)}</span>
                    <span>{getMoveName(playerMove)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={`${
                      lastRound.result === 'draw' 
                        ? 'text-gray-600' 
                        : (roundResult ? 'text-green-600' : 'text-red-600')
                    }`}>
                      {getResultDescription(
                        roundResult ? 'player1' : roundResult === 'draw' ? 'draw' : 'player2', 
                        isCurrentPlayer
                      )}
                    </span>
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
              onClick={() => makeMove('rock')}
              disabled={loading || hasMoved}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasMoved && move === 'rock'
                  ? 'bg-gray-100 border-gray-500 dark:bg-gray-800 dark:border-gray-400'
                  : 'border-gray-300 hover:border-gray-500 dark:border-gray-600 dark:hover:border-gray-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">👊</span>
                <h4 className="font-bold mb-1">Piedra</h4>
              </div>
            </button>
            
            <button
              onClick={() => makeMove('paper')}
              disabled={loading || hasMoved}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasMoved && move === 'paper'
                  ? 'bg-gray-100 border-gray-500 dark:bg-gray-800 dark:border-gray-400'
                  : 'border-gray-300 hover:border-gray-500 dark:border-gray-600 dark:hover:border-gray-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">✋</span>
                <h4 className="font-bold mb-1">Papel</h4>
              </div>
            </button>
            
            <button
              onClick={() => makeMove('scissors')}
              disabled={loading || hasMoved}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasMoved && move === 'scissors'
                  ? 'bg-gray-100 border-gray-500 dark:bg-gray-800 dark:border-gray-400'
                  : 'border-gray-300 hover:border-gray-500 dark:border-gray-600 dark:hover:border-gray-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">✌️</span>
                <h4 className="font-bold mb-1">Tijeras</h4>
              </div>
            </button>
          </div>
          
          {hasMoved && (
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Has elegido {getMoveName(move)}. Esperando a tu oponente...
            </p>
          )}
        </div>
      )}
      
      {/* Game Rules */}
      {isInProgress && !isGameOver && !hasMoved && (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center max-w-md mx-auto">
          <h4 className="font-semibold mb-2">Reglas del Juego</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>• Piedra vence a Tijeras</li>
            <li>• Papel vence a Piedra</li>
            <li>• Tijeras vencen a Papel</li>
          </ul>
        </div>
      )}
      
      {/* Game Results */}
      {isGameOver && gameState.history && gameState.history.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Resultados del Juego</h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-4 font-medium border-b dark:border-gray-700 pb-2 mb-2">
              <div>Ronda</div>
              <div>Tu Jugada</div>
              <div>Jugada del Oponente</div>
              <div>Resultado</div>
            </div>
            {gameState.history.map((round, index) => {
              if (!currentPlayerId || !opponent) return null;
              const yourMove = round.moves[currentPlayerId];
              const opponentMove = round.moves[opponent.id];
              const isPlayer1 = currentPlayerId === Object.keys(currentSession.players)[0];
              const result = 
                round.result === 'draw' ? 'Empate' : 
                (isPlayer1 && round.result === 'player1') || (!isPlayer1 && round.result === 'player2') 
                  ? 'Victoria' 
                  : 'Derrota';
              
              return (
                <div key={index} className="grid grid-cols-4 py-2 border-b dark:border-gray-700 last:border-0">
                  <div>{round.round}</div>
                  <div className="flex items-center">
                    <span className="mr-1">{renderMoveEmoji(yourMove)}</span> 
                    {getMoveName(yourMove)}
                  </div>
                  <div className="flex items-center">
                    <span className="mr-1">{renderMoveEmoji(opponentMove)}</span>
                    {getMoveName(opponentMove)}
                  </div>
                  <div className={`
                    ${result === 'Empate' ? 'text-gray-600' : ''}
                    ${result === 'Victoria' ? 'text-green-600' : ''}
                    ${result === 'Derrota' ? 'text-red-600' : ''}
                  `}>
                    {result}
                  </div>
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
                    <div className="font-medium mb-1">{player.displayName} {isCurrentPlayer ? '(Tú)' : ''}</div>
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
          <h3 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-100">Puntuaciones Finales</h3>
          <div className="grid grid-cols-2 gap-4">
            {players.map(player => {
              const playerData = gameState.playerData[player.id];
              if (!playerData) return null;
              
              const isCurrentPlayer = player.id === currentPlayerId;
              const isWinner = Object.values(gameState.playerData).every(
                p => p.totalScore <= playerData.totalScore
              );
              const isTie = Object.values(gameState.playerData).some(
                p => p !== playerData && p.totalScore === playerData.totalScore
              );
              
              return (
                <div 
                  key={player.id} 
                  className={`p-4 rounded-lg ${
                    isWinner && !isTie
                      ? 'bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 border border-yellow-300 dark:border-yellow-600' 
                      : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="font-bold text-lg mb-1 flex items-center">
                    {player.displayName}
                    {isCurrentPlayer && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full">
                        Tú
                      </span>
                    )}
                    {isWinner && !isTie && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                        Ganador
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
            Volver al Panel
          </button>
        </div>
      )}
    </div>
  );
};

export default RockPaperScissorsGame; 