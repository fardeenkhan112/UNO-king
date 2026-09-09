import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  io,
  Socket,
} from 'socket.io-client';

import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { GameTable } from './components/GameTable';
import { PlayNowModal } from './components/PlayNowModal';
import { QrModal } from './components/QrModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { ProfileModal } from './components/ProfileModal';
import { GameResultModal } from './components/GameResultModal';
import { ChatPanel } from './components/ChatPanel';
import { VoicePanel } from './components/VoicePanel';

import {
  GameState,
  UserProfile,
  CardColor,
  GameSettings,
} from './types';

import {
  loadProfile,
  saveProfile,
  loadSoundSetting,
  saveSoundSetting,
  getClientPlayerId,
} from './utils/storage';

import { sound } from './utils/sound';
import { SinglePlayerEngine } from './utils/singlePlayerEngine';

import {
  WifiOff,
  Crown,
  Trophy,
  Medal,
} from 'lucide-react';

type AppView =
  | 'landing'
  | 'lobby'
  | 'game';

export default function App() {
  // ---------------------------------------------------------
  // USER PROFILE & PREFERENCES
  // ---------------------------------------------------------

  const [profile, setProfile] =
    useState<UserProfile>(
      loadProfile,
    );

  const [soundEnabled, setSoundEnabled] =
    useState<boolean>(
      loadSoundSetting,
    );

  // ---------------------------------------------------------
  // SCREEN VIEW
  // ---------------------------------------------------------

  const [view, setView] =
    useState<AppView>(
      'landing',
    );

  const [isSinglePlayer, setIsSinglePlayer] =
    useState<boolean>(
      false,
    );

  // Refs prevent stale values inside long-lived socket listeners.
  const isSinglePlayerRef =
    useRef(false);

  const profileRef =
    useRef(profile);

  useEffect(() => {
    isSinglePlayerRef.current =
      isSinglePlayer;
  }, [isSinglePlayer]);

  useEffect(() => {
    profileRef.current =
      profile;
  }, [profile]);

  // ---------------------------------------------------------
  // MODALS
  // ---------------------------------------------------------

  const [isPlayNowOpen, setIsPlayNowOpen] =
    useState<boolean>(
      false,
    );

  const [isQrOpen, setIsQrOpen] =
    useState<boolean>(
      false,
    );

  const [isHowToPlayOpen, setIsHowToPlayOpen] =
    useState<boolean>(
      false,
    );

  const [isProfileOpen, setIsProfileOpen] =
    useState<boolean>(
      false,
    );

  // ---------------------------------------------------------
  // REAL-TIME GAME STATE
  // ---------------------------------------------------------

  const [gameState, setGameState] =
    useState<GameState | null>(
      null,
    );

  const [myPlayerId, setMyPlayerId] =
    useState<string>(
      () => getClientPlayerId(),
    );

  const [activeRoomCode, setActiveRoomCode] =
    useState<string | null>(() => {
      try {
        return sessionStorage.getItem(
          'uno-king-active-room',
        );
      } catch {
        return null;
      }
    });

  // ---------------------------------------------------------
  // NETWORKING STATE
  // ---------------------------------------------------------

  const [isConnected, setIsConnected] =
    useState<boolean>(
      false,
    );

  const [isJoining, setIsJoining] =
    useState<boolean>(
      false,
    );

  const [joinError, setJoinError] =
    useState<string | null>(
      null,
    );

  const [notification, setNotification] =
    useState<string | null>(
      null,
    );


  const [matchClosedByLeave, setMatchClosedByLeave] =
    useState(false);

  // ---------------------------------------------------------
  // REFS
  // ---------------------------------------------------------

  const socketRef =
    useRef<Socket | null>(
      null,
    );

  const soloEngineRef =
    useRef<SinglePlayerEngine | null>(
      null,
    );

  const isJoiningRoomRef =
    useRef(false);

  const hasJoinedRoomRef =
    useRef(false);

  const notificationTimeoutRef =
    useRef<number | null>(
      null,
    );

  const winnerAlertTimeoutRef =
    useRef<number | null>(null);

  const [winnerAlertQueue, setWinnerAlertQueue] =
    useState<Array<{ name: string; avatar: string; place: number }>>([]);
  const winnerAlertBaselineRef = useRef(false);
  const seenPlacementsRef = useRef<Set<string>>(new Set());

  // ---------------------------------------------------------
  // SOUND
  // ---------------------------------------------------------

  useEffect(() => {
    sound.setSoundEnabled(
      soundEnabled,
    );

    saveSoundSetting(
      soundEnabled,
    );
  }, [soundEnabled]);

  const handleToggleSound = () => {
    const next =
      !soundEnabled;

    setSoundEnabled(next);
    sound.setSoundEnabled(next);
  };

  // ---------------------------------------------------------
  // NOTIFICATION
  // ---------------------------------------------------------

  const applyGameState = (updatedState: GameState) => {
    const rankings = updatedState.rankings || [];

    // Establish a quiet baseline when first entering/reconnecting to a room.
    // This prevents refresh/reconnect from replaying old finish alerts.
    if (!winnerAlertBaselineRef.current) {
      rankings.forEach((player) => {
        if (player.placement) seenPlacementsRef.current.add(player.id);
      });
      winnerAlertBaselineRef.current = true;
    } else if (rankings.length === 0 && updatedState.gameStatus !== 'finished') {
      seenPlacementsRef.current.clear();
    }

    const newlyPlacedPlayers = rankings
      .filter((player) => player.placement && !seenPlacementsRef.current.has(player.id))
      .sort((a, b) => (a.placement || 999) - (b.placement || 999));

    const newPlacements = newlyPlacedPlayers.map((player) => ({
      name: player.name,
      avatar: player.avatar || '👑',
      place: player.placement || 1,
    }));

    newlyPlacedPlayers.forEach((player) => seenPlacementsRef.current.add(player.id));

    if (newPlacements.length) {
      setWinnerAlertQueue((current) => [...current, ...newPlacements]);
    }

    setGameState(updatedState);
  };

  const winnerAlert = winnerAlertQueue[0] || null;

  useEffect(() => {
    if (!winnerAlert) return;

    sound.playWinnerAlert();
    if (winnerAlertTimeoutRef.current !== null) {
      window.clearTimeout(winnerAlertTimeoutRef.current);
    }
    winnerAlertTimeoutRef.current = window.setTimeout(() => {
      setWinnerAlertQueue((queue) => queue.slice(1));
    }, 3600);

    return () => {
      if (winnerAlertTimeoutRef.current !== null) {
        window.clearTimeout(winnerAlertTimeoutRef.current);
      }
    };
  }, [winnerAlert]);

  const showNotification = (
    msg: string,
  ) => {
    setNotification(msg);

    if (
      notificationTimeoutRef.current !==
      null
    ) {
      window.clearTimeout(
        notificationTimeoutRef.current,
      );
    }

    notificationTimeoutRef.current =
      window.setTimeout(() => {
        setNotification(
          (current) =>
            current === msg
              ? null
              : current,
        );
      }, 4000);
  };

  // ---------------------------------------------------------
  // SOCKET INITIALIZATION
  // ---------------------------------------------------------

  useEffect(() => {
    const backendUrl =
      import.meta.env
        .VITE_SOCKET_URL ||
      undefined;

  const socket = io(
  backendUrl,
  {
   transports: ['polling'],
reconnectionAttempts: Infinity,
reconnection: true,
reconnectionDelay: 1000,
reconnectionDelayMax: 5000,
  },
);

    socketRef.current =
      socket;

    // ---------------------------------------------------------
    // SOCKET CONNECT
    // ---------------------------------------------------------

    socket.on(
      'connect',
      () => {
        setIsConnected(true);

        try {
          const params =
            new URLSearchParams(
              window.location.search,
            );

          const urlRoom =
            params.get('room');

          const normalizedUrlRoom =
            urlRoom
              ?.trim()
              .toUpperCase();

          // Invite links always take priority.
          if (
            normalizedUrlRoom &&
            normalizedUrlRoom.length === 4 &&
            !isSinglePlayerRef.current
          ) {
            return;
          }

          const savedRoom =
            sessionStorage.getItem(
              'uno-king-active-room',
            );

          if (
            savedRoom &&
            savedRoom.length === 4 &&
            !isSinglePlayerRef.current &&
            !isJoiningRoomRef.current &&
            !hasJoinedRoomRef.current
          ) {
            isJoiningRoomRef.current =
              true;

            socket.emit(
              'room:reconnect',
              {
                roomCode:
                  savedRoom
                    .toUpperCase(),
                playerId:
                  getClientPlayerId(),
              },
            );
          }
        } catch {
          // Ignore localStorage / URL errors.
        }
      },
    );

    // ---------------------------------------------------------
    // SOCKET DISCONNECT
    // ---------------------------------------------------------

   socket.on(
  'disconnect',
  () => {
    setIsConnected(false);

    // The socket connection is gone, so the next
    // successful connection must attempt room recovery.
    if (
      activeRoomCode ||
      hasJoinedRoomRef.current
    ) {
      hasJoinedRoomRef.current = false;
      isJoiningRoomRef.current = false;
    }
  },
);

    // ---------------------------------------------------------
    // ROOM CREATED
    // ---------------------------------------------------------

    socket.on(
      'room:created',
      ({
        roomCode,
        playerId,
        state,
      }) => {
        isJoiningRoomRef.current =
          false;

        hasJoinedRoomRef.current =
          true;

        setMatchClosedByLeave(false);

        setMyPlayerId(
          playerId,
        );

        setActiveRoomCode(
          roomCode,
        );

        try {
          sessionStorage.setItem(
            'uno-king-active-room',
            roomCode,
          );
        } catch {}

        setGameState(
          state,
        );

        setIsSinglePlayer(
          false,
        );

        setIsJoining(
          false,
        );

        setJoinError(
          null,
        );

        setView(
          'lobby',
        );

        try {
          window.history.replaceState(
            {},
            '',
            window.location.pathname,
          );
        } catch {}

        sound.playClick();
      },
    );

    // ---------------------------------------------------------
    // ROOM JOINED
    // ---------------------------------------------------------

    socket.on(
      'room:joined',
      ({
        roomCode,
        playerId,
        state,
      }) => {
        isJoiningRoomRef.current =
          false;

        hasJoinedRoomRef.current =
          true;

        setMatchClosedByLeave(false);

        setMyPlayerId(
          playerId,
        );

        setActiveRoomCode(
          roomCode,
        );

        try {
          sessionStorage.setItem(
            'uno-king-active-room',
            roomCode,
          );

          window.history.replaceState(
            {},
            '',
            window.location.pathname,
          );
        } catch {}

        setGameState(
          state,
        );

        setIsSinglePlayer(
          false,
        );

        setIsJoining(
          false,
        );

        setJoinError(
          null,
        );

        setView(
          state.gameStatus ===
            'playing'
            ? 'game'
            : 'lobby',
        );

        sound.playClick();
      },
    );

    // ---------------------------------------------------------
    // ROOM RECONNECTED
    // ---------------------------------------------------------

    socket.on(
      'room:reconnected',
      ({
        roomCode,
        playerId,
        state,
      }) => {
        isJoiningRoomRef.current =
          false;

        hasJoinedRoomRef.current =
          true;

        setMatchClosedByLeave(false);

        setMyPlayerId(
          playerId,
        );

        setActiveRoomCode(
          roomCode,
        );

        setGameState(
          state,
        );

        setIsSinglePlayer(
          false,
        );

        setIsJoining(
          false,
        );

        setJoinError(
          null,
        );

        setView(
          state.gameStatus ===
            'playing'
            ? 'game'
            : 'lobby',
        );

        showNotification(
          'Reconnected to your match!',
        );
      },
    );

    // ---------------------------------------------------------
    // ROOM ERROR
    // ---------------------------------------------------------

    socket.on(
      'room:error',
      ({
        message,
      }) => {
        isJoiningRoomRef.current =
          false;

        hasJoinedRoomRef.current =
          false;

        setJoinError(
          message ||
            'Failed to join room',
        );

        setIsJoining(
          false,
        );

        showNotification(
          message ||
            'Room error occurred',
        );
      },
    );

    // ---------------------------------------------------------
    // PLAYER LEFT
    // ---------------------------------------------------------

    socket.on(
      'room:playerLeft',
      ({
        name,
        matchEnded,
      }: {
        name?: string;
        matchEnded?: boolean;
      }) => {
        const playerName =
          name ||
          'A player';

        setMatchClosedByLeave(
          Boolean(matchEnded),
        );

        showNotification(
          `${playerName} left the match.`,
        );

        if (
          matchEnded
        ) {
          window.setTimeout(
            () => {
              try {
                sessionStorage.removeItem(
                  'uno-king-active-room',
                );
              } catch {}

              hasJoinedRoomRef.current =
                false;

              isJoiningRoomRef.current =
                false;

              setGameState(
                null,
              );

              setActiveRoomCode(
                null,
              );

              setView(
                'landing',
              );

              setMatchClosedByLeave(
                false,
              );
            },
            1400,
          );
        }
      },
    );

    // ---------------------------------------------------------
    // GAME STATE
    // ---------------------------------------------------------

    socket.on(
      'game:state',
      (
        updatedState: GameState,
      ) => {
        applyGameState(updatedState);

        if (
          updatedState.gameStatus ===
            'playing'
        ) {
          setView(
            'game',
          );
        }
      },
    );

    // ---------------------------------------------------------
    // UNO CALL
    // ---------------------------------------------------------

    socket.on(
      'game:unoCalled',
      ({
        name,
      }) => {
        sound.playUnoCall();

        showNotification(
          `👑 ${name} called UNO!`,
        );
      },
    );

    // ---------------------------------------------------------
    // GAME ERROR
    // ---------------------------------------------------------

    socket.on(
      'game:error',
      ({
        message,
      }) => {
        showNotification(
          message ||
            'Action cannot be performed',
        );
      },
    );

           // ---------------------------------------------------------
    // INVITE LINK AUTO JOIN
    // ---------------------------------------------------------
    // A real invite link opens directly into the room.
    // The page must be visible before joining so hidden/preloaded
    // pages do not create phantom players.

    try {
      const params =
        new URLSearchParams(
          window.location.search,
        );

      const urlRoom =
        params.get('room');

      const normalizedRoom =
        urlRoom
          ?.trim()
          .toUpperCase();

      if (
        normalizedRoom &&
        normalizedRoom.length === 4 &&
        !isSinglePlayerRef.current
      ) {
        const inviteJoinKey =
          `uno-king-invite-joined-${normalizedRoom}`;

        const joinInviteRoom =
          () => {
            if (
              document.visibilityState !==
              'visible'
            ) {
              return;
            }

            if (
              isJoiningRoomRef.current ||
              hasJoinedRoomRef.current ||
              isSinglePlayerRef.current
            ) {
              return;
            }

            let alreadyAttempted =
              false;

            try {
              alreadyAttempted =
                sessionStorage.getItem(
                  inviteJoinKey,
                ) === '1';
            } catch {}

            if (
              alreadyAttempted
            ) {
              return;
            }

            isJoiningRoomRef.current =
              true;

            setIsJoining(
              true,
            );

            setJoinError(
              null,
            );

            socket.emit(
              'room:join',
              {
                roomCode:
                  normalizedRoom,

                playerName:
                  profileRef.current.name,

                avatar:
                  profileRef.current.avatar,

                playerId:
                  getClientPlayerId(),
              },
            );
          };

        const tryJoinWhenReady =
          () => {
            if (
              document.visibilityState ===
              'visible'
            ) {
              joinInviteRoom();
            }
          };

        if (
          socket.connected
        ) {
          tryJoinWhenReady();
        } else {
          socket.once(
            'connect',
            tryJoinWhenReady,
          );
        }

        document.addEventListener(
          'visibilitychange',
          tryJoinWhenReady,
        );
      }
    } catch {
      // Ignore invalid invite URLs.
    }

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------

    return () => {
      socket.removeAllListeners();
      socket.disconnect();

      socketRef.current =
        null;

      if (
        notificationTimeoutRef.current !==
        null
      ) {
        window.clearTimeout(
          notificationTimeoutRef.current,
        );

        notificationTimeoutRef.current =
          null;
      }

      if (winnerAlertTimeoutRef.current !== null) {
        window.clearTimeout(winnerAlertTimeoutRef.current);
        winnerAlertTimeoutRef.current = null;
      }
    };
}, []);
  // ---------------------------------------------------------
  // UPDATE PROFILE
  // ---------------------------------------------------------

  const handleSaveProfile = (
    updated: UserProfile,
  ) => {
    setProfile(
      updated,
    );

    saveProfile(
      updated,
    );

    showNotification(
      'Profile updated!',
    );
  };

  // ---------------------------------------------------------
  // PLAY NOW - SINGLE PLAYER
  // ---------------------------------------------------------

  const handleStartSinglePlayer = (
    botCount: number,
    settings: {
      stacking: boolean;
    },
  ) => {
    setIsPlayNowOpen(
      false,
    );

    if (
      soloEngineRef.current
    ) {
      soloEngineRef.current.destroy();
    }

    isJoiningRoomRef.current =
      false;

    hasJoinedRoomRef.current =
      false;

    isSinglePlayerRef.current =
      true;

    setIsSinglePlayer(
      true,
    );

    setMyPlayerId(
      'player-local',
    );

    const gameSettings: GameSettings =
      {
        stacking:
          settings.stacking,
      };

    const engine =
      new SinglePlayerEngine(
        profile.name,
        profile.avatar,
        botCount,
        gameSettings,
        {
          onStateUpdate:
            (
              updatedState,
            ) => {
              applyGameState(updatedState);
            },

          onUnoCalled:
            (
              player,
            ) => {
              sound.playUnoCall();

              showNotification(
                `👑 ${player.name} called UNO!`,
              );
            },

          onUnuCalled:
            (
              player,
            ) => {
              sound.playUnoCall();

              showNotification(
                `👑 ${player.name} called UNO!`,
              );
            },
        },
      );

    soloEngineRef.current =
      engine;

    setGameState(
      engine.getState(),
    );

    setView(
      'game',
    );
  };

  // ---------------------------------------------------------
  // CREATE ROOM
  // ---------------------------------------------------------

  const handleCreateRoom = () => {
    if (
      !socketRef.current
    ) {
      return;
    }

    if (
      isJoiningRoomRef.current ||
      hasJoinedRoomRef.current
    ) {
      return;
    }

    isJoiningRoomRef.current =
      true;

    setJoinError(
      null,
    );

    socketRef.current.emit(
      'room:create',
      {
        playerName:
          profile.name,

        avatar:
          profile.avatar,

        playerId:
          getClientPlayerId(),

        settings: {
          stacking: true,
        },
      },
    );
  };

  // ---------------------------------------------------------
  // JOIN ROOM
  // ---------------------------------------------------------

  const handleJoinRoom = (
    code: string,
  ) => {
    if (
      !socketRef.current
    ) {
      return;
    }

    if (
      isJoiningRoomRef.current ||
      hasJoinedRoomRef.current
    ) {
      return;
    }

    const normalizedCode =
      code
        .trim()
        .toUpperCase();

    if (
      normalizedCode.length !== 4
    ) {
      setJoinError(
        'Please enter a valid 4-character room code.',
      );
      return;
    }

    isJoiningRoomRef.current =
      true;

    setIsJoining(
      true,
    );

    setJoinError(
      null,
    );

    socketRef.current.emit(
      'room:join',
      {
        roomCode:
          normalizedCode,

        playerName:
          profile.name,

        avatar:
          profile.avatar,

        playerId:
          getClientPlayerId(),
      },
    );
  };

  // ---------------------------------------------------------
  // LOBBY ACTIONS
  // ---------------------------------------------------------

  const handleAddBot = () => {
    if (
      socketRef.current &&
      hasJoinedRoomRef.current
    ) {
      socketRef.current.emit(
        'room:addBot',
      );
    }
  };

  const handleRemoveBot = (
    botId: string,
  ) => {
    if (
      socketRef.current &&
      hasJoinedRoomRef.current
    ) {
      socketRef.current.emit(
        'room:removeBot',
        {
          botId,
        },
      );
    }
  };

  const handleUpdateSettings = (
    settings: Partial<GameSettings>,
  ) => {
    if (
      socketRef.current &&
      hasJoinedRoomRef.current
    ) {
      socketRef.current.emit(
        'room:updateSettings',
        settings,
      );
    }
  };

  const handleStartGame = () => {
    if (
      socketRef.current &&
      hasJoinedRoomRef.current
    ) {
      socketRef.current.emit(
        'room:start',
      );
    }
  };

  // ---------------------------------------------------------
  // LEAVE LOBBY
  // ---------------------------------------------------------

  const handleLeaveLobby = () => {
    isJoiningRoomRef.current =
      false;

    hasJoinedRoomRef.current =
      false;

    if (
      socketRef.current
    ) {
      socketRef.current.emit(
        'room:leave',
      );
    }

    setGameState(
      null,
    );

    setActiveRoomCode(
      null,
    );

    try {
      sessionStorage.removeItem(
        'uno-king-active-room',
      );
    } catch {}

    setJoinError(
      null,
    );

    setIsJoining(
      false,
    );

    setView(
      'landing',
    );
  };

  // ---------------------------------------------------------
  // GAME TABLE ACTIONS
  // ---------------------------------------------------------

  const handlePlayCard = (
    cardId: string,
    chosenColor?: CardColor,
    calledUnu?: boolean,
  ) => {
    if (
      isSinglePlayer &&
      soloEngineRef.current
    ) {
      soloEngineRef.current.playCard(
        myPlayerId,
        cardId,
        chosenColor,
        calledUnu,
      );
    } else if (
      socketRef.current &&
      hasJoinedRoomRef.current
    ) {
      socketRef.current.emit(
        'game:playCard',
        {
          cardId,
          chosenColor,
          calledUnu,
        },
      );
    }
  };

  const handleDrawCard = () => {
    if (
      isSinglePlayer &&
      soloEngineRef.current
    ) {
      soloEngineRef.current.drawCard(
        myPlayerId,
      );
    } else if (
      socketRef.current &&
      hasJoinedRoomRef.current
    ) {
      socketRef.current.emit(
        'game:drawCard',
      );
    }
  };

  const handleCallUnu = () => {
    if (
      isSinglePlayer &&
      soloEngineRef.current
    ) {
      soloEngineRef.current.callUno(
        myPlayerId,
      );
    } else if (
      socketRef.current &&
      hasJoinedRoomRef.current
    ) {
      socketRef.current.emit(
        'game:callUno',
      );
    }
  };

  const handleRematch = () => {
    if (
      isSinglePlayer &&
      soloEngineRef.current
    ) {
      soloEngineRef.current.rematch();

      setGameState({
        ...soloEngineRef.current.getState(),
      });
    } else if (
      socketRef.current &&
      hasJoinedRoomRef.current
    ) {
      socketRef.current.emit(
        'game:rematch',
      );
    }
  };

  // ---------------------------------------------------------
  // LEAVE GAME
  // ---------------------------------------------------------

  const handleLeaveGame = () => {
    isJoiningRoomRef.current =
      false;

    hasJoinedRoomRef.current =
      false;

    if (
      isSinglePlayer &&
      soloEngineRef.current
    ) {
      soloEngineRef.current.destroy();
      soloEngineRef.current =
        null;

      isSinglePlayerRef.current =
        false;
    } else if (
      socketRef.current
    ) {
      socketRef.current.emit(
        'room:leave',
      );
    }

    setIsSinglePlayer(
      false,
    );

    setGameState(
      null,
    );

    setActiveRoomCode(
      null,
    );

    setIsJoining(
      false,
    );

    setJoinError(
      null,
    );

    try {
      sessionStorage.removeItem(
        'uno-king-active-room',
      );
    } catch {}

    setView(
      'landing',
    );
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex flex-col justify-between selection:bg-[#E5A93C] selection:text-black">
      {/* GLOBAL NAVBAR */}

      <Navbar
        profile={
          profile
        }
        soundEnabled={
          soundEnabled
        }
        onToggleSound={
          handleToggleSound
        }
        onOpenHowToPlay={() =>
          setIsHowToPlayOpen(
            true,
          )
        }
        onOpenProfile={() =>
          setIsProfileOpen(
            true,
          )
        }
        onLogoClick={() => {
          if (
            view !==
            'landing'
          ) {
            handleLeaveGame();
          }
        }}
      />

      {/* RECONNECT / DISCONNECTED BANNER */}

      {!isConnected && (
        <div className="w-full bg-rose-600/90 text-white text-xs py-1 px-4 flex items-center justify-center gap-2 font-semibold">
          <WifiOff className="w-3.5 h-3.5" />

          <span>
            Real-time server
            connecting... (Single
            player remains
            playable offline)
          </span>
        </div>
      )}

      {/* FINISH ALERT — every placement gets its own queued announcement */}
      {winnerAlert && (
        <div className={`winner-alert winner-alert--place-${Math.min(winnerAlert.place, 4)}`} role="alert" aria-live="assertive">
          <div className="winner-alert__glow" />
          <div className="winner-alert__avatar">
            <span>{winnerAlert.avatar}</span>
            {winnerAlert.place === 1 ? <Crown size={13} /> : <Medal size={13} />}
          </div>
          <div className="winner-alert__copy">
            <span>{winnerAlert.place === 1 ? '🏆 1ST WINNER' : `🏅 ${winnerAlert.place}${winnerAlert.place === 2 ? 'ND' : winnerAlert.place === 3 ? 'RD' : 'TH'} PLACE`}</span>
            <strong>{winnerAlert.name}</strong>
            <small>{winnerAlert.place === 1 ? 'has claimed the crown!' : 'has secured a place on the podium!'}</small>
          </div>
          <div className="winner-alert__trophy"><Trophy size={20} /></div>
        </div>
      )}

      {/* FLOATING ACTION TOAST NOTIFICATION */}

      {notification && (
        <div className="app-toast animate-fade-in" role="status" aria-live="polite">
          <div className="app-toast__icon">
            <Crown className="w-4 h-4" />
          </div>
          <span>{notification}</span>
        </div>
      )}

      {/* MAIN SCREEN ROUTER */}

      <main className="flex-1 w-full">
        {view ===
          'landing' && (
          <LandingPage
            onPlayNow={() =>
              setIsPlayNowOpen(
                true,
              )
            }
            onCreateRoom={
              handleCreateRoom
            }
            onJoinRoom={
              handleJoinRoom
            }
            onOpenHowToPlay={() =>
              setIsHowToPlayOpen(
                true,
              )
            }
            onOpenProfile={() =>
              setIsProfileOpen(
                true,
              )
            }
            joinError={
              joinError
            }
            isJoining={
              isJoining
            }
          />
        )}

        {view === 'lobby' &&
          gameState && (
            <MultiplayerLobby
              gameState={
                gameState
              }
              currentPlayerId={
                myPlayerId
              }
              onAddBot={
                handleAddBot
              }
              onRemoveBot={
                handleRemoveBot
              }
              onStartGame={
                handleStartGame
              }
              onLeaveRoom={
                handleLeaveLobby
              }
              onOpenQr={() =>
                setIsQrOpen(
                  true,
                )
              }
              onUpdateSettings={
                handleUpdateSettings
              }
            />
          )}

        {view === 'game' &&
          gameState && (
            <GameTable
              gameState={
                gameState
              }
              currentPlayerId={
                myPlayerId
              }
              onPlayCard={
                handlePlayCard
              }
              onDrawCard={
                handleDrawCard
              }
              onCallUnu={
                handleCallUnu
              }
              onLeaveGame={
                handleLeaveGame
              }
              socket={
                socketRef.current
              }
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
              socket={
                socketRef.current
              }
              myPlayerId={
                myPlayerId
              }
              players={
                gameState.players
              }
            />

            <VoicePanel
              socket={
                socketRef.current
              }
              myPlayerId={
                myPlayerId
              }
              players={
                gameState.players
              }
            />
          </>
        )}

      {/* MODALS */}

      <PlayNowModal
        isOpen={
          isPlayNowOpen
        }
        onClose={() =>
          setIsPlayNowOpen(
            false,
          )
        }
        onStartMatch={
          handleStartSinglePlayer
        }
      />

      {gameState && (
        <QrModal
          isOpen={
            isQrOpen
          }
          onClose={() =>
            setIsQrOpen(
              false,
            )
          }
          roomCode={
            gameState.roomCode
          }
        />
      )}

      <HowToPlayModal
        isOpen={
          isHowToPlayOpen
        }
        onClose={() =>
          setIsHowToPlayOpen(
            false,
          )
        }
      />

      <ProfileModal
        isOpen={
          isProfileOpen
        }
        onClose={() =>
          setIsProfileOpen(
            false,
          )
        }
        profile={
          profile
        }
        onSave={
          handleSaveProfile
        }
      />

      {gameState &&
        gameState.gameStatus ===
          'finished' &&
        !matchClosedByLeave && (
          <GameResultModal
            gameState={
              gameState
            }
            currentPlayerId={
              myPlayerId
            }
            onRematch={
              handleRematch
            }
            onNewGame={() => {
              if (
                isSinglePlayer
              ) {
                if (
                  soloEngineRef.current
                ) {
                  soloEngineRef.current.destroy();

                  soloEngineRef.current =
                    null;
                }

                isSinglePlayerRef.current =
                  false;

                hasJoinedRoomRef.current =
                  false;

                isJoiningRoomRef.current =
                  false;

                setIsSinglePlayer(
                  false,
                );

                setGameState(
                  null,
                );

                setView(
                  'landing',
                );

                setIsPlayNowOpen(
                  true,
                );
              } else {
                hasJoinedRoomRef.current =
                  false;

                isJoiningRoomRef.current =
                  false;

                if (
                  socketRef.current
                ) {
                  socketRef.current.emit(
                    'room:leave',
                  );
                }

                try {
                  sessionStorage.removeItem(
                    'uno-king-active-room',
                  );
                } catch {}

                setGameState(
                  null,
                );

                setView(
                  'landing',
                );

                window.setTimeout(
                  () => {
                    handleCreateRoom();
                  },
                  100,
                );
              }
            }}
            onLeave={
              handleLeaveGame
            }
          />
        )}
    </div>
  );
}

