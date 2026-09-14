import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';

import {
  Card,
  CardColor,
  GameState,
  Player,
  GameSettings,
} from './src/types';

import {
  BOT_PROFILES,
  createDeck,
  isLegalMove,
  pickBotMove,
} from './src/utils/cardUtils';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : 3000;

app.use(express.json());

interface ChatMessage {
  id: string;
  roomId: string;
  playerId: string;
  username: string;
  avatar: string;
  text: string;
  timestamp: number;
}

interface ServerRoom {
  roomId: string;
  roomCode: string;

  players: (Player & {
    socketId?: string;
  })[];

  hostId: string;

  gameStatus:
    | 'waiting'
    | 'starting'
    | 'playing'
    | 'finished';

  deck: Card[];
  discardPile: Card[];

  topCard: Card | null;

  activeColor: CardColor;

  currentPlayerIndex: number;

  turnDirection: 1 | -1;

  pendingPenalty: number;

  /**
   * First player to finish.
   */
  winner: Player | null;

  /**
   * Sorted finish order.
   */
  rankings: Player[];

  settings: GameSettings;

  lastActionMessage: string;

  botTimeout?: NodeJS.Timeout;

  disconnectTimeouts: Map<string, NodeJS.Timeout>;

  chatMessages: ChatMessage[];

  voicePlayers: Set<string>;
}

const rooms = new Map<string, ServerRoom>();

const RECONNECT_GRACE_MS = 30000;

const MAX_NAME_LENGTH = 16;

const MAX_CHAT_MESSAGES = 50;

const VALID_COLORS = new Set<CardColor>([
  'gold',
  'crimson',
  'sapphire',
  'emerald',
]);

const ALLOWED_REACTIONS = new Set([
  '😂',
  '😭',
  '😈',
  '🔥',
  '💀',
  '👑',
  '🎉',
  '😎',
  '❤️',
  '👍',
  '😡',
  '😱',
]);

function generateRoomCode(): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let code = '';

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(
      Math.floor(Math.random() * chars.length),
    );
  }

  if (rooms.has(code)) {
    return generateRoomCode();
  }

  return code;
}

/**
 * Return true when the player is still participating
 * and has not already secured a placement.
 */
function isActivePlayer(player: Player): boolean {
  return !player.hasFinished;
}

/**
 * Returns how many players are still competing.
 */
function getActivePlayerCount(
  room: ServerRoom,
): number {
  return room.players.filter(isActivePlayer).length;
}

/**
 * Find the next player who can actually take a turn.
 *
 * Finished players are skipped permanently.
 */
function findNextActivePlayerIndex(
  room: ServerRoom,
  startIndex: number,
  direction = room.turnDirection,
): number {
  const n = room.players.length;

  if (n === 0) {
    return 0;
  }

  let index =
    ((startIndex % n) + n) % n;

  for (let i = 0; i < n; i++) {
    const player = room.players[index];

    if (player && isActivePlayer(player)) {
      return index;
    }

    index =
      (index + direction + n) % n;
  }

  return startIndex;
}

/**
 * Move through N active competitors.
 * Finished players do not consume a turn.
 */
function advanceTurn(
  room: ServerRoom,
  steps = 1,
) {
  if (room.players.length === 0) {
    return;
  }

  let index = room.currentPlayerIndex;

  for (let i = 0; i < steps; i++) {
    index =
      findNextActivePlayerIndex(
        room,
        index + room.turnDirection,
        room.turnDirection,
      );
  }

  room.currentPlayerIndex = index;

  const current =
    room.players[room.currentPlayerIndex];

  if (
    current &&
    current.hand &&
    current.hand.length > 1
  ) {
    current.calledUno = false;
    current.calledUnu = false;
  }
}

/**
 * Rebuild rankings from placement.
 */
function rebuildRankings(room: ServerRoom) {
  room.rankings = [...room.players]
    .filter(
      (player) =>
        typeof player.placement === 'number',
    )
    .sort(
      (a, b) =>
        (a.placement || 999) -
        (b.placement || 999),
    )
    .map((player) => ({
      ...player,
      hand: undefined,
      cardCount: player.hand?.length || 0,
    }));
}

/**
 * Assign a placement to a player who just emptied their hand.
 */
function finishPlayer(
  room: ServerRoom,
  player: Player,
) {
  if (player.hasFinished) {
    return;
  }

  const nextPlacement =
    room.rankings.length + 1;

  player.placement = nextPlacement;
  player.hasFinished = true;
  player.cardCount = 0;
  player.hand = [];

  if (!room.winner) {
    room.winner = player;
  }

  rebuildRankings(room);
}

/**
 * When only one competitor remains, assign the final
 * remaining placement and end the match.
 */
function completeRemainingPlayer(
  room: ServerRoom,
) {
  const remaining =
    room.players.find(
      (player) =>
        isActivePlayer(player),
    );

  if (!remaining) {
    room.gameStatus = 'finished';
    room.currentPlayerIndex = 0;
    rebuildRankings(room);
    return;
  }

  remaining.placement =
    room.rankings.length + 1;

  remaining.hasFinished = true;

  remaining.cardCount =
    remaining.hand?.length || 0;

  rebuildRankings(room);

  room.gameStatus = 'finished';

  const finishedOrder =
    room.rankings
      .map(
        (player) =>
          `#${player.placement} ${player.name}`,
      )
      .join(' • ');

  room.lastActionMessage =
    `🏆 Match complete! ${finishedOrder}`;
}

/**
 * Handles a player's victory without removing them
 * from the room.
 */
function registerPlayerFinish(
  io: SocketIOServer,
  room: ServerRoom,
  player: Player,
) {
  finishPlayer(room, player);

  const placement =
    player.placement || 0;

  if (placement === 1) {
    room.lastActionMessage =
      `👑 ${player.name} finished #1 and claimed the crown!`;
  } else {
    room.lastActionMessage =
      `🏅 ${player.name} finished #${placement}!`;
  }

  const activeCount =
    getActivePlayerCount(room);

  if (activeCount <= 1) {
    completeRemainingPlayer(room);
    broadcastRoomState(io, room);
    return;
  }

  room.currentPlayerIndex =
    findNextActivePlayerIndex(
      room,
      room.currentPlayerIndex +
        room.turnDirection,
      room.turnDirection,
    );

  broadcastRoomState(io, room);

  scheduleBotTurn(io, room);
}

