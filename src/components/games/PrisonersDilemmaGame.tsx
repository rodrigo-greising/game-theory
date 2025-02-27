'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { PrisonersDilemmaState, Decision, SCORING } from '@/games/prisonersDilemma';

interface PrisonersDilemmaGameProps {
  onGameUpdate?: (gameState: PrisonersDilemmaState) => void;
}

const PrisonersDilemmaGame: React.FC<PrisonersDilemmaGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  
  // Make sure we have the required session data
  if (!currentSession || !currentSession.gameData || !currentSession.gameData.gameState) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Game state not available.</p>
      </div>
    );
  }
  
  const gameState = currentSession.gameData.gameState as PrisonersDilemmaState;
  const currentPlayerId = currentUser?.uid;
  const isGameOver = gameState.status === 'completed';
  const isInProgress = gameState.status === 'in_progress';
  const players = Object.values(currentSession.players || {});
  
  // Add safety check for players
  if (!players || players.length < 2) {
    return (
      <div className="p-6 text-center">
        <p className="text-yellow-500">Waiting for all players to connect...</p>
        <p className="text-sm mt-2 text-gray-400">This game requires 2 players</p>
      </div>
    );
  }
  
  // Check if player has already made a decision this round
  const hasDecided = currentPlayerId && gameState.playerData && 
    gameState.playerData[currentPlayerId] && 
    gameState.playerData[currentPlayerId]?.currentDecision;
  
  // Function to make a decision
  const makeDecision = async (choice: Decision) => {
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
      const updatedPlayerData = {
        ...gameState.playerData,
        [currentPlayerId]: {
          ...currentPlayerData,
          currentDecision: choice,
          ready: true
        }
      };
      
      // Update the game state
      const updatedGameState: PrisonersDilemmaState = {
        ...gameState,
        playerData: updatedPlayerData
      };
      
      // Check if all players have made decisions
      const allPlayersReady = Object.keys(currentSession.players).every(
        playerId => updatedPlayerData[playerId]?.ready
      );
      
      // If all players have made decisions, evaluate the round
      if (allPlayersReady) {
        await evaluateRound(updatedGameState);
      } else {
        await updateGameState(updatedGameState);
      }
      
      setDecision(choice);
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to evaluate the round and update scores
  const evaluateRound = async (currentState: PrisonersDilemmaState) => {
    const playerIds = Object.keys(currentSession.players || {});
    if (!playerIds || playerIds.length !== 2) {
      console.error("Prisoner's Dilemma requires exactly 2 players");
      return; // Prisoner's Dilemma requires exactly 2 players
    }
    
    const player1 = playerIds[0];
    const player2 = playerIds[1];
    const decision1 = currentState.playerData[player1].currentDecision;
    const decision2 = currentState.playerData[player2].currentDecision;
    
    // Calculate scores based on decisions
    let score1 = 0;
    let score2 = 0;
    
    if (decision1 === 'cooperate' && decision2 === 'cooperate') {
      // Both cooperate
      score1 = SCORING.BOTH_COOPERATE;
      score2 = SCORING.BOTH_COOPERATE;
    } else if (decision1 === 'defect' && decision2 === 'defect') {
      // Both defect
      score1 = SCORING.BOTH_DEFECT;
      score2 = SCORING.BOTH_DEFECT;
    } else if (decision1 === 'cooperate' && decision2 === 'defect') {
      // Player 1 cooperates, Player 2 defects
      score1 = SCORING.COOPERATE_WHEN_OTHER_DEFECTS;
      score2 = SCORING.DEFECT_WHEN_OTHER_COOPERATES;
    } else if (decision1 === 'defect' && decision2 === 'cooperate') {
      // Player 1 defects, Player 2 cooperates
      score1 = SCORING.DEFECT_WHEN_OTHER_COOPERATES;
      score2 = SCORING.COOPERATE_WHEN_OTHER_DEFECTS;
    }
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      decisions: {
        [player1]: decision1,
        [player2]: decision2
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
        currentDecision: undefined,
        ready: false
      },
      [player2]: {
        totalScore: currentState.playerData[player2].totalScore + score2,
        currentDecision: undefined,
        ready: false
      }
    };
    
    // Prepare updated game state
    const isLastRound = currentState.round >= currentState.maxRounds;
    const updatedGameState: PrisonersDilemmaState = {
      ...currentState,
      round: isLastRound ? currentState.round : currentState.round + 1,
      status: isLastRound ? 'completed' : 'in_progress',
      playerData: updatedPlayerData,
      history: [...currentState.history, roundResult]
    };
    
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
            : hasDecided 
              ? "Waiting for your opponent..." 
              : "Make your decision"}
        </p>
      </div>
      
      {/* Game Board - Decision Buttons */}
      {isInProgress && !isGameOver && (
        <div className="flex flex-col items-center mb-8">
          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            <button
              onClick={() => makeDecision('cooperate')}
              disabled={loading || hasDecided}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasDecided && decision === 'cooperate'
                  ? 'bg-blue-100 border-blue-500 dark:bg-blue-900 dark:border-blue-400'
                  : 'border-gray-300 hover:border-blue-500 dark:border-gray-600 dark:hover:border-blue-400'
              } ${hasDecided || loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="text-center">
                <div className="text-5xl mb-4">🤝</div>
                <h4 className="font-bold text-lg mb-1">Cooperate</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Stay silent</p>
              </div>
            </button>
            
            <button
              onClick={() => makeDecision('defect')}
              disabled={loading || hasDecided}
              className={`p-6 rounded-lg border-2 transition-all ${
                hasDecided && decision === 'defect'
                  ? 'bg-red-100 border-red-500 dark:bg-red-900 dark:border-red-400'
                  : 'border-gray-300 hover:border-red-500 dark:border-gray-600 dark:hover:border-red-400'
              } ${hasDecided || loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="text-center">
                <div className="text-5xl mb-4">👉</div>
                <h4 className="font-bold text-lg mb-1">Defect</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Betray the other</p>
              </div>
            </button>
          </div>
          
          {hasDecided && (
            <div className="mt-6 text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p>You've chosen to <strong>{decision === 'cooperate' ? 'cooperate' : 'defect'}</strong></p>
              <p className="text-sm text-gray-500 mt-1">Waiting for {opponent?.displayName} to make a decision...</p>
            </div>
          )}
        </div>
      )}
      
      {/* Game Results */}
      {gameState.history && gameState.history.length > 0 && (
        <div className="mt-auto">
          <h3 className="font-semibold text-lg mb-3">Game History</h3>
          
          <div className="overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left">Round</th>
                  <th className="py-2 text-left">You</th>
                  <th className="py-2 text-left">{opponent?.displayName || 'Opponent'}</th>
                  <th className="py-2 text-right">Your Points</th>
                  <th className="py-2 text-right">Their Points</th>
                </tr>
              </thead>
              <tbody>
                {gameState.history.map((round, index) => {
                  // Skip rendering if round data is incomplete
                  if (!round || !round.decisions || !round.scores) {
                    return null;
                  }
                  
                  return (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2">{round.round}</td>
                      <td className="py-2">
                        {currentPlayerId && round.decisions && round.decisions[currentPlayerId] === 'cooperate' 
                          ? '🤝 Cooperate' 
                          : '👉 Defect'}
                      </td>
                      <td className="py-2">
                        {opponent && opponent.id && round.decisions && round.decisions[opponent.id] === 'cooperate' 
                          ? '🤝 Cooperate' 
                          : '👉 Defect'}
                      </td>
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
        </div>
      )}
    </div>
  );
};

export default PrisonersDilemmaGame; 