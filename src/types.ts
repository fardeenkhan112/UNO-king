export type CardColor = 'gold' | 'crimson' | 'sapphire' | 'emerald' | 'wild';

export type CardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface Card {
  id: string;
  color: CardColor;
  type: CardType;
  value?: number; // 0-9 for numbers
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  isHost: boolean;
  cardCount: number;
  hand?: Card[];
  connected: boolean;
  calledUno?: boolean;
  calledUnu?: boolean; // backwards compatibility
}

export interface GameSettings {
  stacking: boolean; // allow stacking +2 or +4
}

export type GameStatus = 'waiting' | 'starting' | 'playing' | 'finished';

export interface GameState {
  roomId: string;
  roomCode: string;
  players: Player[];
  hostId: string;
  gameStatus: GameStatus;
  topCard: Card | null;
  activeColor: CardColor;
  currentPlayerIndex: number;
  turnDirection: 1 | -1; // 1 = clockwise, -1 = counter-clockwise
  pendingPenalty: number;
  winner: Player | null;
  rankings?: Player[];
  settings: GameSettings;
  lastActionMessage?: string;
  drawCountRemaining?: number;
}

export interface UserProfile {
  name: string;
  avatar: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  playerId: string;
  username: string;
  avatar?: string;
  text: string;
  timestamp: number;
}

export interface VoicePeerState {
  playerId: string;
  muted: boolean;
}

export interface SinglePlayerSetup {
  botCount: number; // 1 to 7
  stacking: boolean;
}
