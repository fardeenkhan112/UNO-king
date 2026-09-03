import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import {
  Card,
  CardColor,
  CardType,
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
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

interface ServerRoom {
  roomId: string;
  roomCode: string;
  players: (Player & { socketId?: string })[];
  hostId: string;
  gameStatus: 'waiting' | 'starting' | 'playing' | 'finished';
  deck: Card[];
  discardPile: Card[];
  topCard: Card | null;
  activeColor: CardColor;
  currentPlayerIndex: number;
  turnDirection: 1 | -1;
  pendingPenalty: number;
  winner: Player | null;
  rankings: Player[];
  settings: GameSettings;
  lastActionMessage: string;
  botTimeout?: NodeJS.Timeout;
  disconnectTimeouts: Map<string, NodeJS.Timeout>;
}

const rooms = new Map<string, ServerRoom>(); // key is roomCode
const RECONNECT_GRACE_MS = 15000;
const MAX_NAME_LENGTH = 16;
const VALID_COLORS = new Set<CardColor>(['gold', 'crimson', 'sapphire', 'emerald']);

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

// Prepare client-safe state (hiding opponent hands)
function getClientGameState(room: ServerRoom, forPlayerId?: string): GameState {
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    hostId: room.hostId,
    gameStatus: room.gameStatus,
    topCard: room.topCard,
    activeColor: room.activeColor,
    currentPlayerIndex: room.currentPlayerIndex,
    turnDirection: room.turnDirection,
    pendingPenalty: room.pendingPenalty,
    winner: room.winner,
    rankings: room.rankings,
    settings: room.settings,
    lastActionMessage: room.lastActionMessage,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      isHost: p.isHost,
      cardCount: p.hand ? p.hand.length : 0,
      connected: p.connected,
      calledUno: Boolean(p.calledUno || p.calledUnu),
      calledUnu: Boolean(p.calledUno || p.calledUnu),
      // Hand is ONLY revealed to the owner
      hand: forPlayerId && p.id === forPlayerId ? p.hand : undefined,
    })),
  };
}

// Broadcast game state to each player in the room privately
function broadcastRoomState(io: SocketIOServer, room: ServerRoom) {
  room.players.forEach((p) => {
    if (!p.isBot && p.socketId) {
      io.to(p.socketId).emit('game:state', getClientGameState(room, p.id));
    }
  });
}

// Advance turn safely
function advanceTurn(room: ServerRoom, steps: number = 1) {
  const n = room.players.length;
  if (n === 0) return;

  const effectiveSteps = steps * room.turnDirection;
  room.currentPlayerIndex = (room.currentPlayerIndex + effectiveSteps) % n;
  if (room.currentPlayerIndex < 0) {
    room.currentPlayerIndex += n;
  }

  // Reset player's calledUnu if they hold more than 1 card
  const current = room.players[room.currentPlayerIndex];
  if (current && current.hand && current.hand.length > 1) {
    current.calledUnu = false;
    current.calledUno = false;
  }

}

// Schedule an AI turn without forcing a time limit on human players.
function scheduleBotTurn(io: SocketIOServer, room: ServerRoom) {
  if (room.botTimeout) clearTimeout(room.botTimeout);
  const currPlayer = room.players[room.currentPlayerIndex];
  if (currPlayer && currPlayer.isBot && room.gameStatus === 'playing') {
    const delay = 900 + Math.random() * 800;
    room.botTimeout = setTimeout(() => {
      room.botTimeout = undefined;
      executeBotTurn(io, room, currPlayer);
    }, delay);
  }
}

// Draw cards from deck, reshuffling discard pile if needed
function drawCards(room: ServerRoom, player: Player, count: number): Card[] {
  const drawn: Card[] = [];
  if (!player.hand) player.hand = [];

  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.discardPile.length > 1) {
        // Keep top card, shuffle rest back into deck
        const top = room.discardPile.pop()!;
        room.deck = room.discardPile;
        // Reshuffle
        for (let j = room.deck.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [room.deck[j], room.deck[k]] = [room.deck[k], room.deck[j]];
        }
        room.discardPile = [top];
      } else {
        // No drawable cards remain without duplicating cards still held by players.
        break;
      }
    }
    const card = room.deck.pop();
    if (card) {
      player.hand.push(card);
      drawn.push(card);
    }
  }

  player.cardCount = player.hand.length;
  return drawn;
}

