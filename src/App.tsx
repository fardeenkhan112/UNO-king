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
import {
loadProfile,
saveProfile,
loadSoundSetting,
saveSoundSetting,
getClientPlayerId
} from './utils/storage';
import { sound } from './utils/sound';
import { SinglePlayerEngine } from './utils/singlePlayerEngine';
import { ChatPanel } from './components/ChatPanel';
import { VoicePanel } from './components/VoicePanel';
import { WifiOff, Crown } from 'lucide-react';

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
try {
return localStorage.getItem('uno-king-active-room');
} catch {
return null;
}
});

// Networking state
const [isConnected, setIsConnected] = useState<boolean>(false);
const [isJoining, setIsJoining] = useState<boolean>(false);
const [joinError, setJoinError] = useState<string | null>(null);
const [notification, setNotification] = useState<string | null>(null);
const [matchClosedByLeave, setMatchClosedByLeave] = useState(false);

// Refs used to prevent duplicate/racing room joins.
const socketRef = useRef<Socket | null>(null);
const soloEngineRef = useRef<SinglePlayerEngine | null>(null);

const isJoiningRoomRef = useRef(false);
const hasJoinedRoomRef = useRef(false);

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

```
window.setTimeout(() => {
  setNotification((curr) => (curr === msg ? null : curr));
}, 4000);
```

};

