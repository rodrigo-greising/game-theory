'use client';

import React, { useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';
import PrisonersDilemmaGame from '@/components/games/PrisonersDilemmaGame';
import StagHuntGame from '@/components/games/StagHuntGame';
import ChickenGame from '@/components/games/ChickenGame';
import TravelersDilemmaGame from '@/components/games/TravelersDilemmaGame';
import CentipedeGame from '@/components/games/CentipedeGame';
import EventCoordinationGame from '@/components/games/EventCoordinationGame';
import MatchingPenniesGame from '@/components/games/MatchingPenniesGame';
import GameInfo from '@/components/games/GameInfo';
import TournamentLeaderboard from '@/components/games/TournamentLeaderboard';
import UltimatumGame from '@/components/games/UltimatumGame';
import DictatorGame from '@/components/games/DictatorGame';
import CoordinationGame from '@/components/games/CoordinationGame';
import VolunteersDilemmaGame from '@/components/games/VolunteersDilemmaGame';
import RockPaperScissorsGame from '@/components/games/RockPaperScissorsGame';
import BertrandCompetitionGame from '@/components/games/BertrandCompetitionGame';
import CournotCompetitionGame from '@/components/games/CournotCompetitionGame';

export default function GamePage() {
  const { currentSession, loading, finishGame, currentUser } = useSession();
  const router = useRouter();
  
  // Function to handle returning to dashboard
  const handleReturnToDashboard = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await finishGame();
      router.push('/dashboard');
    } catch (error) {
      console.error('Error al finalizar el juego:', error);
    }
  };
  
  // Redirect to dashboard if not in a session or if session is neither 'playing' nor 'finished'
  useEffect(() => {
    if (!loading && (!currentSession || (currentSession.status !== 'playing' && currentSession.status !== 'finished'))) {
      router.push('/dashboard');
    }
  }, [currentSession, loading, router]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!currentSession || (currentSession.status !== 'playing' && currentSession.status !== 'finished')) {
    return null; // Will be redirected by the useEffect above
  }
  
  const players = Object.values(currentSession.players || {});
  const gameId = currentSession?.gameData?.gameId || '';
  const isTournament = currentSession.isTournament || false;
  
  // For tournament mode, determine if the current player is matched
  const currentPlayerId = currentUser?.uid || '';
  const playerMatch = isTournament && currentSession.playerMatches ? 
    currentSession.playerMatches[currentPlayerId] : null;
  
  const isWaiting = playerMatch === 'waiting';
  const hasMatch = playerMatch && playerMatch !== 'waiting';
  
  // For tournament mode with fewer than 2 players, show waiting screen
  if (isTournament && players.length < 2) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4">Esperando Jugadores</h2>
          <p className="mb-4">El modo torneo requiere al menos 2 jugadores para comenzar.</p>
          <p className="text-sm text-gray-500">Jugadores actuales: {players.length}</p>
          <Link 
            href="/dashboard"
            className="inline-block mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
          >
            Volver al Panel Principal
          </Link>
        </div>
      </div>
    );
  }
  
  // For regular game mode with insufficient players
  if (!isTournament && players.length < 2) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4">Esperando Jugadores</h2>
          <p className="mb-4">Este juego requiere al menos 2 jugadores para comenzar.</p>
          <p className="text-sm text-gray-500">Jugadores actuales: {players.length}</p>
          <Link 
            href="/dashboard"
            className="inline-block mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
          >
            Volver al Panel Principal
          </Link>
        </div>
      </div>
    );
  }
  
  // Render the appropriate game component based on gameId
  const renderGameComponent = () => {
    if (gameId === 'prisoners-dilemma') {
      return <PrisonersDilemmaGame />;
    }
    
    if (gameId === 'stag-hunt') {
      return <StagHuntGame />;
    }
    
    if (gameId === 'chicken') {
      return <ChickenGame />;
    }
    
    if (gameId === 'travelers-dilemma') {
      return <TravelersDilemmaGame />;
    }
    
    if (gameId === 'battle-of-the-sexes') {
      return <EventCoordinationGame />;
    }
    
    if (gameId === 'matching-pennies') {
      return <MatchingPenniesGame />;
    }

    if (gameId === 'ultimatum-game') {
      return <UltimatumGame />;
    }
    
    if (gameId === 'dictator-game') {
      return <DictatorGame />;
    }

    if (gameId === 'volunteers-dilemma') {
      return <VolunteersDilemmaGame />;
    }
    
    if (gameId === 'centipede-game') {
      return <CentipedeGame />;
    }
    
    if (gameId === 'coordination-game') {
      return <CoordinationGame />;
    }
    
    if (gameId === 'rock-paper-scissors') {
      return <RockPaperScissorsGame />;
    }
    
    if (gameId === 'bertrand-competition') {
      return <BertrandCompetitionGame />;
    }
    
    if (gameId === 'cournot-competition') {
      return <CournotCompetitionGame />;
    }
    
    // Fallback for unrecognized games
    return (
      <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">
          Interfaz de juego para "{gameId}" aún no implementada
        </p>
      </div>
    );
  };
  
  // Tournament waiting screen
  if (isTournament && isWaiting) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen p-8">
          <div className="max-w-4xl mx-auto">
            <header className="mb-8 flex items-center justify-between">
              <h1 className="text-3xl font-bold">Torneo: {currentSession.name}</h1>
              <a 
                href="#"
                onClick={handleReturnToDashboard}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm"
              >
                Volver al Panel Principal
              </a>
            </header>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
              <h2 className="text-xl font-semibold mb-4">Esperando la Siguiente Ronda</h2>
              <p className="mb-4">
                Estás esperando la siguiente ronda del torneo.
                Por favor, espera mientras otros jugadores terminan sus partidas.
              </p>
              
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">Progreso del Torneo</h3>
                <TournamentLeaderboard />
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }
  
  // Tournament mode with active match
  if (isTournament && hasMatch) {
    const opponentId = playerMatch as string;
    const opponent = currentSession.players[opponentId];
    
    return (
      <ProtectedRoute>
        <div className="min-h-screen p-8">
          <div className="max-w-4xl mx-auto">
            <header className="mb-8 flex items-center justify-between">
              <h1 className="text-3xl font-bold">Torneo: {currentSession.name}</h1>
              <a 
                href="#"
                onClick={handleReturnToDashboard}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm"
              >
                Volver al Panel Principal
              </a>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Tu Partida Actual</h2>
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                      Jugando contra {opponent?.displayName || 'Desconocido'}
                    </div>
                  </div>
                  {renderGameComponent()}
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4">Clasificación del Torneo</h2>
                  <TournamentLeaderboard />
                </div>
              </div>
              
              <div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Tu Oponente</h2>
                  <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-800 dark:text-blue-100 mr-3">
                      {opponent?.displayName?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium">{opponent?.displayName || 'Jugador Desconocido'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {currentSession.tournamentResults && currentSession.tournamentResults[opponentId] ? 
                          `Puntuación: ${currentSession.tournamentResults[opponentId].totalScore}` : 
                          'Sin partidas previas'
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4">Información del Juego</h2>
                  <GameInfo />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }
  
  // Regular game mode (not tournament)
  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold">Juego: {currentSession.name}</h1>
            <a 
              href="#"
              onClick={handleReturnToDashboard}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm"
            >
              Volver al Panel Principal
            </a>
          </header>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Tablero de Juego</h2>
                {renderGameComponent()}
              </div>
            </div>
            
            <div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Jugadores</h2>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {players.map((player) => (
                    <li key={player.id} className="py-2 flex items-center">
                      <span className="flex-1">{player.displayName}</span>
                      {player.isHost && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          Anfitrión
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Información del Juego</h2>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">ID de Sesión:</span> {currentSession.id}
                  </p>
                  <p>
                    <span className="font-medium">Iniciado:</span> {new Date(currentSession.createdAt).toLocaleString()}
                  </p>
                  <p>
                    <span className="font-medium">Estado:</span> {currentSession.status}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 