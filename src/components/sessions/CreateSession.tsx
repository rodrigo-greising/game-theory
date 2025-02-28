'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { getGameOptions } from '@/games/gameRegistry';
import { GameOption } from '@/types/games';
import { 
  Users, 
  Award, 
  AlertTriangle, 
  TrendingUp, 
  Handshake, 
  GitMerge,
  Scissors,
  Zap,
  BarChart,
  LucideIcon 
} from 'lucide-react';

interface CreateSessionProps {
  onSessionCreated?: (sessionId: string) => void;
}

// Game icon mapping
const gameIcons: Record<string, React.ReactNode> = {
  'prisoners-dilemma': <GitMerge className="w-6 h-6" />,
  'stag-hunt': <Handshake className="w-6 h-6" />,
  'chicken': <AlertTriangle className="w-6 h-6" />,
  'battle-of-sexes': <TrendingUp className="w-6 h-6" />,
  'matching-pennies': <Award className="w-6 h-6" />,
  'ultimatum-game': <Users className="w-6 h-6" />,
  'dictator-game': <Award className="w-6 h-6" />,
  'public-goods-game': <Users className="w-6 h-6" />,
  'centipede-game': <GitMerge className="w-6 h-6" />,
  'travelers-dilemma': <TrendingUp className="w-6 h-6" />,
  'coordination-game': <Handshake className="w-6 h-6" />,
  'volunteers-dilemma': <Users className="w-6 h-6" />,
  'rock-paper-scissors': <Scissors className="w-6 h-6" />,
  'bertrand-competition': <BarChart className="w-6 h-6" />,
  'cournot-competition': <Zap className="w-6 h-6" />,
  // Default icon for any new games
  'default': <GitMerge className="w-6 h-6" />
};

const CreateSession: React.FC<CreateSessionProps> = ({ onSessionCreated }) => {
  const [sessionName, setSessionName] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);
  const [isTournament, setIsTournament] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createSession } = useSession();
  
  // Load available games
  useEffect(() => {
    const options = getGameOptions();
    setGameOptions(options);
    
    // Default to Prisoner's Dilemma
    const prisonersDilemma = options.find(game => game.id === 'prisoners-dilemma');
    if (prisonersDilemma) {
      setSelectedGameId(prisonersDilemma.id);
      setSelectedGame(prisonersDilemma);
    } else if (options.length > 0) {
      // Fallback to the first game if Prisoner's Dilemma is not available
      setSelectedGameId(options[0].id);
      setSelectedGame(options[0]);
    }
  }, []);
  
  // Update selected game details when game changes
  useEffect(() => {
    const game = gameOptions.find(game => game.id === selectedGameId) || null;
    setSelectedGame(game);
  }, [selectedGameId, gameOptions]);
  
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionName.trim()) {
      setError('Please enter a session name');
      return;
    }
    
    if (!selectedGameId) {
      setError('Please select a game');
      return;
    }
    
    setIsCreating(true);
    setError(null);
    
    try {
      const sessionId = await createSession(sessionName, selectedGameId, isTournament);
      setSessionName('');
      setIsTournament(false);
      
      if (onSessionCreated) {
        onSessionCreated(sessionId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  // Helper to get game icon
  const getGameIcon = (gameId: string) => {
    return gameIcons[gameId] || gameIcons['default'];
  };
  
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-white">Create New Session</h3>
      
      <form onSubmit={handleCreateSession}>
        <div className="mb-4">
          <label htmlFor="sessionName" className="block text-sm font-medium text-gray-300 mb-1">
            Session Name
          </label>
          <input
            type="text"
            id="sessionName"
            className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 bg-gray-700 text-white"
            placeholder="Enter a name for your game session"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            disabled={isCreating}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Game
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
            {gameOptions.map(game => (
              <div 
                key={game.id}
                className={`
                  border rounded-lg p-3 cursor-pointer transition-colors
                  ${selectedGameId === game.id 
                    ? 'bg-purple-700/30 border-purple-500' 
                    : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'}
                `}
                onClick={() => setSelectedGameId(game.id)}
              >
                <div className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center mr-3
                    ${selectedGameId === game.id ? 'bg-purple-600' : 'bg-gray-600'}
                  `}>
                    {getGameIcon(game.id)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <input 
                        type="radio" 
                        name="gameOption" 
                        id={`game-${game.id}`}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                        checked={selectedGameId === game.id}
                        onChange={() => setSelectedGameId(game.id)}
                      />
                      <label htmlFor={`game-${game.id}`} className="ml-2 text-sm font-medium text-white truncate">
                        {game.name}
                      </label>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {game.minPlayers === game.maxPlayers 
                        ? `${game.minPlayers} players` 
                        : `${game.minPlayers}-${game.maxPlayers} players`
                      }
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="tournamentMode"
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              checked={isTournament}
              onChange={(e) => setIsTournament(e.target.checked)}
            />
            <label htmlFor="tournamentMode" className="ml-2 block text-sm text-gray-300">
              Create as Tournament (Classroom Mode)
            </label>
          </div>
          {isTournament && (
            <p className="mt-2 text-xs text-gray-400">
              Tournament mode will randomly pair players and track results across all matches.
              Great for classrooms or large groups!
            </p>
          )}
        </div>
        
        {/* Game Description and Rules */}
        {selectedGame && (
          <div className="mb-6 p-4 bg-gray-700 rounded-lg">
            <h4 className="font-medium text-purple-400 mb-2">{selectedGame.name}</h4>
            <p className="text-sm text-gray-300 mb-3">{selectedGame.description}</p>
            <div className="text-xs text-gray-400">
              {isTournament ? (
                <span>Tournament mode: Players will be paired randomly</span>
              ) : (
                <span>
                  Players: {selectedGame.minPlayers === selectedGame.maxPlayers 
                    ? `Exactly ${selectedGame.minPlayers}` 
                    : `${selectedGame.minPlayers}-${selectedGame.maxPlayers}`
                  }
                </span>
              )}
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 text-sm text-red-400 p-3 bg-red-900 bg-opacity-30 rounded-md">
            {error}
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isCreating || gameOptions.length === 0}
          >
            {isCreating ? (
              <span className="flex items-center">
                <span className="mr-2">Creating...</span>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            ) : 'Create Session'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateSession; 