function getClientGameState(
  room: ServerRoom,
  forPlayerId?: string,
): GameState {
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,

    hostId: room.hostId,

    gameStatus: room.gameStatus,

    topCard: room.topCard,

    activeColor: room.activeColor,

    currentPlayerIndex:
      room.currentPlayerIndex,

    turnDirection:
      room.turnDirection,

    pendingPenalty:
      room.pendingPenalty,

    winner: room.winner
      ? {
          ...room.winner,
          hand: undefined,
          cardCount:
            room.winner.cardCount,
        }
      : null,

    rankings: room.rankings.map(
      (player) => ({
        ...player,
        hand: undefined,
        cardCount:
          player.cardCount,
      }),
    ),

    settings: room.settings,

    lastActionMessage:
      room.lastActionMessage,

    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      isHost: p.isHost,

      cardCount: p.hand
        ? p.hand.length
        : 0,

      connected: p.connected,

      placement:
        p.placement,

      hasFinished:
        Boolean(p.hasFinished),

      calledUno:
        Boolean(
          p.calledUno ||
            p.calledUnu,
        ),

      calledUnu:
        Boolean(
          p.calledUno ||
            p.calledUnu,
        ),

      hand:
        forPlayerId &&
        p.id === forPlayerId
          ? p.hand
          : undefined,
    })),
  };
}

function broadcastRoomState(
  io: SocketIOServer,
  room: ServerRoom,
) {
  room.players.forEach((p) => {
    if (
      !p.isBot &&
      p.socketId
    ) {
      io.to(p.socketId).emit(
        'game:state',
        getClientGameState(
          room,
          p.id,
        ),
      );
    }
  });
}

function broadcastChatHistory(
  socket: Socket,
  room: ServerRoom,
) {
  socket.emit(
    'chat:history',
    room.chatMessages,
  );
}

function scheduleBotTurn(
  io: SocketIOServer,
  room: ServerRoom,
) {
  if (room.botTimeout) {
    clearTimeout(
      room.botTimeout,
    );

    room.botTimeout =
      undefined;
  }

  if (
    room.gameStatus !==
    'playing'
  ) {
    return;
  }

  const current =
    room.players[
      room.currentPlayerIndex
    ];

  if (
    current &&
    current.isBot &&
    isActivePlayer(current)
  ) {
    const delay =
      900 + Math.random() * 800;

    room.botTimeout =
      setTimeout(() => {
        room.botTimeout =
          undefined;

        executeBotTurn(
          io,
          room,
          current,
        );
      }, delay);
  }
}

function drawCards(
  room: ServerRoom,
  player: Player,
  count: number,
): Card[] {
  const drawn: Card[] = [];

  if (!player.hand) {
    player.hand = [];
  }

  for (
    let i = 0;
    i < count;
    i++
  ) {
    if (
      room.deck.length === 0
    ) {
      if (
        room.discardPile.length > 1
      ) {
        const top =
          room.discardPile.pop()!;

        room.deck =
          room.discardPile;

        for (
          let j =
            room.deck.length - 1;
          j > 0;
          j--
        ) {
          const k =
            Math.floor(
              Math.random() *
                (j + 1),
            );

          [
            room.deck[j],
            room.deck[k],
          ] = [
            room.deck[k],
            room.deck[j],
          ];
        }

        room.discardPile =
          [top];
      } else {
        break;
      }
    }

    const card =
      room.deck.pop();

    if (card) {
      player.hand.push(card);
      drawn.push(card);
    }
  }

  player.cardCount =
    player.hand.length;

  return drawn;
}

function executeBotTurn(
  io: SocketIOServer,
  room: ServerRoom,
  bot: Player,
) {
  if (
    room.gameStatus !==
    'playing'
  ) {
    return;
  }

  if (
    room.players[
      room.currentPlayerIndex
    ]?.id !== bot.id
  ) {
    return;
  }

  if (
    bot.hasFinished
  ) {
    advanceTurn(room, 1);
    broadcastRoomState(
      io,
      room,
    );
    scheduleBotTurn(
      io,
      room,
    );
    return;
  }

  const botHand =
    bot.hand || [];

  const move =
    pickBotMove(
      botHand,
      room.topCard,
      room.activeColor,
      room.pendingPenalty,
      room.settings.stacking,
    );

  if (move.card) {
    if (
      botHand.length ===
        2 &&
      !bot.calledUno
    ) {
      bot.calledUno = true;
      bot.calledUnu = true;

      io.to(room.roomCode)
        .emit(
          'game:unoCalled',
          {
            playerId: bot.id,
            name: bot.name,
          },
        );
    }

    applyCardPlay(
      io,
      room,
      bot,
      move.card,
      move.chosenColor,
    );
  } else {
    const penaltyToTake =
      room.pendingPenalty > 0
        ? room.pendingPenalty
        : 1;

    room.pendingPenalty =
      0;

    drawCards(
      room,
      bot,
      penaltyToTake,
    );

    room.lastActionMessage =
      penaltyToTake > 1
        ? `${bot.name} drew ${penaltyToTake} penalty cards.`
        : `${bot.name} drew a card.`;

    advanceTurn(
      room,
      1,
    );

    broadcastRoomState(
      io,
      room,
    );

    scheduleBotTurn(
      io,
      room,
    );
  }
}

