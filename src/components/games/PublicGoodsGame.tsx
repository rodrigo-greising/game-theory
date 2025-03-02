'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { PublicGoodsGameState, PublicGoodsPlayerData } from '@/games/publicGoodsGame';
import { useRouter } from 'next/navigation';
import { database } from '@/config/firebaseClient';
import { ref, update } from 'firebase/database';

interface PublicGoodsGameProps {
  onGameUpdate?: (gameState: PublicGoodsGameState) => void;
}

const PublicGoodsGame: React.FC<PublicGoodsGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contribution, setContribution] = useState<number>(0);
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Estado del juego no disponible.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as PublicGoodsGameState;
  const currentPlayerId = currentUser?.uid;
  const isGameOver = gameState.status === 'completed';
  const isInProgress = gameState.status === 'in_progress';
  const players = Object.values(currentSession.players || {});
  
  // Add safety check for players
  if (!players || players.length < 3) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Esperando a que todos los jugadores se conecten...</p>
        <p className="text-sm mt-2 text-gray-400">Este juego requiere al menos 3 jugadores</p>
      </div>
    );
  }
  
  // Initialize playerData if it doesn't exist yet
  useEffect(() => {
    const initializePlayerData = async () => {
      if (
        currentPlayerId && 
        players.length >= 3 && 
        gameState && 
        gameState.status === 'in_progress' && 
        (!gameState.playerData || Object.keys(gameState.playerData).length === 0 || !gameState.playerData[currentPlayerId])
      ) {
        setLoading(true);
        try {
          // Create initial player data for all players
          const initialPlayerData: Record<string, PublicGoodsPlayerData> = {};
          
          players.forEach(player => {
            initialPlayerData[player.id] = {
              totalScore: gameState.initialEndowment, // Start with initial endowment
              currentContribution: null,
              ready: false
            };
          });
          
          // Update the game state with initialized player data
          const updatedGameState: PublicGoodsGameState = {
            ...gameState,
            playerData: initialPlayerData
          };
          
          await updateGameState(updatedGameState);
        } catch (err: any) {
          console.error('Error initializing player data:', err);
          setError(err.message || 'Error al inicializar los datos del juego');
        } finally {
          setLoading(false);
        }
      }
    };
    
    initializePlayerData();
  }, [currentPlayerId, gameState, players, updateGameState]);
  
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
  
  // Check if player has already made a contribution this round
  const hasContributed = currentPlayerId && 
    gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentContribution !== undefined &&
    gameState.playerData[currentPlayerId]?.currentContribution !== null;
  
  // Auto start game if needed (on first load)
  useEffect(() => {
    const autoStartGame = async () => {
      if (
        gameState.status === 'setup' && 
        players.length >= 3 && 
        currentUser?.uid && 
        !loading && 
        currentSession.players[currentUser.uid]?.isHost
      ) {
        setLoading(true);
        try {
          // Initialize the game if it's in setup state
          const playerData: Record<string, PublicGoodsPlayerData> = {};
          
          players.forEach(player => {
            playerData[player.id] = {
              totalScore: gameState.initialEndowment, // Start with initial endowment
              ready: false
            };
          });
          
          const updatedGameState: PublicGoodsGameState = {
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
          setError(err.message || 'Error al iniciar el juego');
        } finally {
          setLoading(false);
        }
      }
    };
    
    autoStartGame();
  }, [gameState, players, currentUser, updateGameState, onGameUpdate, loading, currentSession]);
  
  // Function to make a contribution
  const makeContribution = async () => {
    if (!currentPlayerId || hasContributed || !isInProgress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the contribution is within valid range
      const validContribution = Math.min(
        Math.max(contribution, 0),
        gameState.initialEndowment
      );
      
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId] || {
        totalScore: gameState.initialEndowment,
        ready: false
      };
      
      // Create updated player data
      const updatedPlayerData: Record<string, PublicGoodsPlayerData> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentContribution: validContribution,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: PublicGoodsGameState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have made contributions
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => {
          // Add safety check to make sure the player exists in updatedPlayerData
          const playerData = updatedPlayerData[playerId];
          return playerData && 'ready' in playerData ? playerData.ready : false;
        }
      );
      
      // If all players have made contributions, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
    } catch (err: any) {
      setError(err.message || 'Error al enviar la contribución');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: PublicGoodsGameState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length < 3) {
      console.error("Public Goods Game requires at least 3 players");
      return; // Requires at least 3 players
    }
    
    // Calculate total contribution
    let totalContribution = 0;
    
    // Gather all player contributions
    playerIds.forEach(playerId => {
      const contribution = currentState.playerData[playerId]?.currentContribution;
      if (contribution !== undefined && contribution !== null) {
        totalContribution += contribution;
      }
    });
    
    // Calculate the public good (multiplied by the multiplier)
    const publicGood = totalContribution * currentState.multiplier;
    
    // Calculate individual returns (divided equally among all players)
    const individualReturn = publicGood / playerIds.length;
    
    // Create the round result
    const roundResult = {
      round: currentState.round,
      contributions: {} as Record<string, number>,
      publicPool: totalContribution,
      multiplier: currentState.multiplier,
      returns: {} as Record<string, number>,
      scores: {} as Record<string, number>
    };
    
    // Calculate net gains for each player
    const updatedPlayerData: Record<string, PublicGoodsPlayerData> = {};
    
    playerIds.forEach(playerId => {
      const playerData = currentState.playerData[playerId];
      const contribution = playerData?.currentContribution || 0;
      
      // Record contribution for history
      roundResult.contributions[playerId] = contribution;
      
      // Calculate net gain: what they get back minus what they contributed
      const netGain = individualReturn - contribution;
      
      // Store individual returns and scores in history
      roundResult.returns[playerId] = individualReturn;
      roundResult.scores[playerId] = netGain;
      
      // Update player's total score and reset for next round
      updatedPlayerData[playerId] = {
        totalScore: (playerData?.totalScore || 0) + individualReturn,
        currentContribution: null,
        ready: false
      };
    });
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: PublicGoodsGameState = {
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
          
          // For public goods game, cooperation is measured by contribution relative to endowment
          const playerContributions = Array.isArray(currentState.history)
            ? currentState.history.map(round => round.contributions[playerId] || 0)
            : [];
          
          // Add current round contributions
          playerContributions.push(roundResult.contributions[playerId]);
          
          // Calculate average contribution as percentage of endowment
          const avgContribution = playerContributions.reduce((sum, contrib) => sum + contrib, 0) / playerContributions.length;
          const contributionRatio = avgContribution / currentState.initialEndowment;
          
          // Consider high contributions (>50% of endowment) as cooperative behavior
          const cooperateThreshold = 0.5;
          tournamentResults[playerId].cooperateCount += contributionRatio >= cooperateThreshold ? 1 : 0;
          tournamentResults[playerId].defectCount += contributionRatio < cooperateThreshold ? 1 : 0;
          
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
  
  // Get current player data
  const currentPlayerData = currentPlayerId && gameState.playerData 
    ? gameState.playerData[currentPlayerId] 
    : undefined;
  
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
            : hasContributed 
              ? "Esperando a otros jugadores..." 
              : "Haz tu contribución al fondo común"}
        </p>
      </div>
      
      {/* Game Board - Contribution Input */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-lg mb-4 text-center">Tu Contribución</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
              Elige cuánto contribuir al fondo común. El total será multiplicado por {gameState.multiplier} 
              y luego dividido equitativamente entre todos los {players.length} jugadores.
            </p>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span>0</span>
                <span>{gameState.initialEndowment}</span>
              </div>
              <input
                type="range"
                min={0}
                max={gameState.initialEndowment}
                value={contribution}
                onChange={(e) => setContribution(parseInt(e.target.value))}
                disabled={loading || hasContributed}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="mt-2 text-center">
                <span className="text-2xl font-bold">{contribution}</span>
                <span className="text-gray-500"> de {gameState.initialEndowment}</span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Tu saldo actual: <span className="font-bold">{currentPlayerData?.totalScore || 0}</span>
                </p>
              </div>
              
              <button
                onClick={makeContribution}
                disabled={loading || hasContributed}
                className={`p-3 rounded-md text-white font-medium transition-all
                  ${loading || hasContributed
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                  }`}
              >
                {loading ? 'Enviando...' : hasContributed ? 'Contribución Enviada' : 'Contribuir al Fondo Común'}
              </button>
            </div>
          </div>
          
          {hasContributed && gameState.playerData && currentPlayerId && gameState.playerData[currentPlayerId] && (
            <div className="mt-6 text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p>Has contribuido <strong>{gameState.playerData[currentPlayerId]?.currentContribution}</strong> al fondo común</p>
              <p className="text-sm text-gray-500 mt-1">
                Esperando a que {Object.values(currentSession.players || {}).filter(p => 
                  p.id !== currentPlayerId && 
                  (!gameState.playerData[p.id] || 
                   !gameState.playerData[p.id].ready)
                ).map(p => p.displayName).join(', ')} contribuyan...
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Last Round Results */}
      {Array.isArray(gameState.history) && gameState.history.length > 0 && !isGameOver && (
        <div className="mb-8">
          <h3 className="font-semibold text-lg mb-3">Resultados de la Ronda Anterior</h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Contribución Total</p>
                  <p className="text-xl font-semibold">{gameState.history[gameState.history.length - 1].publicPool}</p>
                </div>
                <div className="p-3 bg-white dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Fondo Común (x{gameState.history[gameState.history.length - 1].multiplier})</p>
                  <p className="text-xl font-semibold">{gameState.history[gameState.history.length - 1].publicPool * gameState.history[gameState.history.length - 1].multiplier}</p>
                </div>
              </div>
              
              <div className="p-3 bg-white dark:bg-gray-700 rounded-lg text-center">
                <p className="text-sm text-gray-500 mb-1">Retorno Individual</p>
                <p className="text-xl font-semibold">{gameState.history[gameState.history.length - 1].returns[currentPlayerId]}</p>
              </div>
            </div>
            
            <div className="mt-4">
              <h4 className="font-medium mb-2">Contribuciones individuales</h4>
              <ul className="space-y-2">
                {Object.entries(gameState.history[gameState.history.length - 1].contributions).map(([playerId, amount]) => {
                  const player = players.find(p => p.id === playerId);
                  const isCurrentPlayer = playerId === currentPlayerId;
                  
                  return (
                    <li key={playerId} className="flex justify-between items-center p-2 bg-white dark:bg-gray-700 rounded">
                      <span className={isCurrentPlayer ? 'font-medium' : ''}>
                        {player?.displayName} {isCurrentPlayer ? '(Tú)' : ''}:
                      </span>
                      <span className="font-medium">{amount}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Game History */}
      {Array.isArray(gameState.history) && gameState.history.length > 0 && (
        <div className="mt-auto">
          <h3 className="font-semibold text-lg mb-3">Historial del Juego</h3>
          
          <div className="overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left">Ronda</th>
                  <th className="py-2 text-right">Tu Contribución</th>
                  <th className="py-2 text-right">Total Contribuido</th>
                  <th className="py-2 text-right">Fondo Común (x{gameState.multiplier})</th>
                  <th className="py-2 text-right">Tu Retorno</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  if (!currentPlayerId) return null;
                  
                  const playerContribution = round.contributions[currentPlayerId] || 0;
                  const playerNetGain = round.scores[currentPlayerId] || 0;
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2 text-right">{playerContribution}</td>
                      <td className="py-2 text-right">{round.publicPool}</td>
                      <td className="py-2 text-right">{round.publicPool * round.multiplier}</td>
                      <td className={`py-2 text-right ${playerNetGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {playerNetGain >= 0 ? '+' : ''}{round.returns[currentPlayerId]} ({playerNetGain >= 0 ? '+' : ''}{playerNetGain})
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
        <div className="mt-6">
          <h3 className="font-semibold text-xl mb-4">Puntuaciones Finales</h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="grid gap-4">
              {players.map(player => {
                if (!gameState.playerData[player.id]) return null;
                
                const playerData = gameState.playerData[player.id];
                const isCurrentPlayer = player.id === currentPlayerId;
                const isWinner = Object.values(gameState.playerData).every(
                  p => p.totalScore <= playerData.totalScore
                );
                
                return (
                  <div 
                    key={player.id} 
                    className={`p-4 rounded-lg ${
                      isWinner 
                        ? 'bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-30 border border-yellow-200 dark:border-yellow-600' 
                        : 'bg-gray-50 dark:bg-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`font-medium ${isCurrentPlayer ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                          {player.displayName} {isCurrentPlayer ? '(Tú)' : ''}
                        </span>
                        {isWinner && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                            Ganador
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-lg">{playerData.totalScore}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 text-center">
              <button
                onClick={handleExitGame}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                Volver al Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicGoodsGame; 