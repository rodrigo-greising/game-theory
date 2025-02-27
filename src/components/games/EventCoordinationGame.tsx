'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { BattleOfTheSexesState, Preference, SCORING } from '@/games/battleOfTheSexes';
import { useRouter } from 'next/navigation';
import { ref, update } from 'firebase/database';
import { database } from '@/config/firebaseClient';

interface EventCoordinationGameProps {
  onGameUpdate?: (gameState: BattleOfTheSexesState) => void;
}

const EventCoordinationGame: React.FC<EventCoordinationGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preference, setPreference] = useState<Preference | null>(null);
  const router = useRouter();
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as BattleOfTheSexesState;
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
          
          // Assign preferences to players
          // First player likes Opera, second player likes Football
          const playerIds = Object.keys(currentSession.players);
          
          if (playerIds.length !== 2) {
            throw new Error("Event Coordination Dilemma requires exactly 2 players");
          }
          
          // Create player data for each player with their preferred event
          initialPlayerData[playerIds[0]] = {
            totalScore: 0,
            currentPreference: null,
            ready: false,
            preferredEvent: 'opera'
          };
          
          initialPlayerData[playerIds[1]] = {
            totalScore: 0,
            currentPreference: null,
            ready: false,
            preferredEvent: 'football'
          };
          
          // Update game state to in_progress
          const updatedGameState: BattleOfTheSexesState = {
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
          <span className="text-5xl">🎭 🎟️</span>
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
  
  // Check if player has already made a choice this round
  const hasChosen = currentPlayerId && gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentPreference;
  
  // Get the player's preferred event
  const getPlayerPreferredEvent = (): Preference | null => {
    if (!currentPlayerId || !gameState.playerData || !gameState.playerData[currentPlayerId]) {
      return null;
    }
    return gameState.playerData[currentPlayerId].preferredEvent;
  };
  
  const playerPreferredEvent = getPlayerPreferredEvent();
  
  // Function to make a preference choice
  const makeChoice = async (selectedPreference: Preference) => {
    if (!currentPlayerId || hasChosen || !isInProgress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Ensure the player exists in playerData
      const currentPlayerData = gameState.playerData[currentPlayerId];
      if (!currentPlayerData) {
        throw new Error("Player data not found");
      }
      
      // Create updated player data
      const updatedPlayerData: Record<string, {
        totalScore: number;
        currentPreference?: Preference | null;
        ready: boolean;
        preferredEvent: Preference;
      }> = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentPreference: selectedPreference,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: BattleOfTheSexesState = {
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
      
      setPreference(selectedPreference);
    } catch (err: any) {
      setError(err.message || 'Failed to submit choice');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: BattleOfTheSexesState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length !== 2) {
      console.error("Event Coordination Dilemma requires exactly 2 players");
      return; // Requires exactly 2 players
    }
    
    const player1 = playerIds[0];
    const player2 = playerIds[1];
    const preference1 = currentState.playerData[player1].currentPreference;
    const preference2 = currentState.playerData[player2].currentPreference;
    const preferredEvent1 = currentState.playerData[player1].preferredEvent;
    const preferredEvent2 = currentState.playerData[player2].preferredEvent;
    
    // Calculate scores based on choices
    let score1 = 0;
    let score2 = 0;
    
    // Add safety check to make sure preferences are defined
    if (preference1 && preference2) {
      if (preference1 === preference2) {
        // Both chose the same event - they meet up
        if (preference1 === 'opera') {
          // Both chose Opera
          score1 = preferredEvent1 === 'opera' ? SCORING.BOTH_CHOOSE_OPERA.OPERA_LOVER : SCORING.BOTH_CHOOSE_OPERA.FOOTBALL_LOVER;
          score2 = preferredEvent2 === 'opera' ? SCORING.BOTH_CHOOSE_OPERA.OPERA_LOVER : SCORING.BOTH_CHOOSE_OPERA.FOOTBALL_LOVER;
        } else {
          // Both chose Football
          score1 = preferredEvent1 === 'football' ? SCORING.BOTH_CHOOSE_FOOTBALL.FOOTBALL_LOVER : SCORING.BOTH_CHOOSE_FOOTBALL.OPERA_LOVER;
          score2 = preferredEvent2 === 'football' ? SCORING.BOTH_CHOOSE_FOOTBALL.FOOTBALL_LOVER : SCORING.BOTH_CHOOSE_FOOTBALL.OPERA_LOVER;
        }
      } else {
        // They chose different events - they don't meet up
        score1 = SCORING.DIFFERENT_CHOICES;
        score2 = SCORING.DIFFERENT_CHOICES;
      }
    } else {
      console.error('Cannot evaluate round: one or both players have not made a choice');
      return; // Cannot proceed without choices
    }
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      decisions: {
        [player1]: preference1,
        [player2]: preference2
      } as Record<string, Preference>, // Add type assertion to fix TypeScript error
      scores: {
        [player1]: score1,
        [player2]: score2
      }
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData = {
      [player1]: {
        ...currentState.playerData[player1],
        totalScore: currentState.playerData[player1].totalScore + score1,
        currentPreference: null,
        ready: false
      },
      [player2]: {
        ...currentState.playerData[player2],
        totalScore: currentState.playerData[player2].totalScore + score2,
        currentPreference: null,
        ready: false
      }
    };
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: BattleOfTheSexesState = {
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
        // For Event Coordination, track choosing partner's preference as cooperate and own preference as defect
        tournamentResults[player1].cooperateCount += preference1 !== preferredEvent1 ? 1 : 0;
        tournamentResults[player1].defectCount += preference1 === preferredEvent1 ? 1 : 0;
        
        // Update player 2's tournament stats
        tournamentResults[player2].totalScore += score2;
        tournamentResults[player2].cooperateCount += preference2 !== preferredEvent2 ? 1 : 0;
        tournamentResults[player2].defectCount += preference2 === preferredEvent2 ? 1 : 0;
        
        // If game is completed, update matches played and win/loss/draw counts
        if (isLastRound) {
          // Increment matches played
          tournamentResults[player1].matchesPlayed += 1;
          tournamentResults[player2].matchesPlayed += 1;
          
          // Determine winner
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
  
  // Function to render the emoji for a preference
  const renderPreferenceEmoji = (playerPreference: Preference | null | undefined) => {
    if (playerPreference === 'opera') return '🎭';
    if (playerPreference === 'football') return '⚽';
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
              ? "Waiting for your opponent..." 
              : "Make your choice"}
        </p>
        {playerPreferredEvent && (
          <div className="mt-2 p-2 inline-block bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-lg">
            <p className="text-sm">
              Your preferred event: 
              <span className="font-bold ml-1">
                {renderPreferenceEmoji(playerPreferredEvent)} {playerPreferredEvent === 'opera' ? 'Opera' : 'Football'}
              </span>
            </p>
          </div>
        )}
      </div>
      
      {/* Current Round Overview (if game has history) */}
      {gameState.history && gameState.history.length > 0 && !isGameOver && (
        <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-3">Last Round</h3>
          <div className="grid grid-cols-2 gap-4">
            {players.map(player => {
              const isCurrentPlayer = player.id === currentPlayerId;
              const lastRound = gameState.history[gameState.history.length - 1];
              const playerPreference = lastRound.decisions[player.id];
              const playerScore = lastRound.scores[player.id];
              const totalScore = gameState.playerData[player.id]?.totalScore || 0;
              const preferredEvent = gameState.playerData[player.id]?.preferredEvent;
              
              return (
                <div key={player.id} className={`rounded-lg p-3 ${isCurrentPlayer ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{player.displayName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600">
                      {isCurrentPlayer ? 'You' : 'Opponent'}
                    </span>
                  </div>
                  <div className="flex items-center mb-1">
                    <span className="text-2xl mr-2">{renderPreferenceEmoji(playerPreference)}</span>
                    <span>Chose {playerPreference === 'opera' ? 'Opera' : 'Football'}</span>
                  </div>
                  <div className="text-xs mb-1">
                    Prefers: {renderPreferenceEmoji(preferredEvent)} {preferredEvent === 'opera' ? 'Opera' : 'Football'}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Last round: +{playerScore} pts</span>
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
              onClick={() => makeChoice('opera')}
              disabled={loading || hasChosen}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasChosen && preference === 'opera'
                  ? 'bg-purple-100 border-purple-500 dark:bg-purple-900 dark:border-purple-400'
                  : 'border-gray-300 hover:border-purple-500 dark:border-gray-600 dark:hover:border-purple-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">🎭</span>
                <h4 className="font-bold mb-1">Opera</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {playerPreferredEvent === 'opera' ? 'Your preferred event' : 'Not your preferred event'}
                </p>
              </div>
            </button>
            
            <button
              onClick={() => makeChoice('football')}
              disabled={loading || hasChosen}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasChosen && preference === 'football'
                  ? 'bg-green-100 border-green-500 dark:bg-green-900 dark:border-green-400'
                  : 'border-gray-300 hover:border-green-500 dark:border-gray-600 dark:hover:border-green-400'
              }`}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-2">⚽</span>
                <h4 className="font-bold mb-1">Football</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {playerPreferredEvent === 'football' ? 'Your preferred event' : 'Not your preferred event'}
                </p>
              </div>
            </button>
          </div>
          
          {hasChosen && (
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              You chose to attend the {preference === 'opera' ? 'Opera' : 'Football game'}. Waiting for your opponent...
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
              <div>Your Choice</div>
              <div>Opponent's Choice</div>
              <div>Your Points</div>
              <div>Opponent Points</div>
            </div>
            {gameState.history.map((round, index) => {
              if (!currentPlayerId || !opponent) return null;
              const yourPreference = round.decisions[currentPlayerId];
              const opponentPreference = round.decisions[opponent.id];
              const yourScore = round.scores[currentPlayerId];
              const opponentScore = round.scores[opponent.id];
              
              return (
                <div key={index} className="grid grid-cols-5 py-2 border-b dark:border-gray-700 last:border-0">
                  <div>{round.round}</div>
                  <div className="flex items-center">
                    <span className="mr-1">{renderPreferenceEmoji(yourPreference)}</span> 
                    {yourPreference === 'opera' ? 'Opera' : 'Football'}
                  </div>
                  <div className="flex items-center">
                    <span className="mr-1">{renderPreferenceEmoji(opponentPreference)}</span>
                    {opponentPreference === 'opera' ? 'Opera' : 'Football'}
                  </div>
                  <div>+{yourScore}</div>
                  <div>+{opponentScore}</div>
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
                    <div className="text-sm text-gray-500">
                      Prefers: {renderPreferenceEmoji(playerData.preferredEvent)} {playerData.preferredEvent === 'opera' ? 'Opera' : 'Football'}
                    </div>
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
                  <div className="text-sm text-gray-500 mt-1">
                    Preferred: {renderPreferenceEmoji(playerData.preferredEvent)} {playerData.preferredEvent === 'opera' ? 'Opera' : 'Football'}
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

export default EventCoordinationGame; 