// Execute Bot Turn
function executeBotTurn(io: SocketIOServer, room: ServerRoom, bot: Player) {
  if (room.gameStatus !== 'playing') return;
  if (room.players[room.currentPlayerIndex]?.id !== bot.id) return;

  const botHand = bot.hand || [];
  const move = pickBotMove(
    botHand,
    room.topCard,
    room.activeColor,
    room.pendingPenalty,
    room.settings.stacking
  );

  if (move.card) {
    // Check UNO call
    if (botHand.length === 2) {
      bot.calledUnu = true;
      bot.calledUno = true;
      io.to(room.roomCode).emit('game:unoCalled', { playerId: bot.id, name: bot.name });
    }

    applyCardPlay(io, room, bot, move.card, move.chosenColor);
  } else {
    // Bot must draw
    const penaltyToTake = room.pendingPenalty > 0 ? room.pendingPenalty : 1;
    room.pendingPenalty = 0;
    drawCards(room, bot, penaltyToTake);

    room.lastActionMessage =
      penaltyToTake > 1
        ? `${bot.name} drew ${penaltyToTake} penalty cards.`
        : `${bot.name} drew a card.`;

    advanceTurn(room, 1);
    broadcastRoomState(io, room);
    scheduleBotTurn(io, room);
  }
}

// Apply a card play
function applyCardPlay(
  io: SocketIOServer,
  room: ServerRoom,
  player: Player,
  card: Card,
  chosenColor?: CardColor
) {
  // Remove card from player hand
  player.hand = player.hand?.filter((c) => c.id !== card.id) || [];
  player.cardCount = player.hand.length;

  // Add to discard pile
  room.discardPile.push(card);
  room.topCard = card;

  // Check victory
  if (player.hand.length === 0) {
    room.gameStatus = 'finished';
    room.winner = player;
    if (room.botTimeout) clearTimeout(room.botTimeout);

    // Calculate final rankings by remaining card count
    const sorted = [...room.players].sort(
      (a, b) => (a.hand?.length || 0) - (b.hand?.length || 0)
    );
    room.rankings = sorted;
    room.lastActionMessage = `👑 ${player.name} played their last card and WON the crown!`;

    broadcastRoomState(io, room);
    return;
  }

  // Handle Action Cards
  let steps = 1;

  if (card.color === 'wild' || card.type === 'wild' || card.type === 'wild4') {
    room.activeColor = chosenColor || 'gold';
  } else {
    room.activeColor = card.color;
  }

  if (card.type === 'skip') {
    steps = 2;
    room.lastActionMessage = `${player.name} played a Skip! Next player skipped.`;
  } else if (card.type === 'reverse') {
    if (room.players.length === 2) {
      steps = 2; // In 2-player, Reverse behaves like Skip
      room.lastActionMessage = `${player.name} reversed direction! Next turn skipped.`;
    } else {
      room.turnDirection = (room.turnDirection * -1) as 1 | -1;
      steps = 1;
      room.lastActionMessage = `${player.name} reversed the turn direction!`;
    }
  } else if (card.type === 'draw2') {
    if (room.settings.stacking) {
      room.pendingPenalty += 2;
      steps = 1;
      room.lastActionMessage = `${player.name} stacked +2! (+${room.pendingPenalty} pending)`;
    } else {
      // Regular +2: next player draws 2 and is skipped
      advanceTurn(room, 1);
      const nextPlayer = room.players[room.currentPlayerIndex];
      drawCards(room, nextPlayer, 2);
      room.lastActionMessage = `${player.name} played +2! ${nextPlayer.name} drew 2 cards and lost their turn.`;
      steps = 1;
    }
  } else if (card.type === 'wild4') {
    if (room.settings.stacking) {
      room.pendingPenalty += 4;
      steps = 1;
      room.lastActionMessage = `${player.name} played Wild +4 to ${room.activeColor}! (+${room.pendingPenalty} pending)`;
    } else {
      advanceTurn(room, 1);
      const nextPlayer = room.players[room.currentPlayerIndex];
      drawCards(room, nextPlayer, 4);
      room.lastActionMessage = `${player.name} played Wild +4 to ${room.activeColor}! ${nextPlayer.name} drew 4 cards.`;
      steps = 1;
    }
  } else if (card.type === 'wild') {
    steps = 1;
    room.lastActionMessage = `${player.name} played a Wild card and chose ${room.activeColor.toUpperCase()}!`;
  } else {
    steps = 1;
    room.lastActionMessage = `${player.name} played ${card.color.toUpperCase()} ${card.value}.`;
  }

  advanceTurn(room, steps);
  broadcastRoomState(io, room);
  scheduleBotTurn(io, room);
}