function applyCardPlay(
  io: SocketIOServer,
  room: ServerRoom,
  player: Player,
  card: Card,
  chosenColor?: CardColor,
) {
  player.hand =
    player.hand?.filter(
      (c) => c.id !== card.id,
    ) || [];

  player.cardCount =
    player.hand.length;

  room.discardPile.push(card);

  room.topCard = card;

  if (
    player.hand.length === 0
  ) {
    registerPlayerFinish(
      io,
      room,
      player,
    );

    return;
  }

  if (
    card.color === 'wild' ||
    card.type === 'wild' ||
    card.type === 'wild4'
  ) {
    room.activeColor =
      chosenColor ||
      'gold';
  } else {
    room.activeColor =
      card.color;
  }

  let steps = 1;

  if (
    card.type === 'skip'
  ) {
    steps = 2;

    room.lastActionMessage =
      `${player.name} played a Skip! Next player skipped.`;
  } else if (
    card.type === 'reverse'
  ) {
    const activePlayers =
      getActivePlayerCount(
        room,
      );

    if (
      activePlayers === 2
    ) {
      steps = 2;

      room.lastActionMessage =
        `${player.name} reversed direction! Next player skipped.`;
    } else {
      room.turnDirection =
        (room.turnDirection *
          -1) as 1 | -1;

      steps = 1;

      room.lastActionMessage =
        `${player.name} reversed the turn direction!`;
    }
  } else if (
    card.type === 'draw2'
  ) {
    if (
      room.settings.stacking
    ) {
      room.pendingPenalty += 2;

      steps = 1;

      room.lastActionMessage =
        `${player.name} stacked +2! (+${room.pendingPenalty} pending)`;
    } else {
      advanceTurn(
        room,
        1,
      );

      const nextPlayer =
        room.players[
          room.currentPlayerIndex
        ];

      if (nextPlayer) {
        drawCards(
          room,
          nextPlayer,
          2,
        );

        room.lastActionMessage =
          `${player.name} played +2! ${nextPlayer.name} drew 2 cards and lost their turn.`;
      }
    }
  } else if (
    card.type === 'wild4'
  ) {
    if (
      room.settings.stacking
    ) {
      room.pendingPenalty += 4;

      steps = 1;

      room.lastActionMessage =
        `${player.name} played Wild +4 to ${room.activeColor}! (+${room.pendingPenalty} pending)`;
    } else {
      advanceTurn(
        room,
        1,
      );

      const nextPlayer =
        room.players[
          room.currentPlayerIndex
        ];

      if (nextPlayer) {
        drawCards(
          room,
          nextPlayer,
          4,
        );

        room.lastActionMessage =
          `${player.name} played Wild +4 to ${room.activeColor}! ${nextPlayer.name} drew 4 cards.`;
      }
    }
  } else if (
    card.type === 'wild'
  ) {
    room.lastActionMessage =
      `${player.name} played a Wild card and chose ${room.activeColor.toUpperCase()}!`;
  } else {
    room.lastActionMessage =
      `${player.name} played ${card.color.toUpperCase()} ${card.value}.`;
  }

  advanceTurn(
    room,
    steps,
  );

  broadcastRoomState(
    io,
    room,
  );

  scheduleBotTurn(
    io,
    room,
  );
}

function initializeGame(
  io: SocketIOServer,
  room: ServerRoom,
) {
  if (
    room.players.length < 2
  ) {
    io.to(room.roomCode).emit(
      'room:error',
      {
        message:
          'At least 2 players (or 1 bot) are required to start the game!',
      },
    );

    return;
  }

  const deck =
    createDeck();

  room.deck = deck;
  room.discardPile = [];

  room.winner = null;
  room.rankings = [];

  room.pendingPenalty = 0;

  room.turnDirection = 1;

  room.currentPlayerIndex = 0;

  room.gameStatus =
    'playing';

  room.settings.stacking =
    Boolean(
      room.settings.stacking,
    );

  room.players.forEach(
    (p) => {
      p.hand = [];

      p.placement =
        undefined;

      p.hasFinished =
        false;

      for (
        let i = 0;
        i < 7;
        i++
      ) {
        const c =
          room.deck.pop();

        if (c) {
          p.hand.push(c);
        }
      }

      p.cardCount =
        p.hand.length;

      p.calledUnu =
        false;

      p.calledUno =
        false;
    },
  );

  let initialCard =
    room.deck.pop()!;

  while (
    initialCard.type !==
    'number'
  ) {
    room.deck.unshift(
      initialCard,
    );

    initialCard =
      room.deck.pop()!;
  }

  room.discardPile.push(
    initialCard,
  );

  room.topCard =
    initialCard;

  room.activeColor =
    initialCard.color === 'wild'
      ? 'gold'
      : initialCard.color;

  room.lastActionMessage =
    `Match started! Top card is ${room.topCard.color.toUpperCase()} ${
      room.topCard.type === 'number'
        ? room.topCard.value
        : room.topCard.type
    }.`;

  broadcastRoomState(
    io,
    room,
  );

  scheduleBotTurn(
    io,
    room,
  );
}

function normalizeName(
  value: unknown,
  fallback = 'Player',
): string {
  if (
    typeof value !==
    'string'
  ) {
    return fallback;
  }

  const cleaned =
    value
      .replace(/[<>]/g, '')
      .trim()
      .slice(
        0,
        MAX_NAME_LENGTH,
      );

  return cleaned || fallback;
}

function isValidColor(
  value: unknown,
): value is CardColor {
  return (
    typeof value ===
      'string' &&
    VALID_COLORS.has(
      value as CardColor,
    )
  );
}

function isValidPlayerId(
  value: unknown,
): value is string {
  return (
    typeof value ===
      'string' &&
    /^[A-Za-z0-9_-]{8,80}$/.test(
      value,
    )
  );
}

function clearDisconnectTimeout(
  room: ServerRoom,
  playerId: string,
) {
  const timeout =
    room.disconnectTimeouts.get(
      playerId,
    );

  if (timeout) {
    clearTimeout(timeout);
  }

  room.disconnectTimeouts.delete(
    playerId,
  );
}

function assignNewHost(
  room: ServerRoom,
): boolean {
  const currentHost =
    room.players.find(
      (p) =>
        p.id ===
        room.hostId,
    );

  if (
    currentHost &&
    currentHost.connected &&
    !currentHost.isBot
  ) {
    currentHost.isHost =
      true;

    return true;
  }

  room.players.forEach(
    (p) => {
      p.isHost = false;
    },
  );

  const nextHuman =
    room.players.find(
      (p) =>
        !p.isBot &&
        p.connected &&
        !p.hasFinished,
    );

  if (!nextHuman) {
    return false;
  }

  nextHuman.isHost =
    true;

  room.hostId =
    nextHuman.id;

  room.lastActionMessage =
    `${nextHuman.name} is now the host.`;

  return true;
}