// Initialize Socket.io client
useEffect(() => {
const backendUrl = import.meta.env.VITE_SOCKET_URL || undefined;


const socket = io(backendUrl, {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnection: true,
});

socketRef.current = socket;

// ---------------------------------------------------------
// SOCKET CONNECT
// ---------------------------------------------------------
socket.on('connect', () => {
  setIsConnected(true);

  try {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    const normalizedUrlRoom = urlRoom?.trim().toUpperCase();

    // IMPORTANT:
    // Invite-link joining has priority over saved-room reconnect.
    // The actual invite join is handled by the one-time connect
    // listener installed below.
    if (
      normalizedUrlRoom &&
      normalizedUrlRoom.length === 4 &&
      !isSinglePlayer
    ) {
      return;
    }

    const savedRoom = localStorage.getItem('uno-king-active-room');

    // Reconnect to an existing room after refresh or temporary
    // Socket.IO disconnect/reconnect.
    if (
      savedRoom &&
      savedRoom.length === 4 &&
      !isSinglePlayer &&
      !isJoiningRoomRef.current
    ) {
      isJoiningRoomRef.current = true;

      socket.emit('room:reconnect', {
        roomCode: savedRoom.toUpperCase(),
        playerId: getClientPlayerId(),
      });
    }
  } catch {
    // Ignore localStorage / URL errors.
  }
});

socket.on('disconnect', () => {
  setIsConnected(false);
});

// ---------------------------------------------------------
// ROOM CREATED
// ---------------------------------------------------------
socket.on('room:created', ({ roomCode, playerId, state }) => {
  isJoiningRoomRef.current = false;
  hasJoinedRoomRef.current = true;

  setMatchClosedByLeave(false);
  setMyPlayerId(playerId);
  setActiveRoomCode(roomCode);

  try {
    localStorage.setItem('uno-king-active-room', roomCode);
  } catch {}

  setGameState(state);
  setIsSinglePlayer(false);
  setIsJoining(false);
  setJoinError(null);
  setView('lobby');

  // If a stale invite query exists, remove it now.
  try {
    window.history.replaceState({}, '', window.location.pathname);
  } catch {}

  sound.playClick();
});

// ---------------------------------------------------------
// ROOM JOINED
// ---------------------------------------------------------
socket.on('room:joined', ({ roomCode, playerId, state }) => {
  isJoiningRoomRef.current = false;
  hasJoinedRoomRef.current = true;

  setMatchClosedByLeave(false);
  setMyPlayerId(playerId);
  setActiveRoomCode(roomCode);

  try {
    localStorage.setItem('uno-king-active-room', roomCode);

    // Invite link has successfully been consumed.
    // Remove ?room=CODE so a browser refresh does not trigger
    // another invite join.
    window.history.replaceState({}, '', window.location.pathname);
  } catch {}

  setGameState(state);
  setIsSinglePlayer(false);
  setIsJoining(false);
  setJoinError(null);

  setView(state.gameStatus === 'playing' ? 'game' : 'lobby');

  sound.playClick();
});

// ---------------------------------------------------------
// ROOM RECONNECTED
// ---------------------------------------------------------
socket.on('room:reconnected', ({ roomCode, playerId, state }) => {
  isJoiningRoomRef.current = false;
  hasJoinedRoomRef.current = true;

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

// ---------------------------------------------------------
// ROOM ERROR
// ---------------------------------------------------------
socket.on('room:error', ({ message }) => {
  isJoiningRoomRef.current = false;
  hasJoinedRoomRef.current = false;

  setJoinError(message || 'Failed to join room');
  setIsJoining(false);

  showNotification(message || 'Room error occurred');
});

// ---------------------------------------------------------
// PLAYER LEFT
// ---------------------------------------------------------
socket.on(
  'room:playerLeft',
  ({ name, matchEnded }: { name?: string; matchEnded?: boolean }) => {
    const playerName = name || 'A player';

    setMatchClosedByLeave(Boolean(matchEnded));
    showNotification(`${playerName} left the match.`);

    if (matchEnded) {
      window.setTimeout(() => {
        try {
          localStorage.removeItem('uno-king-active-room');
        } catch {}

        hasJoinedRoomRef.current = false;
        isJoiningRoomRef.current = false;

        setGameState(null);
        setActiveRoomCode(null);
        setView('landing');
        setMatchClosedByLeave(false);
      }, 1400);
    }
  }
);

// ---------------------------------------------------------
// GAME STATE
// ---------------------------------------------------------
socket.on('game:state', (updatedState: GameState) => {
  setGameState(updatedState);

  if (updatedState.gameStatus === 'playing' && view !== 'game') {
    setView('game');
  }
});

// ---------------------------------------------------------
// UNO CALL
// ---------------------------------------------------------
socket.on('game:unoCalled', ({ name }) => {
  sound.playUnoCall();
  showNotification(`👑 ${name} called UNO!`);
});

// ---------------------------------------------------------
// GAME ERROR
// ---------------------------------------------------------
socket.on('game:error', ({ message }) => {
  showNotification(message || 'Action cannot be performed');
});

// ---------------------------------------------------------
// INVITE LINK JOIN
// ---------------------------------------------------------
//
// Important:
// We wait for socket connection and then join exactly once.
// This prevents invite-link JOIN and saved-room RECONNECT
// from racing each other.
//
try {
  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room');
  const normalizedRoom = urlRoom?.trim().toUpperCase();

  if (normalizedRoom && normalizedRoom.length === 4) {
    const joinInviteRoom = () => {
      if (
        isJoiningRoomRef.current ||
        hasJoinedRoomRef.current
      ) {
        return;
      }

      isJoiningRoomRef.current = true;

      setIsJoining(true);
      setJoinError(null);

      socket.emit('room:join', {
        roomCode: normalizedRoom,
        playerName: profile.name,
        avatar: profile.avatar,
        playerId: getClientPlayerId(),
      });
    };

    if (socket.connected) {
      joinInviteRoom();
    } else {
      socket.once('connect', joinInviteRoom);
    }
  }
} catch {
  // Ignore invalid URL parameters.
}

return () => {
  socket.removeAllListeners();
  socket.disconnect();
  socketRef.current = null;
};


}, []);

// ---------------------------------------------------------
// UPDATE PROFILE
// ---------------------------------------------------------
const handleSaveProfile = (updated: UserProfile) => {
setProfile(updated);
saveProfile(updated);
showNotification('Profile updated!');
};

// ---------------------------------------------------------
// PLAY NOW - SINGLE PLAYER
// ---------------------------------------------------------
const handleStartSinglePlayer = (
botCount: number,
settings: { stacking: boolean }
) => {
setIsPlayNowOpen(false);


if (soloEngineRef.current) {
  soloEngineRef.current.destroy();
}

// Make sure single-player mode cannot accidentally inherit
// multiplayer join state.
isJoiningRoomRef.current = false;
hasJoinedRoomRef.current = false;

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

// ---------------------------------------------------------
// CREATE ROOM
// ---------------------------------------------------------
const handleCreateRoom = () => {
if (!socketRef.current) return;


// Never create another room while this client is already
// joining or already inside a room.
if (
  isJoiningRoomRef.current ||
  hasJoinedRoomRef.current
) {
  return;
}

isJoiningRoomRef.current = true;
setJoinError(null);

socketRef.current.emit('room:create', {
  playerName: profile.name,
  avatar: profile.avatar,
  playerId: getClientPlayerId(),
  settings: {
    stacking: true,
  },
});


};

// ---------------------------------------------------------
// JOIN ROOM
// ---------------------------------------------------------
const handleJoinRoom = (code: string) => {
if (!socketRef.current) return;


// Prevent double-clicks / double submissions.
if (
  isJoiningRoomRef.current ||
  hasJoinedRoomRef.current
) {
  return;
}

const normalizedCode = code.trim().toUpperCase();

if (normalizedCode.length !== 4) {
  setJoinError('Please enter a valid 4-character room code.');
  return;
}

isJoiningRoomRef.current = true;

setIsJoining(true);
setJoinError(null);

socketRef.current.emit('room:join', {
  roomCode: normalizedCode,
  playerName: profile.name,
  avatar: profile.avatar,
  playerId: getClientPlayerId(),
});


};

// ---------------------------------------------------------
// LOBBY ACTIONS
// ---------------------------------------------------------
const handleAddBot = () => {
if (socketRef.current && hasJoinedRoomRef.current) {
socketRef.current.emit('room:addBot');
}
};

const handleRemoveBot = (botId: string) => {
if (socketRef.current && hasJoinedRoomRef.current) {
socketRef.current.emit('room:removeBot', { botId });
}
};

const handleUpdateSettings = (settings: Partial<GameSettings>) => {
if (socketRef.current && hasJoinedRoomRef.current) {
socketRef.current.emit('room:updateSettings', settings);
}
};

const handleStartGame = () => {
if (socketRef.current && hasJoinedRoomRef.current) {
socketRef.current.emit('room:start');
}
};

// ---------------------------------------------------------
// LEAVE LOBBY
// ---------------------------------------------------------
const handleLeaveLobby = () => {
isJoiningRoomRef.current = false;
hasJoinedRoomRef.current = false;


if (socketRef.current) {
  socketRef.current.emit('room:leave');
}

setGameState(null);
setActiveRoomCode(null);

try {
  localStorage.removeItem('uno-king-active-room');
} catch {}

setJoinError(null);
setIsJoining(false);
setView('landing');


};

// ---------------------------------------------------------
// GAME TABLE ACTIONS
// ---------------------------------------------------------
const handlePlayCard = (
cardId: string,
chosenColor?: CardColor,
calledUnu?: boolean
) => {
if (isSinglePlayer && soloEngineRef.current) {
soloEngineRef.current.playCard(
myPlayerId,
cardId,
chosenColor,
calledUnu
);
} else if (socketRef.current && hasJoinedRoomRef.current) {
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
} else if (socketRef.current && hasJoinedRoomRef.current) {
socketRef.current.emit('game:drawCard');
}
};

const handleCallUnu = () => {
if (isSinglePlayer && soloEngineRef.current) {
soloEngineRef.current.callUno(myPlayerId);
} else if (socketRef.current && hasJoinedRoomRef.current) {
socketRef.current.emit('game:callUno');
}
};

const handleRematch = () => {
if (isSinglePlayer && soloEngineRef.current) {
soloEngineRef.current.rematch();
setGameState({
...soloEngineRef.current.getState(),
});
} else if (socketRef.current && hasJoinedRoomRef.current) {
socketRef.current.emit('game:rematch');
}
};

// ---------------------------------------------------------
// LEAVE GAME
// ---------------------------------------------------------
const handleLeaveGame = () => {
isJoiningRoomRef.current = false;
hasJoinedRoomRef.current = false;


if (isSinglePlayer && soloEngineRef.current) {
  soloEngineRef.current.destroy();
  soloEngineRef.current = null;
} else if (socketRef.current) {
  socketRef.current.emit('room:leave');
}

setGameState(null);
setActiveRoomCode(null);
setIsJoining(false);
setJoinError(null);

try {
  localStorage.removeItem('uno-king-active-room');
} catch {}

setView('landing');


};

return ( <div className="min-h-screen bg-[#080B14] text-white flex flex-col justify-between selection:bg-[#E5A93C] selection:text-black">
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

```
  {/* RECONNECT / DISCONNECTED BANNER */}
  {!isConnected && (
    <div className="w-full bg-rose-600/90 text-white text-xs py-1 px-4 flex items-center justify-center gap-2 font-semibold">
      <WifiOff className="w-3.5 h-3.5" />
      <span>
        Real-time server connecting... (Single player remains playable offline)
      </span>
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

  {/* CHAT + VOICE */}
  {view === 'game' &&
    gameState &&
    socketRef.current &&
    !isSinglePlayer && (
      <>
        <ChatPanel
          socket={socketRef.current}
          myPlayerId={myPlayerId}
          players={gameState.players}
        />

        <VoicePanel
          socket={socketRef.current}
          myPlayerId={myPlayerId}
          players={gameState.players}
        />
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

  {/* 5. Game Result Modal */}
  {gameState &&
    gameState.gameStatus === 'finished' &&
    !matchClosedByLeave && (
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

            hasJoinedRoomRef.current = false;
            isJoiningRoomRef.current = false;

            setGameState(null);
            setView('landing');
            setIsPlayNowOpen(true);
          } else {
            hasJoinedRoomRef.current = false;
            isJoiningRoomRef.current = false;

            if (socketRef.current) {
              socketRef.current.emit('room:leave');
            }

            try {
              localStorage.removeItem('uno-king-active-room');
            } catch {}

            setGameState(null);
            setView('landing');

            // Give the socket/room leave event a moment to complete
            // before allowing a brand-new room to be created.
            window.setTimeout(() => {
              handleCreateRoom();
            }, 100);
          }
        }}
        onLeave={handleLeaveGame}
      />
    )}
</div>
);
}