// Start game setup
function initializeGame(io: SocketIOServer, room: ServerRoom) {
  // Must have at least 2 participants (at least 1 human + 1 bot or another player)
  if (room.players.length < 2) {
    io.to(room.roomCode).emit('room:error', {
      message: 'At least 2 players (or 1 bot) are required to start the game!',
    });
    return;
  }

  // Create & shuffle deck
  const deck = createDeck();
  room.deck = deck;
  room.discardPile = [];
  room.winner = null;
  room.rankings = [];
  room.pendingPenalty = 0;
  room.turnDirection = 1;
  room.currentPlayerIndex = 0;
  room.gameStatus = 'playing';
  room.settings.stacking = Boolean(room.settings.stacking);

  // Deal 7 cards to each player
  room.players.forEach((p) => {
    p.hand = [];
    for (let i = 0; i < 7; i++) {
      const c = room.deck.pop();
      if (c) p.hand.push(c);
    }
    p.cardCount = p.hand.length;
    p.calledUnu = false;
    p.calledUno = false;
  });

  // Pick a neutral number card for the opening discard. This avoids a special-card effect
  // being silently ignored before the first player gets a chance to act.
  let initialCard: Card = room.deck.pop()!;
  while (initialCard.type !== 'number') {
    room.deck.unshift(initialCard);
    initialCard = room.deck.pop()!;
  }

  room.discardPile.push(initialCard);
  room.topCard = initialCard;
  room.activeColor = initialCard.color === 'wild' ? 'gold' : initialCard.color;
  room.lastActionMessage = `Match started! Top card is ${room.topCard.color.toUpperCase()} ${room.topCard.type === 'number' ? room.topCard.value : room.topCard.type}.`;

  broadcastRoomState(io, room);
  scheduleBotTurn(io, room);
}

function normalizeName(value: unknown, fallback = 'Player'): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[<>]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return cleaned || fallback;
}

function isValidColor(value: unknown): value is CardColor {
  return typeof value === 'string' && VALID_COLORS.has(value as CardColor);
}

function clearDisconnectTimeout(room: ServerRoom, playerId: string) {
  const timeout = room.disconnectTimeouts.get(playerId);
  if (timeout) clearTimeout(timeout);
  room.disconnectTimeouts.delete(playerId);
}

function assignNewHost(room: ServerRoom): boolean {
  room.players.forEach((p) => { p.isHost = false; });
  const nextHuman = room.players.find((p) => !p.isBot && p.connected);
  if (!nextHuman) return false;
  nextHuman.isHost = true;
  room.hostId = nextHuman.id;
  room.lastActionMessage = `${nextHuman.name} is now the host.`;
  return true;
}

// Socket.io connection handling
const io = new SocketIOServer(server, {
  // Set FRONTEND_URL on Render to your Netlify URL for tighter security.
  // Falls back to '*' so it still works before you set it.
  cors: { origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((v) => v.trim()) : '*' },
});