function removeRoomIfEmpty(
  roomCode: string,
) {
  const room =
    rooms.get(roomCode);

  if (!room) {
    return;
  }

  const connectedHumans =
    room.players.filter(
      (p) =>
        !p.isBot &&
        p.connected,
    );

  const totalHumans =
    room.players.filter(
      (p) => !p.isBot,
    );

  if (
    totalHumans.length === 0 ||
    (
      connectedHumans.length === 0 &&
      room.gameStatus !==
        'playing'
    )
  ) {
    if (
      room.botTimeout
    ) {
      clearTimeout(
        room.botTimeout,
      );
    }

    room.disconnectTimeouts.forEach(
      (timeout) =>
        clearTimeout(timeout),
    );

    room.disconnectTimeouts.clear();

    rooms.delete(
      roomCode,
    );
  }
}

function scheduleDisconnectedPlayerRemoval(
  io: SocketIOServer,
  room: ServerRoom,
  playerId: string,
) {
  clearDisconnectTimeout(
    room,
    playerId,
  );

  const timeout =
    setTimeout(() => {
      const currentRoom =
        rooms.get(
          room.roomCode,
        );

      if (!currentRoom) {
        return;
      }

      const player =
        currentRoom.players.find(
          (p) =>
            p.id ===
            playerId,
        );

      if (!player) {
        return;
      }

      if (
        player.connected
      ) {
        return;
      }

      if (
        currentRoom.gameStatus ===
        'playing'
      ) {
        removePlayerFromActiveMatch(
          io,
          currentRoom,
          playerId,
          `${player.name.replace(/\s*\(AI\)$/, '')} left the match.`,
        );
      } else {
        const idx =
          currentRoom.players.findIndex(
            (p) =>
              p.id ===
              playerId,
          );

        if (idx !== -1) {
          const removed =
            currentRoom.players.splice(
              idx,
              1,
            )[0];

          if (
            removed.isHost
          ) {
            assignNewHost(
              currentRoom,
            );
          }

          currentRoom.lastActionMessage =
            `${removed.name.replace(/\s*\(AI\)$/, '')} left the room.`;

          io.to(
            currentRoom.roomCode,
          ).emit(
            'room:playerLeft',
            {
              name:
                removed.name.replace(
                  /\s*\(AI\)$/,
                  '',
                ),
              matchEnded: false,
            },
          );

          broadcastRoomState(
            io,
            currentRoom,
          );

          removeRoomIfEmpty(
            currentRoom.roomCode,
          );
        }
      }
    }, RECONNECT_GRACE_MS);

  room.disconnectTimeouts.set(
    playerId,
    timeout,
  );
}

const io =
  new SocketIOServer(
    server,
    {
      cors: {
        origin:
          process.env.FRONTEND_URL
            ? process.env.FRONTEND_URL
                .split(',')
                .map((v) =>
                  v.trim(),
                )
            : '*',
      },
    },
  );

