'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { VolunteersDilemmaState, VolunteersDilemmaPlayerData, Decision, SCORING } from '@/games/volunteersdilemma';
import { useRouter } from 'next/navigation';
import { database } from '@/config/firebaseClient';
import { ref, update } from 'firebase/database';

interface VolunteersDilemmaGameProps {
  onGameUpdate?: (gameState: VolunteersDilemmaState) => void;
}

const VolunteersDilemmaGame: React.FC<VolunteersDilemmaGameProps> = ({ onGameUpdate }) => {
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
  
  const gameState = currentSession.gameData.gameState as VolunteersDilemmaState;
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
          const initialPlayerData: Record<string, VolunteersDilemmaPlayerData> = {};
          
          players.forEach(player => {
            initialPlayerData[player.id] = {
              totalScore: 0,
              currentDecision: null,
              ready: false
            };
          });
          
          // Update the game state with initialized player data
          const updatedGameState: VolunteersDilemmaState = {
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
        <p className="text-yellow-500">Esperando a que todos los jugadores se conecten...</p>
        <p className="text-sm mt-2 text-gray-400">Este juego requiere al menos 2 jugadores</p>
      </div>
    );
  }
  
  // Ensure gameState.playerData exists before trying to access it
  if (!gameState.playerData) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Inicializando datos del juego...</p>
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  // Check if player has already made a decision this round
  const hasDecided = currentPlayerId && 
    gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentDecision !== undefined &&
    gameState.playerData[currentPlayerId]?.currentDecision !== null;
  
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
          const playerData: Record<string, VolunteersDilemmaPlayerData> = {};
          
          players.forEach(player => {
            playerData[player.id] = {
              totalScore: 0,
              ready: false
            };
          });
          
          const updatedGameState: VolunteersDilemmaState = {
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
  
  // Function to make a decision
  const makeDecision = async (selectedDecision: Decision) => {
    if (!currentPlayerId || hasDecided || !isInProgress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: 0,
        ready: false
      };
      
      // Create updated player data
      const updatedPlayerData: Record<string, VolunteersDilemmaPlayerData> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentDecision: selectedDecision,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: VolunteersDilemmaState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have made decisions
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          // Add safety check to make sure the player exists in updatedPlayerData
          const playerData = updatedPlayerData[playerId as string];
          return playerData && 'ready' in playerData ? playerData.ready : false;
        }
      );
      
      // If all players have made decisions, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
      
      setDecision(selectedDecision);
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: VolunteersDilemmaState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length < 2) {
      console.error("Volunteer's Dilemma requires at least 2 players");
      return; // Volunteer's Dilemma requires at least 2 players
    }
    
    // Count volunteers
    let volunteersCount = 0;
    const decisions: Record<string, Decision> = {};
    
    playerIds.forEach(playerId => {
      const playerDecision = currentState.playerData[playerId]?.currentDecision;
      if (playerDecision === 'volunteer') {
        volunteersCount++;
      }
      decisions[playerId] = playerDecision as Decision;
    });
    
    // Calculate scores for each player
    const scores: Record<string, number> = {};
    
    playerIds.forEach(playerId => {
      const playerDecision = decisions[playerId];
      let score = 0;
      
      if (volunteersCount > 0) {
        // At least one volunteer - everyone gets the benefit
        score = SCORING.PUBLIC_BENEFIT;
        
        // But volunteers also incur a cost
        if (playerDecision === 'volunteer') {
          score -= SCORING.VOLUNTEER_COST;
        }
      } else {
        // No volunteers - everyone gets a penalty
        score = SCORING.NO_VOLUNTEER_PENALTY;
      }
      
      scores[playerId] = score;
    });
    
    // Create the round result
    const roundResult = {
      round: currentState.round,
      decisions,
      volunteersCount,
      scores
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData: Record<string, VolunteersDilemmaPlayerData> = {};
    
    playerIds.forEach(playerId => {
      updatedPlayerData[playerId] = {
        totalScore: (currentState.playerData[playerId]?.totalScore || 0) + scores[playerId],
        currentDecision: null,
        ready: false
      };
    });
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: VolunteersDilemmaState = {
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
          
          // Count volunteer as "cooperate" and not_volunteer as "defect" for tournament stats
          if (decisions[playerId] === 'volunteer') {
            tournamentResults[playerId].cooperateCount += 1;
          } else {
            tournamentResults[playerId].defectCount += 1;
          }
          
          // Update players' tournament scores
          tournamentResults[playerId].totalScore += scores[playerId];
        });
        
        // If game is completed, update matches played and win/loss/draw counts
        if (isLastRound) {
          // Find the highest score
          const playerScores = playerIds.map(playerId => ({
            playerId,
            score: updatedPlayerData[playerId].totalScore
          }));
          
          const highestScore = Math.max(...playerScores.map(p => p.score));
          
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
            } else {
              // Not a winner
              tournamentResults[playerId].losses += 1;
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
  
  // Function to render the decision emoji
  const renderDecisionEmoji = (playerDecision: Decision | null | undefined) => {
    if (playerDecision === 'volunteer') return '🦸';
    if (playerDecision === 'not_volunteer') return '🙋‍♂️';
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
            ? "Juego Terminado" 
            : `Ronda ${gameState.round} de ${gameState.maxRounds}`}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {isGameOver 
            ? "Los resultados finales están listos" 
            : hasDecided 
              ? "Esperando a otros jugadores..." 
              : "Toma tu decisión"}
        </p>
      </div>
      
      {/* Game Board - Decision Buttons */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            <button
              onClick={() => makeDecision('volunteer')}
              disabled={loading || hasDecided}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasDecided && decision === 'volunteer'
                  ? 'bg-green-100 border-green-500 dark:bg-green-900 dark:border-green-400'
                  : 'border-gray-300 hover:border-green-500 dark:border-gray-600 dark:hover:border-green-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">🦸</span>
                <h4 className="font-bold mb-1">Ser Voluntario</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Todos reciben +{SCORING.PUBLIC_BENEFIT}, pero tú pagas {SCORING.VOLUNTEER_COST}
                </p>
              </div>
            </button>
            
            <button
              onClick={() => makeDecision('not_volunteer')}
              disabled={loading || hasDecided}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasDecided && decision === 'not_volunteer'
                  ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-400'
                  : 'border-gray-300 hover:border-blue-500 dark:border-gray-600 dark:hover:border-blue-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">🙋‍♂️</span>
                <h4 className="font-bold mb-1">No Ser Voluntario</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Espera que alguien más sea voluntario para recibir +{SCORING.PUBLIC_BENEFIT}
                </p>
              </div>
            </button>
          </div>
          
          {hasDecided && (
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Has decidido {decision === 'volunteer' ? 'ser voluntario' : 'no ser voluntario'}. Esperando a otros jugadores...
            </p>
          )}
        </div>
      )}
      
      {/* Game Results */}
      {Array.isArray(gameState.history) && gameState.history.length > 0 && (
        <div className="mt-auto">
          <h3 className="font-semibold text-lg mb-3">Historial de Juego</h3>
          
          <div className="overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left">Ronda</th>
                  <th className="py-2 text-center">Tu Decisión</th>
                  <th className="py-2 text-center">Voluntarios</th>
                  <th className="py-2 text-right">Tus Puntos</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  if (!currentPlayerId) return null;
                  
                  const yourDecision = round.decisions[currentPlayerId];
                  const yourScore = round.scores[currentPlayerId];
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2 text-center">
                        <span className="mr-1">{renderDecisionEmoji(yourDecision)}</span> 
                        {yourDecision === 'volunteer' ? 'Voluntario' : 'No Voluntario'}
                      </td>
                      <td className="py-2 text-center font-medium">
                        {round.volunteersCount} / {players.length}
                      </td>
                      <td className="py-2 text-right">
                        {yourScore > 0 ? `+${yourScore}` : yourScore}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {isGameOver && gameState.playerData && (
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={3} className="py-2 text-right">Puntuación Final:</td>
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
              <h2 className="text-2xl font-bold mb-4">¡Juego Completado!</h2>
              <div className="flex flex-col justify-center items-center gap-4">
                <h3 className="text-xl font-semibold">Puntuaciones Finales</h3>
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
                          {isCurrentPlayer ? 'Tú' : player.displayName}
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
                  Volver al Panel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Game Information - Rules */}
      {!isGameOver && !hasDecided && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold mb-2">Reglas del Juego</h3>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li>Si al menos un jugador es voluntario, TODOS reciben +{SCORING.PUBLIC_BENEFIT} puntos</li>
            <li>Sin embargo, cada voluntario paga un costo de {SCORING.VOLUNTEER_COST} puntos</li>
            <li>Si NADIE es voluntario, TODOS reciben {SCORING.NO_VOLUNTEER_PENALTY} puntos</li>
            <li>Tu objetivo: maximizar tus propios puntos en {gameState.maxRounds} rondas</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default VolunteersDilemmaGame; 