io.on('connection', (socket: Socket) => {
  let currentRoomCode: string | null = null;
  let currentUserId: string | null = null;

  // Create room
  socket.on('room:create', ({ playerName, avatar, settings, initialBots, playerId: requestedPlayerId }) => {
    const roomCode = generateRoomCode();
    const playerId = typeof requestedPlayerId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(requestedPlayerId)
      ? requestedPlayerId
      : `player-${socket.id.substring(0, 6)}`;
    currentRoomCode = roomCode;
    currentUserId = playerId;

    const newRoom: ServerRoom = {
      roomId: `room-${Date.now()}`,
      roomCode,
      players: [
        {
          id: playerId,
          socketId: socket.id,
          name: normalizeName(playerName, 'Host'),
          avatar: avatar || '👑',
          isBot: false,
          isHost: true,
          cardCount: 0,
          connected: true,
          hand: [],
        },
      ],
      hostId: playerId,
      gameStatus: 'waiting',
      deck: [],
      discardPile: [],
      topCard: null,
      activeColor: 'gold',
      currentPlayerIndex: 0,
      turnDirection: 1,
      pendingPenalty: 0,
      winner: null,
      rankings: [],
      settings: {
        stacking: settings?.stacking !== undefined ? Boolean(settings.stacking) : true,
      },
      lastActionMessage: 'Lobby created. Invite friends or add bots to begin.',
      disconnectTimeouts: new Map(),
    };

    // Pre-populate initial bots if requested
    if (typeof initialBots === 'number' && initialBots > 0) {
      const botsToAdd = Math.min(initialBots, 7);
      for (let i = 0; i < botsToAdd; i++) {
        const usedNames = new Set(newRoom.players.map((p) => p.name));
        const available = BOT_PROFILES.filter((b) => !usedNames.has(b.name));
        const chosen = available.length > 0 ? available[0] : BOT_PROFILES[newRoom.players.length % BOT_PROFILES.length];
        const botId = `bot-${Date.now()}-${i}`;
        newRoom.players.push({
          id: botId,
          name: chosen.name,
          avatar: chosen.avatar,
          isBot: true,
          isHost: false,
          cardCount: 0,
          connected: true,
          hand: [],
        });
      }
    }

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);

    socket.emit('room:created', {
      roomCode,
      playerId,
      state: getClientGameState(newRoom, playerId),
    });
  });

  // Join room
  socket.on('room:join', ({ roomCode, playerName, avatar, playerId: requestedPlayerId }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room:error', { message: 'Room not found. Please verify the 4-letter code.' });
      return;
    }

    if (room.players.length >= 8) {
      socket.emit('room:error', { message: 'This room is full (maximum 8 players).' });
      return;
    }

    if (room.gameStatus === 'playing') {
      socket.emit('room:error', { message: 'Game has already started in this room.' });
      return;
    }

    const requested = typeof requestedPlayerId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(requestedPlayerId) ? requestedPlayerId : '';
    const playerId = requested && !room.players.some((p) => p.id === requested) ? requested : `player-${socket.id.substring(0, 6)}`;
    currentRoomCode = code;
    currentUserId = playerId;

    room.players.push({
      id: playerId,
      socketId: socket.id,
      name: normalizeName(playerName, `Player ${room.players.length + 1}`),
      avatar: typeof avatar === 'string' && avatar.length <= 8 ? avatar : '🦁',
      isBot: false,
      isHost: false,
      cardCount: 0,
      connected: true,
      hand: [],
    });

    socket.join(code);
    room.lastActionMessage = `${playerName || 'A player'} joined the lobby!`;

    broadcastRoomState(io, room);
    socket.emit('room:joined', {
      roomCode: code,
      playerId,
      state: getClientGameState(room, playerId),
    });
  });

  // Reconnect an existing player after a temporary disconnect
  socket.on('room:reconnect', ({ roomCode, playerId }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room || typeof playerId !== 'string') return;

    const player = room.players.find((p) => p.id === playerId && !p.isBot);
    if (!player) return;

    clearDisconnectTimeout(room, player.id);
    player.socketId = socket.id;
    player.connected = true;
    currentRoomCode = code;
    currentUserId = player.id;
    socket.join(code);

    socket.emit('room:reconnected', {
      roomCode: code,
      playerId: player.id,
      state: getClientGameState(room, player.id),
    });
    broadcastRoomState(io, room);

    if (room.gameStatus === 'playing' && room.players[room.currentPlayerIndex]?.id === player.id) {
      scheduleBotTurn(io, room);
    }
  });

  // Add bot
  socket.on('room:addBot', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'waiting' || room.hostId !== currentUserId) return;
    if (room.players.length >= 8) return;

    // Pick unused bot profile if possible
    const usedNames = new Set(room.players.map((p) => p.name));
    const available = BOT_PROFILES.filter((b) => !usedNames.has(b.name));
    const chosen = available.length > 0 ? available[0] : BOT_PROFILES[room.players.length % BOT_PROFILES.length];

    const botId = `bot-${Date.now()}-${room.players.length}`;
    room.players.push({
      id: botId,
      name: chosen.name,
      avatar: chosen.avatar,
      isBot: true,
      isHost: false,
      cardCount: 0,
      connected: true,
      hand: [],
    });

    room.lastActionMessage = `Bot ${chosen.name} was added.`;
    broadcastRoomState(io, room);
  });

  // Remove bot
  socket.on('room:removeBot', ({ botId }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'waiting' || room.hostId !== currentUserId) return;

    const idx = room.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx !== -1) {
      const removed = room.players.splice(idx, 1)[0];
      room.lastActionMessage = `Bot ${removed.name} was removed.`;
      broadcastRoomState(io, room);
    }
  });

  // Update Settings
  socket.on('room:updateSettings', (newSettings: Partial<GameSettings>) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentUserId) return;

    if (room.gameStatus !== 'waiting') return;
    const nextStacking = newSettings?.stacking;
    const validated: Partial<GameSettings> = {};
    if (nextStacking !== undefined) validated.stacking = Boolean(nextStacking);
    room.settings = { ...room.settings, ...validated };
      broadcastRoomState(io, room);
  });

  // Start Game
  socket.on('room:start', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentUserId) return;

    initializeGame(io, room);
  });

  // Play Card
  socket.on('game:playCard', ({ cardId, chosenColor, calledUnu }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'playing') return;

    const current = room.players[room.currentPlayerIndex];
    if (!current || current.id !== currentUserId) return;

    const card = current.hand?.find((c) => c.id === cardId);
    if (!card) return;

    // Validate legality
    const legal = isLegalMove(
      card,
      room.topCard,
      room.activeColor,
      room.pendingPenalty,
      room.settings.stacking
    );

    if (!legal) {
      socket.emit('game:error', { message: 'Illegal move!' });
      return;
    }

    if ((card.type === 'wild' || card.type === 'wild4') && !isValidColor(chosenColor)) {
      socket.emit('game:error', { message: 'Please choose a valid color.' });
      return;
    }

    if (calledUnu && current.hand && current.hand.length >= 1 && current.hand.length <= 2 && !current.calledUno) {
      current.calledUno = true;
      current.calledUnu = true;
      io.to(room.roomCode).emit('game:unoCalled', { playerId: current.id, name: current.name });
    }

    applyCardPlay(io, room, current, card, chosenColor);
  });

  // Draw Card
  socket.on('game:drawCard', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'playing') return;

    const current = room.players[room.currentPlayerIndex];
    if (!current || current.id !== currentUserId) return;

    const count = room.pendingPenalty > 0 ? room.pendingPenalty : 1;
    room.pendingPenalty = 0;
    drawCards(room, current, count);
    if ((current.hand?.length || 0) > 1) {
      current.calledUno = false;
      current.calledUnu = false;
    }

    room.lastActionMessage =
      count > 1
        ? `${current.name} drew ${count} penalty cards.`
        : `${current.name} drew a card.`;

    advanceTurn(room, 1);
    broadcastRoomState(io, room);
    scheduleBotTurn(io, room);
  });

  // Call UNO
  socket.on('game:callUno', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.gameStatus !== 'playing') return;
    const player = room.players.find((p) => p.id === currentUserId);
    const isCurrentPlayer = room.players[room.currentPlayerIndex]?.id === currentUserId;
    if (player && isCurrentPlayer && player.hand && player.hand.length >= 1 && player.hand.length <= 2 && !player.calledUno) {
      player.calledUno = true;
      player.calledUnu = true;
      io.to(room.roomCode).emit('game:unoCalled', { playerId: player.id, name: player.name });
      broadcastRoomState(io, room);
    }
  });

  // In-game text chat
  socket.on('chat:send', ({ text }) => {
    if (!currentRoomCode || !currentUserId) return;
    const room = rooms.get(currentRoomCode);
    if (!room || !room.players.some((p) => p.id === currentUserId && p.connected)) return;
    const player = room.players.find((p) => p.id === currentUserId);
    const cleaned = cleanChatText(text);
    const allowed = player ? allowChat(player.id) : false;
    if (!player || !cleaned || !allowed) {
      if (player && !allowed) socket.emit('chat:error', { message: 'You are sending messages too quickly.' });
      return;
    }
    io.to(room.roomCode).emit('chat:message', {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      roomId: room.roomId,
      playerId: player.id,
      username: player.name.replace(/ \(AI\)$/, ''),
      avatar: player.avatar,
      text: cleaned,
      timestamp: Date.now(),
    });
  });

  // Voice presence/signaling. The server relays signaling only; it never stores audio.
  socket.on('voice:join', () => {
    if (!currentRoomCode || !currentUserId) return;
    const room = rooms.get(currentRoomCode);
    const player = room?.players.find((p) => p.id === currentUserId && p.connected && !p.isBot);
    if (!room || !player) return;
    socket.join(room.roomCode);
    socket.to(room.roomCode).emit('voice:peer-joined', { playerId: player.id });
  });

  socket.on('voice:leave', () => {
    if (!currentRoomCode || !currentUserId) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    socket.to(room.roomCode).emit('voice:peer-left', { playerId: currentUserId });
  });

  socket.on('reaction:send', ({ emoji }) => {
    if (!currentRoomCode || !currentUserId) return;
    const room = rooms.get(currentRoomCode);
    const player = room?.players.find((p) => p.id === currentUserId && p.connected);
    const allowed = new Set(['😂', '😭', '😈', '🔥', '💀', '👑', '🎉', '😎', '❤️', '👍', '😡', '😱']);
    if (!room || !player || typeof emoji !== 'string' || !allowed.has(emoji)) return;
    const now = Date.now();
    if (now - (reactionRate.get(player.id) || 0) < 700) return;
    reactionRate.set(player.id, now);
    io.to(room.roomCode).emit('reaction:show', { playerId: player.id, emoji });
  });

  // WebRTC signaling relay: server never handles or stores audio.
  const relayVoice = (event: string, payload: { targetId?: string; [key: string]: unknown }) => {
    if (!currentRoomCode || !currentUserId || !payload?.targetId) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const target = room.players.find((p) => p.id === payload.targetId && p.socketId && !p.isBot);
    if (!target?.socketId) return;
    io.to(target.socketId).emit(event, { ...payload, fromId: currentUserId });
  };

  socket.on('voice:offer', (payload) => relayVoice('voice:offer', payload || {}));
  socket.on('voice:answer', (payload) => relayVoice('voice:answer', payload || {}));
  socket.on('voice:ice-candidate', (payload) => relayVoice('voice:ice-candidate', payload || {}));
  socket.on('voice:mute', ({ muted }) => {
    if (!currentRoomCode || !currentUserId) return;
    const room = rooms.get(currentRoomCode);
    const player = room?.players.find((p) => p.id === currentUserId);
    if (!room || !player) return;
    io.to(room.roomCode).emit('voice:mute', { playerId: player.id, muted: Boolean(muted) });
  });

  // Rematch
  socket.on('game:rematch', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.hostId !== currentUserId) return;

    initializeGame(io, room);
  });

  // Leave room
  socket.on('room:leave', () => {
    if (currentRoomCode) {
      handlePlayerLeave(io, currentRoomCode, socket.id, true);
      socket.leave(currentRoomCode);
      currentRoomCode = null;
      currentUserId = null;
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (currentRoomCode) {
      handlePlayerLeave(io, currentRoomCode, socket.id, false);
    }
  });
});