io.on(
  'connection',
  (socket: Socket) => {
    let currentRoomCode:
      | string
      | null = null;

    let currentUserId:
      | string
      | null = null;

    socket.on(
      'room:create',
      ({
        playerName,
        avatar,
        settings,
        initialBots,
        playerId:
          requestedPlayerId,
      }) => {
        if (
          currentRoomCode
        ) {
          return;
        }

        const roomCode =
          generateRoomCode();

        const playerId =
          isValidPlayerId(
            requestedPlayerId,
          )
            ? requestedPlayerId
            : `player-${socket.id.substring(
                0,
                6,
              )}`;

        currentRoomCode =
          roomCode;

        currentUserId =
          playerId;

        const newRoom:
          ServerRoom = {
          roomId:
            `room-${Date.now()}`,

          roomCode,

          players: [
            {
              id: playerId,
              socketId:
                socket.id,

              name:
                normalizeName(
                  playerName,
                  'Host',
                ),

              avatar:
                typeof avatar ===
                    'string' &&
                avatar.length <= 8
                  ? avatar
                  : '👑',

              isBot: false,
              isHost: true,

              cardCount: 0,

              connected: true,

              hand: [],

              hasFinished:
                false,
            },
          ],

          hostId:
            playerId,

          gameStatus:
            'waiting',

          deck: [],
          discardPile: [],

          topCard: null,

          activeColor:
            'gold',

          currentPlayerIndex: 0,

          turnDirection: 1,

          pendingPenalty: 0,

          winner: null,

          rankings: [],

          settings: {
            stacking:
              settings?.stacking !==
              undefined
                ? Boolean(
                    settings.stacking,
                  )
                : true,
          },

          lastActionMessage:
            'Lobby created. Invite friends or add bots to begin.',

          disconnectTimeouts:
            new Map(),

          chatMessages: [],

          voicePlayers:
            new Set(),
        };

        if (
          typeof initialBots ===
            'number' &&
          initialBots > 0
        ) {
          const botsToAdd =
            Math.min(
              initialBots,
              7,
            );

          for (
            let i = 0;
            i < botsToAdd;
            i++
          ) {
            const usedNames =
              new Set(
                newRoom.players.map(
                  (p) => p.name,
                ),
              );

            const available =
              BOT_PROFILES.filter(
                (b) =>
                  !usedNames.has(
                    b.name,
                  ),
              );

            const chosen =
              available.length > 0
                ? available[0]
                : BOT_PROFILES[
                    newRoom.players
                      .length %
                      BOT_PROFILES.length
                  ];

            const botId =
              `bot-${Date.now()}-${i}`;

            newRoom.players.push({
              id: botId,

              name:
                chosen.name,

              avatar:
                chosen.avatar,

              isBot: true,
              isHost: false,

              cardCount: 0,

              connected: true,

              hand: [],

              hasFinished:
                false,
            });
          }
        }

        rooms.set(
          roomCode,
          newRoom,
        );

        socket.join(
          roomCode,
        );

        socket.emit(
          'room:created',
          {
            roomCode,
            playerId,

            state:
              getClientGameState(
                newRoom,
                playerId,
              ),
          },
        );
      },
    );

    socket.on(
      'room:join',
      ({
        roomCode,
        playerName,
        avatar,
        playerId:
          requestedPlayerId,
      }) => {
        if (
          currentRoomCode
        ) {
          socket.emit(
            'room:error',
            {
              message:
                'You are already inside a room.',
            },
          );

          return;
        }

        const code =
          (roomCode || '')
            .toUpperCase()
            .trim();

        const room =
          rooms.get(code);

        if (!room) {
          socket.emit(
            'room:error',
            {
              message:
                'Room not found. Please verify the 4-letter code.',
            },
          );

          return;
        }

        const requested =
          isValidPlayerId(
            requestedPlayerId,
          )
            ? requestedPlayerId
            : null;

        if (requested) {
          const existing =
            room.players.find(
              (p) =>
                p.id ===
                  requested &&
                !p.isBot,
            );

          if (existing) {
            clearDisconnectTimeout(
              room,
              existing.id,
            );

            const oldSocketId =
              existing.socketId &&
              existing.socketId !==
                socket.id
                ? existing.socketId
                : undefined;

            existing.socketId =
              socket.id;

            existing.connected =
              true;

            if (
              oldSocketId
            ) {
              const oldSocket =
                io.sockets.sockets.get(
                  oldSocketId,
                );

              if (
                oldSocket
              ) {
                oldSocket.disconnect(
                  true,
                );
              }
            }

            if (
              typeof playerName ===
                'string' &&
              playerName.trim()
            ) {
              existing.name =
                normalizeName(
                  playerName,
                  existing.name,
                );
            }

            if (
              typeof avatar ===
                'string' &&
              avatar.length <= 8
            ) {
              existing.avatar =
                avatar;
            }

            currentRoomCode =
              code;

            currentUserId =
              existing.id;

            socket.join(
              code,
            );

            socket.emit(
              'room:reconnected',
              {
                roomCode:
                  code,

                playerId:
                  existing.id,

                state:
                  getClientGameState(
                    room,
                    existing.id,
                  ),
              },
            );

            broadcastRoomState(
              io,
              room,
            );

            broadcastChatHistory(
              socket,
              room,
            );

            return;
          }
        }

        if (
          room.gameStatus ===
          'playing'
        ) {
          socket.emit(
            'room:error',
            {
              message:
                'Game has already started in this room.',
            },
          );

          return;
        }

        if (
          room.players.length >= 8
        ) {
          socket.emit(
            'room:error',
            {
              message:
                'This room is full (maximum 8 players).',
            },
          );

          return;
        }

        const playerId =
          requested ||
          `player-${socket.id.substring(
            0,
            6,
          )}`;

        currentRoomCode =
          code;

        currentUserId =
          playerId;

        const newPlayer:
          Player & {
            socketId?: string;
          } = {
          id: playerId,

          socketId:
            socket.id,

          name:
            normalizeName(
              playerName,
              `Player ${room.players.length + 1}`,
            ),

          avatar:
            typeof avatar ===
                'string' &&
            avatar.length <= 8
              ? avatar
              : '🦁',

          isBot: false,
          isHost: false,

          cardCount: 0,

          connected: true,

          hand: [],

          hasFinished:
            false,
        };

        room.players.push(
          newPlayer,
        );

        socket.join(
          code,
        );

        room.lastActionMessage =
          `${newPlayer.name} joined the lobby!`;

        broadcastRoomState(
          io,
          room,
        );

        socket.emit(
          'room:joined',
          {
            roomCode: code,

            playerId,

            state:
              getClientGameState(
                room,
                playerId,
              ),
          },
        );

        broadcastChatHistory(
          socket,
          room,
        );
      },
    );

    socket.on(
      'room:reconnect',
      ({
        roomCode,
        playerId,
      }) => {
        if (
          currentRoomCode
        ) {
          return;
        }

        const code =
          (roomCode || '')
            .toUpperCase()
            .trim();

        const room =
          rooms.get(code);

        if (
          !room ||
          !isValidPlayerId(
            playerId,
          )
        ) {
          socket.emit(
            'room:error',
            {
              message:
                'Your previous room is no longer available. Please create or join a new room.',
              reason:
                'RECONNECT_FAILED',
            },
          );

          return;
        }

        const player =
          room.players.find(
            (p) =>
              p.id ===
                playerId &&
              !p.isBot,
          );

        if (!player) {
          socket.emit(
            'room:error',
            {
              message:
                'Your previous room session could not be found.',
            },
          );

          return;
        }

        clearDisconnectTimeout(
          room,
          player.id,
        );

        const oldSocketId =
          player.socketId &&
          player.socketId !==
            socket.id
            ? player.socketId
            : undefined;

        player.socketId =
          socket.id;

        player.connected =
          true;

        if (
          oldSocketId
        ) {
          const oldSocket =
            io.sockets.sockets.get(
              oldSocketId,
            );

          if (
            oldSocket
          ) {
            oldSocket.disconnect(
              true,
            );
          }
        }

        currentRoomCode =
          code;

        currentUserId =
          player.id;

        socket.join(
          code,
        );

        socket.emit(
          'room:reconnected',
          {
            roomCode:
              code,

            playerId:
              player.id,

            state:
              getClientGameState(
                room,
                player.id,
              ),
          },
        );

        broadcastRoomState(
          io,
          room,
        );

        broadcastChatHistory(
          socket,
          room,
        );

        if (
          room.gameStatus ===
            'playing' &&
          room.players[
            room.currentPlayerIndex
          ]?.id ===
            player.id
        ) {
          scheduleBotTurn(
            io,
            room,
          );
        }
      },
    );

    socket.on(
      'room:addBot',
      () => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (
          !room ||
          room.gameStatus !==
            'waiting' ||
          room.hostId !==
            currentUserId
        ) {
          return;
        }

        if (
          room.players.length >= 8
        ) {
          return;
        }

        const usedNames =
          new Set(
            room.players.map(
              (p) => p.name,
            ),
          );

        const available =
          BOT_PROFILES.filter(
            (b) =>
              !usedNames.has(
                b.name,
              ),
          );

        const chosen =
          available.length > 0
            ? available[0]
            : BOT_PROFILES[
                room.players.length %
                  BOT_PROFILES.length
              ];

        const botId =
          `bot-${Date.now()}-${room.players.length}`;

        room.players.push({
          id: botId,

          name:
            chosen.name,

          avatar:
            chosen.avatar,

          isBot: true,
          isHost: false,

          cardCount: 0,

          connected: true,

          hand: [],

          hasFinished:
            false,
        });

        room.lastActionMessage =
          `Bot ${chosen.name} was added.`;

        broadcastRoomState(
          io,
          room,
        );
      },
    );

    socket.on(
      'room:removeBot',
      ({ botId }) => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (
          !room ||
          room.gameStatus !==
            'waiting' ||
          room.hostId !==
            currentUserId
        ) {
          return;
        }

        const idx =
          room.players.findIndex(
            (p) =>
              p.id === botId &&
              p.isBot,
          );

        if (idx !== -1) {
          const removed =
            room.players.splice(
              idx,
              1,
            )[0];

          room.lastActionMessage =
            `Bot ${removed.name} was removed.`;

          broadcastRoomState(
            io,
            room,
          );
        }
      },
    );

    socket.on(
      'room:updateSettings',
      (
        newSettings:
          Partial<GameSettings>,
      ) => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (
          !room ||
          room.gameStatus !==
            'waiting' ||
          room.hostId !==
            currentUserId
        ) {
          return;
        }

        const validated:
          Partial<GameSettings> = {};

        if (
          newSettings?.stacking !==
          undefined
        ) {
          validated.stacking =
            Boolean(
              newSettings.stacking,
            );
        }

        room.settings = {
          ...room.settings,
          ...validated,
        };

        broadcastRoomState(
          io,
          room,
        );
      },
    );

    socket.on(
      'room:start',
      () => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (
          !room ||
          room.hostId !==
            currentUserId
        ) {
          socket.emit(
            'room:error',
            {
              message: !room
                ? 'Room not found. Please reconnect or create a new room.'
                : 'Only the host can start the game.',
            },
          );

          return;
        }

        initializeGame(
          io,
          room,
        );
      },
    );

    socket.on(
      'game:playCard',
      ({
        cardId,
        chosenColor,
        calledUnu,
      }) => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (
          !room ||
          room.gameStatus !==
            'playing'
        ) {
          return;
        }

        const current =
          room.players[
            room.currentPlayerIndex
          ];

        if (
          !current ||
          current.id !==
            currentUserId ||
          !current.connected ||
          current.hasFinished
        ) {
          return;
        }

        const card =
          current.hand?.find(
            (c) =>
              c.id === cardId,
          );

        if (!card) {
          return;
        }

        const legal =
          isLegalMove(
            card,
            room.topCard,
            room.activeColor,
            room.pendingPenalty,
            room.settings.stacking,
          );

        if (!legal) {
          socket.emit(
            'game:error',
            {
              message:
                'Illegal move!',
            },
          );

          return;
        }

        if (
          (
            card.type ===
              'wild' ||
            card.type ===
              'wild4'
          ) &&
          !isValidColor(
            chosenColor,
          )
        ) {
          socket.emit(
            'game:error',
            {
              message:
                'Please choose a valid color.',
            },
          );

          return;
        }

        if (
          calledUnu &&
          current.hand &&
          current.hand.length >= 1 &&
          current.hand.length <= 2 &&
          !current.calledUno
        ) {
          current.calledUno =
            true;

          current.calledUnu =
            true;

          io.to(room.roomCode)
            .emit(
              'game:unoCalled',
              {
                playerId:
                  current.id,

                name:
                  current.name,
              },
            );
        }

        applyCardPlay(
          io,
          room,
          current,
          card,
          chosenColor,
        );
      },
    );

    socket.on(
      'game:drawCard',
      () => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (
          !room ||
          room.gameStatus !==
            'playing'
        ) {
          return;
        }

        const current =
          room.players[
            room.currentPlayerIndex
          ];

        if (
          !current ||
          current.id !==
            currentUserId ||
          !current.connected ||
          current.hasFinished
        ) {
          return;
        }

        const count =
          room.pendingPenalty >
            0
            ? room.pendingPenalty
            : 1;

        room.pendingPenalty =
          0;

        drawCards(
          room,
          current,
          count,
        );

        if (
          (
            current.hand
              ?.length || 0
          ) > 1
        ) {
          current.calledUno =
            false;

          current.calledUnu =
            false;
        }

        room.lastActionMessage =
          count > 1
            ? `${current.name} drew ${count} penalty cards.`
            : `${current.name} drew a card.`;

        advanceTurn(
          room,
          1,
        );

        broadcastRoomState(
          io,
          room,
        );

        scheduleBotTurn(
          io,
          room,
        );
      },
    );

    socket.on(
      'game:callUno',
      () => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (
          !room ||
          room.gameStatus !==
            'playing'
        ) {
          return;
        }

        const player =
          room.players.find(
            (p) =>
              p.id ===
              currentUserId,
          );

        const isCurrentPlayer =
          room.players[
            room.currentPlayerIndex
          ]?.id ===
          currentUserId;

        if (
          player &&
          !player.hasFinished &&
          isCurrentPlayer &&
          player.hand &&
          player.hand.length >= 1 &&
          player.hand.length <= 2 &&
          !player.calledUno
        ) {
          player.calledUno =
            true;

          player.calledUnu =
            true;

          io.to(room.roomCode)
            .emit(
              'game:unoCalled',
              {
                playerId:
                  player.id,

                name:
                  player.name,
              },
            );

          broadcastRoomState(
            io,
            room,
          );
        }
      },
    );

    socket.on(
      'chat:send',
      ({ text }) => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (!room) {
          return;
        }

        const player =
          room.players.find(
            (p) =>
              p.id ===
                currentUserId &&
              p.connected,
          );

        const cleaned =
          cleanChatText(text);

        const allowed =
          player
            ? allowChat(
                player.id,
              )
            : false;

        if (
          !player ||
          !cleaned ||
          !allowed
        ) {
          if (
            player &&
            !allowed
          ) {
            socket.emit(
              'chat:error',
              {
                message:
                  'You are sending messages too quickly.',
              },
            );
          }

          return;
        }

        const message:
          ChatMessage = {
          id:
            `msg-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,

          roomId:
            room.roomId,

          playerId:
            player.id,

          username:
            player.name.replace(
              /\s*\(AI\)$/,
              '',
            ),

          avatar:
            player.avatar,

          text:
            cleaned,

          timestamp:
            Date.now(),
        };

        room.chatMessages.push(
          message,
        );

        if (
          room.chatMessages.length >
          MAX_CHAT_MESSAGES
        ) {
          room.chatMessages =
            room.chatMessages.slice(
              -MAX_CHAT_MESSAGES,
            );
        }

        io.to(room.roomCode)
          .emit(
            'chat:message',
            message,
          );
      },
    );

    socket.on(
      'voice:join',
      () => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        const player =
          room?.players.find(
            (p) =>
              p.id ===
                currentUserId &&
              p.connected &&
              !p.isBot,
          );

        if (
          !room ||
          !player
        ) {
          return;
        }

        socket.join(
          room.roomCode,
        );

        const existingVoicePeers =
          Array.from(
            room.voicePlayers,
          ).filter(
            (id) =>
              id !==
              player.id,
          );

        room.voicePlayers.add(
          player.id,
        );

        socket.emit(
          'voice:peers',
          {
            playerIds:
              existingVoicePeers,
          },
        );

        socket
          .to(room.roomCode)
          .emit(
            'voice:peer-joined',
            {
              playerId:
                player.id,
            },
          );
      },
    );

    socket.on(
      'voice:leave',
      () => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (!room) {
          return;
        }

        room.voicePlayers.delete(
          currentUserId,
        );

        socket
          .to(room.roomCode)
          .emit(
            'voice:peer-left',
            {
              playerId:
                currentUserId,
            },
          );
      },
    );

    socket.on(
      'reaction:send',
      ({ emoji }) => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        const player =
          room?.players.find(
            (p) =>
              p.id ===
                currentUserId &&
              p.connected,
          );

        if (
          !room ||
          !player ||
          typeof emoji !==
            'string' ||
          !ALLOWED_REACTIONS.has(
            emoji,
          )
        ) {
          return;
        }

        const now =
          Date.now();

        if (
          now -
            (
              reactionRate.get(
                player.id,
              ) || 0
            ) <
          700
        ) {
          return;
        }

        reactionRate.set(
          player.id,
          now,
        );

        io.to(room.roomCode)
          .emit(
            'reaction:show',
            {
              playerId:
                player.id,

              emoji,
            },
          );
      },
    );

    const relayVoice = (
      event: string,
      payload: {
        targetId?: string;
        [key: string]: unknown;
      },
    ) => {
      if (
        !currentRoomCode ||
        !currentUserId ||
        !payload?.targetId
      ) {
        return;
      }

      const room =
        rooms.get(
          currentRoomCode,
        );

      if (!room) {
        return;
      }

      const target =
        room.players.find(
          (p) =>
            p.id ===
              payload.targetId &&
            p.socketId &&
            !p.isBot &&
            p.connected,
        );

      if (
        !target?.socketId
      ) {
        return;
      }

      io.to(
        target.socketId,
      ).emit(
        event,
        {
          ...payload,
          fromId:
            currentUserId,
        },
      );
    };

    socket.on(
      'voice:offer',
      (payload) =>
        relayVoice(
          'voice:offer',
          payload || {},
        ),
    );

    socket.on(
      'voice:answer',
      (payload) =>
        relayVoice(
          'voice:answer',
          payload || {},
        ),
    );

    socket.on(
      'voice:ice-candidate',
      (payload) =>
        relayVoice(
          'voice:ice-candidate',
          payload || {},
        ),
    );

    socket.on(
      'voice:mute',
      ({ muted }) => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        const player =
          room?.players.find(
            (p) =>
              p.id ===
              currentUserId,
          );

        if (
          !room ||
          !player
        ) {
          return;
        }

        io.to(room.roomCode)
          .emit(
            'voice:mute',
            {
              playerId:
                player.id,

              muted:
                Boolean(
                  muted,
                ),
            },
          );
      },
    );

    socket.on(
      'game:rematch',
      () => {
        if (
          !currentRoomCode ||
          !currentUserId
        ) {
          return;
        }

        const room =
          rooms.get(
            currentRoomCode,
          );

        if (
          !room ||
          room.hostId !==
            currentUserId
        ) {
          return;
        }

        initializeGame(
          io,
          room,
        );
      },
    );

    socket.on(
      'room:leave',
      () => {
        if (
          currentRoomCode
        ) {
          const roomCode =
            currentRoomCode;

          handlePlayerLeave(
            io,
            roomCode,
            socket.id,
            true,
          );

          socket.leave(
            roomCode,
          );

          currentRoomCode =
            null;

          currentUserId =
            null;
        }
      },
    );

    socket.on(
      'disconnect',
      () => {
        if (
          currentRoomCode
        ) {
          handlePlayerLeave(
            io,
            currentRoomCode,
            socket.id,
            false,
          );
        }
      },
    );
  },
);

function handlePlayerLeave(
  io: SocketIOServer,
  roomCode: string,
  socketId: string,
  voluntary = false,
) {
  const room =
    rooms.get(roomCode);

  if (!room) {
    return;
  }

  const playerIdx =
    room.players.findIndex(
      (p) =>
        p.socketId ===
        socketId,
    );

  if (
    playerIdx === -1
  ) {
    return;
  }

  const leavingPlayer =
    room.players[playerIdx];

  const leavingName =
    leavingPlayer.name.replace(
      /\s*\(AI\)$/,
      '',
    );

  clearDisconnectTimeout(
    room,
    leavingPlayer.id,
  );

  chatRate.delete(
    leavingPlayer.id,
  );

  reactionRate.delete(
    leavingPlayer.id,
  );

  room.voicePlayers.delete(
    leavingPlayer.id,
  );

  io.to(room.roomCode)
    .emit(
      'voice:peer-left',
      {
        playerId:
          leavingPlayer.id,
      },
    );

  leavingPlayer.socketId =
    undefined;

  if (
    voluntary
  ) {
    if (
      room.gameStatus ===
      'playing'
    ) {
      removePlayerFromActiveMatch(
        io,
        room,
        leavingPlayer.id,
        `${leavingName} left the match.`,
      );

      return;
    }

    room.players.splice(
      playerIdx,
      1,
    );

    if (
      leavingPlayer.isHost
    ) {
      assignNewHost(
        room,
      );
    }

    room.lastActionMessage =
      `${leavingName} left the room.`;

    io.to(room.roomCode)
      .emit(
        'room:playerLeft',
        {
          name:
            leavingName,

          matchEnded:
            false,
        },
      );

    broadcastRoomState(
      io,
      room,
    );

    removeRoomIfEmpty(
      room.roomCode,
    );

    return;
  }

  leavingPlayer.connected =
    false;

  room.lastActionMessage =
    `${leavingName} disconnected. Reconnecting for ${RECONNECT_GRACE_MS / 1000}s...`;

  io.to(room.roomCode)
    .emit(
      'room:playerLeft',
      {
        name:
          leavingName,

        matchEnded:
          false,
      },
    );

  broadcastRoomState(
    io,
    room,
  );

  scheduleDisconnectedPlayerRemoval(
    io,
    room,
    leavingPlayer.id,
  );
}

function removePlayerFromActiveMatch(
  io: SocketIOServer,
  room: ServerRoom,
  playerId: string,
  message: string,
) {
  const idx =
    room.players.findIndex(
      (p) =>
        p.id ===
        playerId,
    );

  if (
    idx === -1
  ) {
    return;
  }

  const leavingPlayer =
    room.players[idx];

  const leavingName =
    leavingPlayer.name.replace(
      /\s*\(AI\)$/,
      '',
    );

  clearDisconnectTimeout(
    room,
    playerId,
  );

  chatRate.delete(
    playerId,
  );

  reactionRate.delete(
    playerId,
  );

  room.voicePlayers.delete(
    playerId,
  );

  io.to(room.roomCode)
    .emit(
      'voice:peer-left',
      {
        playerId,
      },
    );

  if (
    room.botTimeout
  ) {
    clearTimeout(
      room.botTimeout,
    );

    room.botTimeout =
      undefined;
  }

  const wasCurrent =
    room.players[
      room.currentPlayerIndex
    ]?.id ===
    playerId;

  room.players.splice(
    idx,
    1,
  );

  if (
    room.players.length < 2 ||
    getActivePlayerCount(
      room,
    ) <= 1
  ) {
    room.gameStatus =
      'waiting';

    room.winner =
      null;

    room.lastActionMessage =
      message;

    room.rankings =
      room.rankings.filter(
        (player) =>
          player.id !==
          playerId,
      );

    io.to(room.roomCode)
      .emit(
        'room:playerLeft',
        {
          name:
            leavingName,

          matchEnded:
            true,
        },
      );

    broadcastRoomState(
      io,
      room,
    );

    setTimeout(() => {
      const currentRoom =
        rooms.get(
          room.roomCode,
        );

      if (!currentRoom) {
        return;
      }

      if (
        currentRoom.players.filter(
          (p) =>
            !p.isBot,
        ).length === 0
      ) {
        currentRoom.disconnectTimeouts.forEach(
          (timeout) =>
            clearTimeout(
              timeout,
            ),
        );

        currentRoom.disconnectTimeouts.clear();

        rooms.delete(
          currentRoom.roomCode,
        );
      }
    }, 1600);

    return;
  }

  if (
    idx <
    room.currentPlayerIndex
  ) {
    room.currentPlayerIndex -= 1;
  } else if (
    wasCurrent
  ) {
    room.currentPlayerIndex =
      room.currentPlayerIndex %
      room.players.length;
  }

  room.currentPlayerIndex =
    findNextActivePlayerIndex(
      room,
      room.currentPlayerIndex,
      room.turnDirection,
    );

  if (
    room.currentPlayerIndex >=
    room.players.length
  ) {
    room.currentPlayerIndex =
      0;
  }

  if (
    leavingPlayer.isHost
  ) {
    assignNewHost(
      room,
    );
  }

  room.lastActionMessage =
    message;

  io.to(room.roomCode)
    .emit(
      'room:playerLeft',
      {
        name:
          leavingName,

        matchEnded:
          false,
      },
    );

  broadcastRoomState(
    io,
    room,
  );

  scheduleBotTurn(
    io,
    room,
  );
}

const chatRate =
  new Map<string, number[]>();

const reactionRate =
  new Map<string, number>();

function cleanChatText(
  value: unknown,
): string {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  return value
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 200);
}

function allowChat(
  playerId: string,
): boolean {
  const now =
    Date.now();

  const recent = (
    chatRate.get(
      playerId,
    ) || []
  ).filter(
    (t) =>
      now - t <
      5000,
  );

  if (
    recent.length >= 8
  ) {
    chatRate.set(
      playerId,
      recent,
    );

    return false;
  }

  recent.push(now);

  chatRate.set(
    playerId,
    recent,
  );

  return true;
}

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      status:
        'ok',

      activeRooms:
        rooms.size,
    });
  },
);

app.get(
  '/api/room/check/:code',
  (req, res) => {
    const code =
      (
        req.params.code ||
        ''
      )
        .toUpperCase()
        .trim();

    const room =
      rooms.get(code);

    if (!room) {
      return res
        .status(404)
        .json({
          exists: false,

          message:
            'Room not found',
        });
    }

    if (
      room.players.length >=
      8
    ) {
      return res
        .status(400)
        .json({
          exists: true,

          full: true,

          message:
            'Room is full',
        });
    }

    if (
      room.gameStatus ===
      'playing'
    ) {
      return res
        .status(400)
        .json({
          exists: true,

          started: true,

          message:
            'Game already in progress',
        });
    }

    return res.json({
      exists: true,

      playerCount:
        room.players.length,

      status:
        room.gameStatus,
    });
  },
);

async function startServer() {
  if (
    process.env.NODE_ENV !==
    'production'
  ) {
    const vite =
      await createViteServer({
        server: {
          middlewareMode:
            true,
        },

        appType: 'spa',
      });

    app.use(
      vite.middlewares,
    );
  } else {
    const distPath =
      path.join(
        process.cwd(),
        'dist',
      );

    app.use(
      express.static(
        distPath,
      ),
    );

    app.get(
      '*',
      (req, res) => {
        res.sendFile(
          path.join(
            distPath,
            'index.html',
          ),
        );
      },
    );
  }

  server.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `UNU KING Server running on http://0.0.0.0:${PORT}`,
      );
    },
  );
}

startServer();
