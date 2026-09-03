import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { GameTable } from './components/GameTable';
import { PlayNowModal } from './components/PlayNowModal';
import { QrModal } from './components/QrModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { ProfileModal } from './components/ProfileModal';
import { GameResultModal } from './components/GameResultModal';
import { GameState, UserProfile, CardColor, GameSettings } from './types';
import { loadProfile, saveProfile, loadSoundSetting, saveSoundSetting, getClientPlayerId } from './utils/storage';
import { sound } from './utils/sound';
import { SinglePlayerEngine } from './utils/singlePlayerEngine';
import { ChatPanel } from './components/ChatPanel';
import { VoicePanel } from './components/VoicePanel';
import { AlertCircle, WifiOff, Crown } from 'lucide-react';

type AppView = 'landing' | 'lobby' | 'game';

export default function App() {
  // User profile & preferences
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(loadSoundSetting);

  // Screen View
  const [view, setView] = useState<AppView>('landing');
  const [isSinglePlayer, setIsSinglePlayer] = useState<boolean>(false);

  // Modals
  const [isPlayNowOpen, setIsPlayNowOpen] = useState<boolean>(false);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);

  // Real-time game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>(() => getClientPlayerId());
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(() => {
    try { return localStorage.getItem('uno-king-active-room'); } catch { return null; }
  });

  // Networking state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [matchClosedByLeave, setMatchClosedByLeave] = useState(false);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const soloEngineRef = useRef<SinglePlayerEngine | null>(null);

  // Sync sound setting
  useEffect(() => {
    sound.setSoundEnabled(soundEnabled);
    saveSoundSetting(soundEnabled);
  }, [soundEnabled]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sound.setSoundEnabled(next);
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Initialize Socket.io client
  useEffect(() => {
    // Backend URL: set VITE_SOCKET_URL in your .env / Netlify env vars.
    // Falls back to same-origin (useful for local dev with the combined server).
    const backendUrl = import.meta.env.VITE_SOCKET_URL || undefined;
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      try {
        const savedRoom = localStorage.getItem('uno-king-active-room');
        if (savedRoom && !isSinglePlayer) {
          socket.emit('room:reconnect', { roomCode: savedRoom, playerId: getClientPlayerId() });
        }
      } catch {}
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('room:created', ({ roomCode, playerId, state }) => {
      setMatchClosedByLeave(false);
      setMyPlayerId(playerId);
      setActiveRoomCode(roomCode);
      try { localStorage.setItem('uno-king-active-room', roomCode); } catch {}
      setGameState(state);
      setIsSinglePlayer(false);
      setView('lobby');
      sound.playClick();
    });

    socket.on('room:joined', ({ roomCode, playerId, state }) => {
      setMatchClosedByLeave(false);
      setMyPlayerId(playerId);
      setActiveRoomCode(roomCode);
      try { localStorage.setItem('uno-king-active-room', roomCode); } catch {}
      setGameState(state);
      setIsSinglePlayer(false);
      setIsJoining(false);
      setJoinError(null);
      setView(state.gameStatus === 'playing' ? 'game' : 'lobby');
      sound.playClick();
    });

    socket.on('room:reconnected', ({ roomCode, playerId, state }) => {
      setMatchClosedByLeave(false);
      setMyPlayerId(playerId);
      setActiveRoomCode(roomCode);
      setGameState(state);
      setIsSinglePlayer(false);
      setIsJoining(false);
      setJoinError(null);
      setView(state.gameStatus === 'playing' ? 'game' : 'lobby');
      showNotification('Reconnected to your match!');
    });

    socket.on('room:error', ({ message }) => {
      setJoinError(message || 'Failed to join room');
      setIsJoining(false);
      showNotification(message || 'Room error occurred');
    });

    socket.on('room:playerLeft', ({ name, matchEnded }: { name?: string; matchEnded?: boolean }) => {
      const playerName = name || 'A player';
      setMatchClosedByLeave(Boolean(matchEnded));
      showNotification(`${playerName} left the match.`);
      if (matchEnded) {
        window.setTimeout(() => {
          try { localStorage.removeItem('uno-king-active-room'); } catch {}
          setGameState(null);
          setActiveRoomCode(null);
          setView('landing');
          setMatchClosedByLeave(false);
        }, 1400);
      }
    });

    socket.on('game:state', (updatedState: GameState) => {
      setGameState(updatedState);
      if (updatedState.gameStatus === 'playing' && view !== 'game') {
        setView('game');
      }
    });


    socket.on('game:unoCalled', ({ name }) => {
      sound.playUnoCall();
      showNotification(`👑 ${name} called UNO!`);
    });

    socket.on('game:error', ({ message }) => {
      showNotification(message || 'Action cannot be performed');
    });

    // Handle URL ?room=CODE invite link on page load
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom && urlRoom.length === 4) {
        socket.emit('room:join', {
          roomCode: urlRoom.toUpperCase(),
          playerName: profile.name,
          avatar: profile.avatar,
          playerId: getClientPlayerId(),
        });
        setIsJoining(true);
      }
    } catch {
      // ignore
    }

    return () => {
      socket.disconnect();
    };
  }, []);

  // Update profile
  const handleSaveProfile = (updated: UserProfile) => {
    setProfile(updated);
    saveProfile(updated);
    showNotification('Profile updated!');
  };

  // 1. PLAY NOW (Single Player Bot Match)
  const handleStartSinglePlayer = (
    botCount: number,
    settings: { stacking: boolean }
  ) => {
    setIsPlayNowOpen(false);
    if (soloEngineRef.current) {
      soloEngineRef.current.destroy();
    }

    setIsSinglePlayer(true);
    setMyPlayerId('player-local');

    const gameSettings: GameSettings = {
      stacking: settings.stacking,
    };

    const engine = new SinglePlayerEngine(
      profile.name,
      profile.avatar,
      botCount,
      gameSettings,
      {
        onStateUpdate: (updatedState) => {
          setGameState(updatedState);
        },
        onUnoCalled: (player) => {
          sound.playUnoCall();
          showNotification(`👑 ${player.name} called UNO!`);
        },
        onUnuCalled: (player) => {
          sound.playUnoCall();
          showNotification(`👑 ${player.name} called UNO!`);
        },
      }
    );

    soloEngineRef.current = engine;
    setGameState(engine.getState());
    setView('game');
  };

  // 2. CREATE ROOM (Multiplayer) - 1-Click Instant Room Creation
  const handleCreateRoom = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('room:create', {
      playerName: profile.name,
      avatar: profile.avatar,
      playerId: getClientPlayerId(),
      settings: {
        stacking: true,
      },
    });
  };

  // 3. JOIN ROOM (from Landing input or Link)
  const handleJoinRoom = (code: string) => {
    if (!socketRef.current) return;
    setIsJoining(true);
    setJoinError(null);
    socketRef.current.emit('room:join', {
      roomCode: code.toUpperCase(),
      playerName: profile.name,
      avatar: profile.avatar,
      playerId: getClientPlayerId(),
    });
  };

  // LOBBY ACTIONS
  const handleAddBot = () => {
    if (socketRef.current) {
      socketRef.current.emit('room:addBot');
    }
  };

  const handleRemoveBot = (botId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('room:removeBot', { botId });
    }
  };

  const handleUpdateSettings = (settings: Partial<GameSettings>) => {
    if (socketRef.current) {
      socketRef.current.emit('room:updateSettings', settings);
    }
  };

  const handleStartGame = () => {
    if (socketRef.current) {
      socketRef.current.emit('room:start');
    }
  };

  const handleLeaveLobby = () => {
    if (socketRef.current) {
      socketRef.current.emit('room:leave');
    }
    setGameState(null);
    setActiveRoomCode(null);
    try { localStorage.removeItem('uno-king-active-room'); } catch {}
    setView('landing');
  };

  // GAME TABLE ACTIONS
  const handlePlayCard = (
    cardId: string,
    chosenColor?: CardColor,
    calledUnu?: boolean
  ) => {
    if (isSinglePlayer && soloEngineRef.current) {
      soloEngineRef.current.playCard(myPlayerId, cardId, chosenColor, calledUnu);
    } else if (socketRef.current) {
      socketRef.current.emit('game:playCard', {
        cardId,
        chosenColor,
        calledUnu,
      });
    }
  };

  const handleDrawCard = () => {
    if (isSinglePlayer && soloEngineRef.current) {
      soloEngineRef.current.drawCard(myPlayerId);
    } else if (socketRef.current) {
      socketRef.current.emit('game:drawCard');
    }
  };

  const handleCallUnu = () => {
    if (isSinglePlayer && soloEngineRef.current) {
      soloEngineRef.current.callUno(myPlayerId);
    } else if (socketRef.current) {
      socketRef.current.emit('game:callUno');
    }
  };

  const handleRematch = () => {
    if (isSinglePlayer && soloEngineRef.current) {
      soloEngineRef.current.rematch();
      setGameState({ ...soloEngineRef.current.getState() });
    } else if (socketRef.current) {
      socketRef.current.emit('game:rematch');
    }
  };

  const handleLeaveGame = () => {
    if (isSinglePlayer && soloEngineRef.current) {
      soloEngineRef.current.destroy();
      soloEngineRef.current = null;
    } else if (socketRef.current) {
      socketRef.current.emit('room:leave');
    }
    setGameState(null);
    setActiveRoomCode(null);
    try { localStorage.removeItem('uno-king-active-room'); } catch {}
    setView('landing');
  };

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex flex-col justify-between selection:bg-[#E5A93C] selection:text-black">
      {/* GLOBAL NAVBAR */}
      <Navbar
        profile={profile}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onLogoClick={() => {
          if (view !== 'landing') {
            handleLeaveGame();
          }
        }}
      />

      {/* RECONNECT / DISCONNECTED BANNER */}
      {!isConnected && (
        <div className="w-full bg-rose-600/90 text-white text-xs py-1 px-4 flex items-center justify-center gap-2 font-semibold">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Real-time server connecting... (Single player remains playable offline)</span>
        </div>
      )}

      {/* FLOATING ACTION TOAST NOTIFICATION */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0F1424]/95 border border-[#E5A93C]/50 text-white text-xs font-semibold shadow-2xl backdrop-blur-md animate-fade-in">
          <Crown className="w-4 h-4 text-[#E5A93C]" />
          <span>{notification}</span>
        </div>
      )}

      {/* MAIN SCREEN ROUTER */}
      <main className="flex-1 w-full">
        {view === 'landing' && (
          <LandingPage
            onPlayNow={() => setIsPlayNowOpen(true)}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            joinError={joinError}
            isJoining={isJoining}
          />
        )}

        {view === 'lobby' && gameState && (
          <MultiplayerLobby
            gameState={gameState}
            currentPlayerId={myPlayerId}
            onAddBot={handleAddBot}
            onRemoveBot={handleRemoveBot}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveLobby}
            onOpenQr={() => setIsQrOpen(true)}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {view === 'game' && gameState && (
          <GameTable
            gameState={gameState}
            currentPlayerId={myPlayerId}
            onPlayCard={handlePlayCard}
            onDrawCard={handleDrawCard}
            onCallUnu={handleCallUnu}
            onLeaveGame={handleLeaveGame}
            socket={socketRef.current}
          />
        )}
      </main>

      {view === 'game' && gameState && socketRef.current && !isSinglePlayer && (
        <>
          <ChatPanel socket={socketRef.current} myPlayerId={myPlayerId} players={gameState.players} />
          <VoicePanel socket={socketRef.current} myPlayerId={myPlayerId} players={gameState.players} />
        </>
      )}

      {/* MODALS */}

      {/* 1. Play Now AI Selection Modal */}
      <PlayNowModal
        isOpen={isPlayNowOpen}
        onClose={() => setIsPlayNowOpen(false)}
        onStartMatch={handleStartSinglePlayer}
      />

      {/* 2. QR Code Modal */}
      {gameState && (
        <QrModal
          isOpen={isQrOpen}
          onClose={() => setIsQrOpen(false)}
          roomCode={gameState.roomCode}
        />
      )}

      {/* 3. Rules / How to Play Modal */}
      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />

      {/* 4. Guest Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onSave={handleSaveProfile}
      />

      {/* 5. Game Result Modal (Crown Claimed / Standings) */}
      {gameState && gameState.gameStatus === 'finished' && !matchClosedByLeave && (
        <GameResultModal
          gameState={gameState}
          currentPlayerId={myPlayerId}
          onRematch={handleRematch}
          onNewGame={() => {
            if (isSinglePlayer) {
              if (soloEngineRef.current) {
                soloEngineRef.current.destroy();
                soloEngineRef.current = null;
              }
              setGameState(null);
              setView('landing');
              setIsPlayNowOpen(true);
            } else {
              if (socketRef.current) {
                socketRef.current.emit('room:leave');
              }
              setGameState(null);
              setView('landing');
              handleCreateRoom();
            }
          }}
          onLeave={handleLeaveGame}
        />
      )}
    </div>
  );
}