function handlePlayerLeave(io: SocketIOServer, roomCode: string, socketId: string, voluntary = false) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const playerIdx = room.players.findIndex((p) => p.socketId === socketId);
  if (playerIdx === -1) return;

  const leavingPlayer = room.players[playerIdx];
  const leavingName = leavingPlayer.name.replace(/ \(AI\)$/, '');
  chatRate.delete(leavingPlayer.id);
  reactionRate.delete(leavingPlayer.id);
  io.to(room.roomCode).emit('voice:peer-left', { playerId: leavingPlayer.id });
  clearDisconnectTimeout(room, leavingPlayer.id);
  leavingPlayer.socketId = undefined;

  // Waiting-room leave: simply remove the participant.
  if (room.gameStatus !== 'playing') {
    room.players.splice(playerIdx, 1);
    if (leavingPlayer.isHost) assignNewHost(room);

    const humanCount = room.players.filter((p) => !p.isBot).length;
    if (humanCount === 0) {
      if (room.botTimeout) clearTimeout(room.botTimeout);
      room.disconnectTimeouts.forEach(clearTimeout);
      room.disconnectTimeouts.clear();
      rooms.delete(roomCode);
      return;
    }

    room.lastActionMessage = `${leavingName} left the room.`;
    io.to(room.roomCode).emit('room:playerLeft', { name: leavingName, matchEnded: false });
    broadcastRoomState(io, room);
    return;
  }

  // During a live match we give an accidental network drop a short grace period.
  if (!voluntary) {
    leavingPlayer.connected = false;
    room.lastActionMessage = `${leavingName} disconnected. Reconnecting for ${RECONNECT_GRACE_MS / 1000}s...`;

    if (leavingPlayer.isHost) {
      assignNewHost(room);
    }

    io.to(room.roomCode).emit('room:playerLeft', { name: leavingName, matchEnded: false });
    broadcastRoomState(io, room);

    const timeout = setTimeout(() => {
      const currentRoom = rooms.get(roomCode);
      if (!currentRoom || currentRoom.gameStatus !== 'playing') return;

      const player = currentRoom.players.find((p) => p.id === leavingPlayer.id);
      if (!player || player.connected) return;

      removePlayerFromActiveMatch(io, currentRoom, player.id, `${leavingName} left the match.`);
    }, RECONNECT_GRACE_MS);

    room.disconnectTimeouts.set(leavingPlayer.id, timeout);
    return;
  }

  removePlayerFromActiveMatch(io, room, leavingPlayer.id, `${leavingName} left the match.`);
}

