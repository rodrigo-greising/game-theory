'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { MatchingPenniesState, Choice, PlayerRole, SCORING } from '@/games/matchingPennies';
import { useRouter } from 'next/navigation';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebaseClient';

interface MatchingPenniesGameProps {
  onGameUpdate?: (gameState: MatchingPenniesState) => void;
}

const MatchingPenniesGame: React.FC<MatchingPenniesGameProps> = ({ onGameUpdate }) => {
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
  
  const gameState = currentSession.gameData.gameState as MatchingPenniesState;
  const currentPlayerId = currentUser?.uid;
  const isGameOver = gameState.status === 'completed';
  const isInProgress = gameState.status === 'in_progress';
  const isSetup = gameState.status === 'setup';
  const isRoundZero = gameState.round === 0;
  const isHost = currentUser?.uid && currentSession.players[currentUser.uid]?.isHost;
  const needsInitialization = isSetup || isRoundZero || !gameState.playerData || Object.keys(gameState.playerData).length === 0 || !gameState.playerRoles || Object.keys(gameState.playerRoles).length === 0;
  const players = Object.values(currentSession.players || {});
  
  // Get the current player's role
  const currentPlayerRole = currentPlayerId && gameState.playerRoles ? gameState.playerRoles[currentPlayerId] : undefined;
  
  // Auto-start game when needed
  useEffect(() => {
    if (needsInitialization && isHost && !loading) {
      const autoStartGame = async () => {
        setLoading(true);
        try {
          // Initialize player data
          const initialPlayerData: Record<string, any> = {};
          const playerRoles: Record<string, PlayerRole> = {};
          
          // Get player IDs
          const playerIds = Object.keys(currentSession.players);
          
          // Randomly assign roles
          const matcherIndex = Math.floor(Math.random() * playerIds.length);
          
          // Create player data for each player and assign roles
          playerIds.forEach((playerId, index) => {
            initialPlayerData[playerId] = {
              totalScore: 0,
              currentChoice: null,
              ready: false
            };
            
            // Assign roles based on random index
            playerRoles[playerId] = index === matcherIndex ? 'matcher' : 'mismatcher';
          });
          
          // Update game state to in_progress
          const updatedGameState: MatchingPenniesState = {
            ...gameState,
            status: 'in_progress',
            round: 1, // Start at round 1 instead of 0
            playerData: initialPlayerData,
            playerRoles: playerRoles
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
          <span className="text-5xl">🪙 🪙</span>
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
      const updatedGameState: MatchingPenniesState = {
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
  const evaluateRound = async (currentState: MatchingPenniesState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length !== 2) {
      console.error("Matching Pennies requires exactly 2 players");
      return; // Matching Pennies requires exactly 2 players
    }
    
    const player1 = playerIds[0];
    const player2 = playerIds[1];
    const player1Choice = currentState.playerData[player1].currentChoice;
    const player2Choice = currentState.playerData[player2].currentChoice;
    const player1Role = currentState.playerRoles[player1];
    const player2Role = currentState.playerRoles[player2];
    
    // Calculate scores based on choices and roles
    let score1 = 0;
    let score2 = 0;
    
    // Add safety check to make sure choices and roles are defined
    if (player1Choice && player2Choice && player1Role && player2Role) {
      const choicesMatch = player1Choice === player2Choice;
      
      if (choicesMatch) {
        // Matcher wins
        score1 = player1Role === 'matcher' ? SCORING.MATCHER_WINS.MATCHER : SCORING.MATCHER_WINS.MISMATCHER;
        score2 = player2Role === 'matcher' ? SCORING.MATCHER_WINS.MATCHER : SCORING.MATCHER_WINS.MISMATCHER;
      } else {
        // Mismatcher wins
        score1 = player1Role === 'mismatcher' ? SCORING.MISMATCHER_WINS.MISMATCHER : SCORING.MISMATCHER_WINS.MATCHER;
        score2 = player2Role === 'mismatcher' ? SCORING.MISMATCHER_WINS.MISMATCHER : SCORING.MISMATCHER_WINS.MATCHER;
      }
    } else {
      console.error('Cannot evaluate round: missing choices or roles');
      return; // Cannot proceed without choices and roles
    }
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      decisions: {
        [player1]: player1Choice,
        [player2]: player2Choice
      } as Record<string, Choice>, // Add type assertion to fix TypeScript error
      scores: {
        [player1]: score1,
        [player2]: score2
      }
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData = {
      [player1]: {
        totalScore: currentState.playerData[player1].totalScore + score1,
        currentChoice: null,
        ready: false
      },
      [player2]: {
        totalScore: currentState.playerData[player2].totalScore + score2,
        currentChoice: null,
        ready: false
      }
    };
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: MatchingPenniesState = {
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
        // For Matching Pennies, we don't track cooperate/defect in the same way
        // Instead, we'll track wins/losses directly
        if (score1 > 0) {
          tournamentResults[player1].wins += 1;
          tournamentResults[player2].losses += 1;
        } else if (score1 < 0) {
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
  
  // Get the opponent of the current player
  const getOpponent = (): Player | undefined => {
    if (!currentPlayerId || !players || players.length < 2) return undefined;
    return players.find(player => player.id !== currentPlayerId);
  };
  
  const opponent = getOpponent();
  
  // Get the role name for display
  const getRoleName = (role?: PlayerRole): string => {
    if (!role) return 'Desconocido';
    return role === 'matcher' ? 'Emparejador' : 'Desemparejador';
  };
  
  // Function to render the coin emoji for a choice
  const renderChoiceEmoji = (playerChoice: Choice | null | undefined) => {
    if (playerChoice === 'heads') return '🪙 (C)';
    if (playerChoice === 'tails') return '🪙 (X)';
    return '❓';
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
      
      {/* Role and Game Status */}
      <div className="mb-6 text-center">
        <div className="mb-2 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-3 rounded-lg inline-block">
          <span className="font-semibold">Tu Rol:</span> {getRoleName(currentPlayerRole)}
          {currentPlayerRole === 'matcher' ? 
            <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">Ganas cuando ambos jugadores seleccionan el mismo lado</p> :
            <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">Ganas cuando los jugadores seleccionan lados diferentes</p>
          }
        </div>
        
        <h3 className="text-xl font-semibold mt-4 mb-2">
          {isGameOver 
            ? "Juego Terminado" 
            : `Ronda ${gameState.round} de ${gameState.maxRounds}`}
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {isGameOver 
            ? "Los resultados finales están listos" 
            : hasChosen 
              ? "Esperando a tu oponente..." 
              : "Haz tu elección"}
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
              const playerChoice = lastRound.decisions[player.id];
              const playerScore = lastRound.scores[player.id];
              const totalScore = gameState.playerData[player.id]?.totalScore || 0;
              const playerRole = gameState.playerRoles[player.id];
              
              return (
                <div key={player.id} className={`rounded-lg p-3 ${isCurrentPlayer ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{player.displayName}</span>
                    <div className="flex space-x-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
                        {getRoleName(playerRole)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
                        {isCurrentPlayer ? 'Tú' : 'Oponente'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center mb-1">
                    <span className="text-2xl mr-2">{renderChoiceEmoji(playerChoice)}</span>
                    <span>{playerChoice === 'heads' ? 'Cara' : 'Cruz'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={`${playerScore > 0 ? 'text-green-600' : playerScore < 0 ? 'text-red-600' : ''}`}>
                      {playerScore > 0 ? '+' : ''}{playerScore} pts
                    </span>
                    <span className="font-bold">Total: {totalScore} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Game Board - Choice Buttons */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            <button
              onClick={() => makeChoice('heads')}
              disabled={loading || hasChosen}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasChosen && choice === 'heads'
                  ? 'bg-amber-100 border-amber-500 dark:bg-amber-900 dark:border-amber-400'
                  : 'border-gray-300 hover:border-amber-500 dark:border-gray-600 dark:hover:border-amber-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">🪙</span>
                <h4 className="font-bold mb-1">Cara</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Elige el lado cara de la moneda</p>
              </div>
            </button>
            
            <button
              onClick={() => makeChoice('tails')}
              disabled={loading || hasChosen}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasChosen && choice === 'tails'
                  ? 'bg-amber-100 border-amber-500 dark:bg-amber-900 dark:border-amber-400'
                  : 'border-gray-300 hover:border-amber-500 dark:border-gray-600 dark:hover:border-amber-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">🪙</span>
                <h4 className="font-bold mb-1">Cruz</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Elige el lado cruz de la moneda</p>
              </div>
            </button>
          </div>
          
          {hasChosen && (
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Has elegido {choice === 'heads' ? 'cara' : 'cruz'}. Esperando a tu oponente...
            </p>
          )}
        </div>
      )}
      
      {/* Game Results */}
      {isGameOver && gameState.history && gameState.history.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Resultados del Juego</h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-5 font-medium border-b dark:border-gray-700 pb-2 mb-2">
              <div>Ronda</div>
              <div>Tu Elección</div>
              <div>Elección del Oponente</div>
              <div>Tus Puntos</div>
              <div>Puntos del Oponente</div>
            </div>
            {gameState.history.map((round, index) => {
              if (!currentPlayerId || !opponent) return null;
              const yourChoice = round.decisions[currentPlayerId];
              const opponentChoice = round.decisions[opponent.id];
              const yourScore = round.scores[currentPlayerId];
              const opponentScore = round.scores[opponent.id];
              
              return (
                <div key={index} className="grid grid-cols-5 py-2 border-b dark:border-gray-700 last:border-0">
                  <div>{round.round}</div>
                  <div className="flex items-center">
                    <span className="mr-1">{renderChoiceEmoji(yourChoice)}</span> 
                    {yourChoice === 'heads' ? 'Cara' : 'Cruz'}
                  </div>
                  <div className="flex items-center">
                    <span className="mr-1">{renderChoiceEmoji(opponentChoice)}</span>
                    {opponentChoice === 'heads' ? 'Cara' : 'Cruz'}
                  </div>
                  <div className={`${yourScore > 0 ? 'text-green-600' : yourScore < 0 ? 'text-red-600' : ''}`}>
                    {yourScore > 0 ? '+' : ''}{yourScore}
                  </div>
                  <div className={`${opponentScore > 0 ? 'text-green-600' : opponentScore < 0 ? 'text-red-600' : ''}`}>
                    {opponentScore > 0 ? '+' : ''}{opponentScore}
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
              const isWinner = playerData.totalScore > 0;
              const isDraw = playerData.totalScore === 0;
              
              return (
                <div 
                  key={player.id} 
                  className={`p-4 rounded-lg ${
                    isWinner 
                      ? 'bg-yellow-100 dark:bg-yellow-900 dark:bg-opacity-30 border border-yellow-300 dark:border-yellow-600' 
                      : isDraw
                        ? 'bg-gray-100 dark:bg-gray-800'
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
                    {isDraw && (
                      <span className="ml-2 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 px-2 py-0.5 rounded-full">
                        Empate
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

export default MatchingPenniesGame; 