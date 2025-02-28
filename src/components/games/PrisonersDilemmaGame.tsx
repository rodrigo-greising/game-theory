'use client';

import React, { useState, useEffect } from 'react';
import { useSession, Player } from '@/context/SessionContext';
import { PrisonersDilemmaState, Decision, SCORING } from '@/games/prisonersDilemma';
import PrisonersDilemma from '@/games/prisonersDilemma';
import { useRouter } from 'next/navigation';
import { database } from '@/config/firebaseClient';
import { ref, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface PrisonersDilemmaGameProps {
  onGameUpdate?: (gameState: PrisonersDilemmaState) => void;
}

const PrisonersDilemmaGame: React.FC<PrisonersDilemmaGameProps> = ({ onGameUpdate }) => {
  const { currentSession, currentUser, updateGameState, finishGame } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [isEducationalModalOpen, setIsEducationalModalOpen] = useState(false);
  const router = useRouter();
  
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
      const updatedPlayerData: Record<string, {
        totalScore: number;
        currentDecision?: Decision;
        ready: boolean;
      }> = {
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
    
    // Add safety check to make sure decisions are defined
    if (decision1 && decision2) {
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
    } else {
      console.error('Cannot evaluate round: one or both players have not made a decision');
      return; // Cannot proceed without decisions
    }
    
    // Update scores and history
    const roundResult = {
      round: currentState.round,
      decisions: {
        [player1]: decision1,
        [player2]: decision2
      } as Record<string, Decision>, // Add type assertion to fix TypeScript error
      scores: {
        [player1]: score1,
        [player2]: score2
      }
    };
    
    // Update player data with new scores and reset for next round
    const updatedPlayerData = {
      [player1]: {
        totalScore: currentState.playerData[player1].totalScore + score1,
        currentDecision: null,
        ready: false
      },
      [player2]: {
        totalScore: currentState.playerData[player2].totalScore + score2,
        currentDecision: null,
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
        tournamentResults[player1].cooperateCount += decision1 === 'cooperate' ? 1 : 0;
        tournamentResults[player1].defectCount += decision1 === 'defect' ? 1 : 0;
        
        // Update player 2's tournament stats
        tournamentResults[player2].totalScore += score2;
        tournamentResults[player2].cooperateCount += decision2 === 'cooperate' ? 1 : 0;
        tournamentResults[player2].defectCount += decision2 === 'defect' ? 1 : 0;
        
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
          
          // Create new random player matches for the next round (handled by the server)
          // This will be implemented in a separate cloud function
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
    <div className="flex flex-col min-h-[500px]">
      {/* Add an educational content button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsEducationalModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm"
        >
          Aprender sobre este juego
        </button>
      </div>

      {/* Educational Content Modal */}
      <Dialog open={isEducationalModalOpen} onOpenChange={setIsEducationalModalOpen}>
        <DialogContent className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle className="text-xl font-semibold">El Dilema del Prisionero</DialogTitle>
              <button 
                onClick={() => setIsEducationalModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
              >
                <X size={24} />
              </button>
            </div>
          </DialogHeader>
          <div className="py-4">
            <div dangerouslySetInnerHTML={{ __html: PrisonersDilemma.educationalContent || '' }} />
          </div>
        </DialogContent>
      </Dialog>

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
            ? "¡Los resultados finales están listos!" 
            : hasDecided 
              ? "Esperando a tu oponente..." 
              : "Toma tu decisión"}
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
                <h4 className="font-bold text-lg mb-1">Cooperar</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Permanecer en silencio</p>
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
                <h4 className="font-bold text-lg mb-1">Delatar</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Traicionar al otro</p>
              </div>
            </button>
          </div>
          
          {hasDecided && (
            <div className="mt-6 text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p>Has elegido <strong>{decision === 'cooperate' ? 'cooperar' : 'delatar'}</strong></p>
              <p className="text-sm text-gray-500 mt-1">Esperando a que {opponent?.displayName} tome una decisión...</p>
            </div>
          )}
        </div>
      )}
      
      {/* Game Results */}
      {Array.isArray(gameState.history) && gameState.history.length > 0 && (
        <div className="mt-auto">
          <h3 className="font-semibold text-lg mb-3">Historial del Juego</h3>
          
          <div className="overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 text-left">Ronda</th>
                  <th className="py-2 text-left">Tú</th>
                  <th className="py-2 text-left">{opponent?.displayName || 'Oponente'}</th>
                  <th className="py-2 text-right">Tus Puntos</th>
                  <th className="py-2 text-right">Sus Puntos</th>
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
                          ? '🤝 Cooperar' 
                          : '👉 Delatar'}
                      </td>
                      <td className="py-2">
                        {opponent && opponent.id && round.decisions && round.decisions[opponent.id] === 'cooperate' 
                          ? '🤝 Cooperar' 
                          : '👉 Delatar'}
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
                    <td colSpan={3} className="py-2 text-right">Puntuación Final:</td>
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
          
          {/* Add Game Over summary with larger display of total points */}
          {isGameOver && (
            <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
              <h2 className="text-2xl font-bold mb-4">¡Juego Completado!</h2>
              <div className="flex justify-center items-center gap-8">
                <div className="flex flex-col items-center">
                  <p className="text-lg font-medium">Tu Puntuación</p>
                  <p className="text-4xl font-bold mt-2">
                    {currentPlayerId && gameState.playerData && 
                     gameState.playerData[currentPlayerId]?.totalScore}
                  </p>
                </div>
                <div className="text-2xl font-bold">vs</div>
                <div className="flex flex-col items-center">
                  <p className="text-lg font-medium">Puntuación de {opponent?.displayName || 'Oponente'}</p>
                  <p className="text-4xl font-bold mt-2">
                    {opponent && opponent.id && gameState.playerData && 
                     gameState.playerData[opponent.id]?.totalScore}
                  </p>
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
    </div>
  );
};

export default PrisonersDilemmaGame; 