function removePlayerFromActiveMatch(
  io: SocketIOServer,
  room: ServerRoom,
  playerId: string,
  message: string,
) {
  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return;

  const leavingPlayer = room.players[idx];
  const leavingName = leavingPlayer.name.replace(/ \(AI\)$/, '');

  clearDisconnectTimeout(room, playerId);
  chatRate.delete(playerId);
  reactionRate.delete(playerId);
  io.to(room.roomCode).emit('voice:peer-left', { playerId });
  if (room.botTimeout) {
    clearTimeout(room.botTimeout);
    room.botTimeout = undefined;
  }

  // Remove the player completely. Never replace a human leaver with an AI.
  room.players.splice(idx, 1);

  if (room.players.length < 2) {
    // A match cannot continue with fewer than two participants. Do not mark this
    // as a normal game victory, otherwise the result modal would incorrectly open.
    room.gameStatus = 'waiting';
    room.winner = null;
    room.lastActionMessage = message;

    io.to(room.roomCode).emit('room:playerLeft', {
      name: leavingName,
      matchEnded: true,
    });

    broadcastRoomState(io, room);

    // The room is no longer playable, but keep it briefly so the remaining client
    // can receive the notification before returning home.
    setTimeout(() => {
      const currentRoom = rooms.get(room.roomCode);
      if (currentRoom && currentRoom.gameStatus === 'finished' && currentRoom.players.length < 2) {
        currentRoom.disconnectTimeouts.forEach(clearTimeout);
        currentRoom.disconnectTimeouts.clear();
        rooms.delete(room.roomCode);
      }
    }, 1600);

    return;
  }

  // Keep the turn pointing at the correct player after removing an index.
  if (idx < room.currentPlayerIndex) {
    room.currentPlayerIndex -= 1;
  } else if (idx === room.currentPlayerIndex) {
    room.currentPlayerIndex = room.currentPlayerIndex % room.players.length;
  }

  if (room.currentPlayerIndex < 0) room.currentPlayerIndex = room.players.length - 1;
  if (room.currentPlayerIndex >= room.players.length) room.currentPlayerIndex = 0;

  if (leavingPlayer.isHost) {
    assignNewHost(room);
  }

  room.lastActionMessage = message;
  io.to(room.roomCode).emit('room:playerLeft', {
    name: leavingName,
    matchEnded: false,
  });

  broadcastRoomState(io, room);
  scheduleBotTurn(io, room);
}

// ----- In-game chat -----
const chatRate = new Map<string, number[]>();
const reactionRate = new Map<string, number>();

function cleanChatText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, 200);
}

function allowChat(playerId: string): boolean {
  const now = Date.now();
  const recent = (chatRate.get(playerId) || []).filter((t) => now - t < 5000);
  if (recent.length >= 8) {
    chatRate.set(playerId, recent);
    return false;
  }
  recent.push(now);
  chatRate.set(playerId, recent);
  return true;
}

// Chat handlers
// These are registered below through Socket.IO connection handlers.

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size });
});

app.get('/api/room/check/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ exists: false, message: 'Room not found' });
  }
  if (room.players.length >= 8) {
    return res.status(400).json({ exists: true, full: true, message: 'Room is full' });
  }
  if (room.gameStatus === 'playing') {
    return res.status(400).json({ exists: true, started: true, message: 'Game already in progress' });
  }
  res.json({
    exists: true,
    playerCount: room.players.length,
    status: room.gameStatus,
  });
});

// Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`UNU KING Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
