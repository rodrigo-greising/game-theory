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
        <p className="text-red-500">Estado del juego no disponible.</p>
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
          <span className="text-5xl">🎯 🎯</span>
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
        <p className="text-sm mt-2 text-gray-400">Este juego requiere al menos 2 jugadores</p>
      </div>
    );
  }
  
  // Check if player has already made a choice this round
  const hasChosen = currentPlayerId && gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentChoice;
  
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
        currentChoice?: Choice;
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
      setError(err.message || 'Error al realizar la elección');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: CoordinationGameState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length < 2) {
      console.error("Coordination Game requires at least 2 players");
      return; // Requires at least 2 players
    }
    
    // Gather all player choices
    const playerChoices: Record<string, Choice> = {};
    let allChoicesValid = true;
    
    playerIds.forEach(playerId => {
      const choice = currentState.playerData[playerId]?.currentChoice;
      playerChoices[playerId] = choice as Choice;
      
      // Check if any choices are undefined
      if (choice === undefined) {
        allChoicesValid = false;
      }
    });
    
    // Make sure all players have made valid choices
    if (!allChoicesValid) {
      console.error('Cannot evaluate round: one or more players have not made a choice');
      return;
    }
    
    // Calculate scores based on choices
    const scores: Record<string, number> = {};
    
    // Check the distribution of choices
    const choiceA = currentState.optionA;
    const choiceB = currentState.optionB;
    let countChoiceA = 0;
    let countChoiceB = 0;
    
    playerIds.forEach(playerId => {
      if (playerChoices[playerId] === choiceA) {
        countChoiceA++;
      } else if (playerChoices[playerId] === choiceB) {
        countChoiceB++;
      }
    });
    
    // Calculate scores for each player based on their choices compared to the majority
    playerIds.forEach(playerId => {
      const playerChoice = playerChoices[playerId];
      
      // Different scoring scenarios based on coordination
      if (countChoiceA === countChoiceB) {
        // Perfectly split - lower rewards for everyone
        scores[playerId] = SCORING.SPLIT;
      } else if (
        (playerChoice === choiceA && countChoiceA > countChoiceB) ||
        (playerChoice === choiceB && countChoiceB > countChoiceA)
      ) {
        // Player chose the majority choice - higher reward
        scores[playerId] = SCORING.MAJORITY;
      } else {
        // Player chose the minority choice - lower reward
        scores[playerId] = SCORING.MINORITY;
      }
    });
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      choices: playerChoices,
      scores: scores,
      choiceACounts: countChoiceA,
      choiceBCounts: countChoiceB
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData: Record<string, {
      totalScore: number;
      currentChoice: Choice | null;
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
    if (currentSession.isTournament && isLastRound) {
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
          
          // For coordination game, maybe count choosing the majority as cooperation
          const choiceHistory = Array.isArray(currentState.history) 
            ? currentState.history.map(round => {
                const choice = round.choices[playerId];
                const choiceACount = round.choiceACounts;
                const choiceBCount = round.choiceBCounts;
                const isMajorityChoice = 
                  (choice === choiceA && choiceACount > choiceBCount) || 
                  (choice === choiceB && choiceBCount > choiceACount);
                return isMajorityChoice;
              })
            : [];
          
          // Add current round
          const currentChoice = playerChoices[playerId];
          const isMajorityChoice = 
            (currentChoice === choiceA && countChoiceA > countChoiceB) || 
            (currentChoice === choiceB && countChoiceB > countChoiceA);
          choiceHistory.push(isMajorityChoice);
          
          // Calculate cooperation as the percentage of majority choices
          const cooperationRate = choiceHistory.filter(Boolean).length / choiceHistory.length;
          
          // Consider majority choices as cooperation (arbitrary threshold)
          tournamentResults[playerId].cooperateCount += cooperationRate >= 0.5 ? 1 : 0;
          tournamentResults[playerId].defectCount += cooperationRate < 0.5 ? 1 : 0;
          
          // Update player's tournament score
          tournamentResults[playerId].totalScore += updatedPlayerData[playerId].totalScore;
          
          // Increment matches played
          tournamentResults[playerId].matchesPlayed += 1;
        });
        
        // Determine winners and losers based on final scores
        const playerScores = playerIds.map(id => ({
          id,
          score: updatedPlayerData[id].totalScore
        }));
        
        // Sort by score (highest first)
        playerScores.sort((a, b) => b.score - a.score);
        
        // Find highest and lowest scores
        const highestScore = playerScores[0].score;
        const lowestScore = playerScores[playerScores.length - 1].score;
        
        // Update win/loss/draw records
        playerIds.forEach(playerId => {
          const playerScore = updatedPlayerData[playerId].totalScore;
          
          if (playerScore === highestScore && playerScore > lowestScore) {
            // Player has highest score (may be tied with others)
            tournamentResults[playerId].wins += 1;
          } else if (playerScore === lowestScore && playerScore < highestScore) {
            // Player has lowest score (may be tied with others)
            tournamentResults[playerId].losses += 1;
          } else {
            // Player is in the middle or tied for both highest and lowest (everyone has same score)
            tournamentResults[playerId].draws += 1;
          }
        });
        
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
      setError(err.message || 'Error al salir del juego');
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
            ? "Juego Terminado" 
            : `Ronda ${gameState.round} de ${gameState.maxRounds}`}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {isGameOver 
            ? "Los resultados finales están listos" 
            : hasChosen 
              ? "Esperando a otros jugadores..." 
              : "Elige una opción"}
        </p>
      </div>
      
      {/* Game Board - Choice Buttons */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4 text-center max-w-md">
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              El objetivo de este juego es coordinarse para elegir la misma opción que la mayoría. 
              ¡Mayor coordinación significa mayores puntuaciones!
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              La mayoría consigue {SCORING.MAJORITY} puntos, la minoría consigue {SCORING.MINORITY} puntos. 
              Si hay empate, todos reciben {SCORING.SPLIT} puntos.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-6 w-full max-w-md mb-6">
            <button
              onClick={() => makeChoice(gameState.optionA)}
              disabled={loading || hasChosen}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasChosen && choice === gameState.optionA
                  ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-400'
                  : 'border-gray-300 hover:border-blue-500 dark:border-gray-600 dark:hover:border-blue-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-3">🅰️</span>
                <h4 className="font-bold">{gameState.optionA}</h4>
              </div>
            </button>
            
            <button
              onClick={() => makeChoice(gameState.optionB)}
              disabled={loading || hasChosen}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasChosen && choice === gameState.optionB
                  ? 'bg-green-100 border-green-500 dark:bg-green-900 dark:border-green-400'
                  : 'border-gray-300 hover:border-green-500 dark:border-gray-600 dark:hover:border-green-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-3">🅱️</span>
                <h4 className="font-bold">{gameState.optionB}</h4>
              </div>
            </button>
          </div>
          
          {hasChosen && (
            <p className="text-gray-600 dark:text-gray-400">
              Has elegido <strong>{choice}</strong>. Esperando a que otros jugadores decidan...
            </p>
          )}
        </div>
      )}
      
      {/* Current Round Results (if history exists) */}
      {gameState.history && gameState.history.length > 0 && !isGameOver && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Resultados de la Ronda Anterior</h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between mb-6">
              <div className="text-center">
                <h4 className="font-medium text-lg">{gameState.optionA}</h4>
                <p className="text-3xl font-bold">{gameState.history[gameState.history.length - 1].choiceACounts}</p>
                <p className="text-sm text-gray-500">jugadores</p>
              </div>
              <div className="text-center">
                <h4 className="font-medium text-lg">{gameState.optionB}</h4>
                <p className="text-3xl font-bold">{gameState.history[gameState.history.length - 1].choiceBCounts}</p>
                <p className="text-sm text-gray-500">jugadores</p>
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="font-medium mb-2">Elecciones por jugador</h4>
              <div className="grid gap-2">
                {players.map(player => {
                  const lastRound = gameState.history[gameState.history.length - 1];
                  const playerChoice = lastRound.choices[player.id];
                  const playerScore = lastRound.scores[player.id];
                  const isCurrentPlayer = player.id === currentPlayerId;
                  
                  return (
                    <div 
                      key={player.id} 
                      className={`flex justify-between p-2 rounded ${
                        isCurrentPlayer ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' : 'bg-white dark:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className="font-medium mr-2">{player.displayName}</span>
                        {isCurrentPlayer && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full">Tú</span>}
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium mr-2">{playerChoice}</span>
                        <span className="text-sm text-gray-500">({playerScore} pts)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Game History */}
      {gameState.history && gameState.history.length > 0 && (
        <div className="mt-auto mb-8">
          <h3 className="font-semibold text-lg mb-3">Historial del Juego</h3>
          
          <div className="overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left">Ronda</th>
                  <th className="py-2 text-center">{gameState.optionA}</th>
                  <th className="py-2 text-center">{gameState.optionB}</th>
                  <th className="py-2 text-left">Tu elección</th>
                  <th className="py-2 text-right">Tus puntos</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  if (!currentPlayerId) return null;
                  
                  const playerChoice = round.choices[currentPlayerId];
                  const playerScore = round.scores[currentPlayerId];
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2 text-center">{round.choiceACounts}</td>
                      <td className="py-2 text-center">{round.choiceBCounts}</td>
                      <td className="py-2">{playerChoice}</td>
                      <td className="py-2 text-right">{playerScore}</td>
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
          <h3 className="text-xl font-semibold mb-4 text-blue-900 dark:text-blue-100">Puntuaciones Finales</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        Tú
                      </span>
                    )}
                    {isWinner && (
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
          
          <div className="mt-6 text-center">
            <button
              onClick={handleExitGame}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              Volver al Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinationGame; 