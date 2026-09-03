import { Card, CardColor, CardType, Player } from '../types';

export const BOT_PROFILES = [
  { name: 'Nova', avatar: '🐺', desc: 'Aggressive & bold', style: 'attack' },
  { name: 'Blaze', avatar: '🦁', desc: 'Loves wild shifts & +4s', style: 'wild' },
  { name: 'Rex', avatar: '👑', desc: 'Tactical royal strategist', style: 'smart' },
  { name: 'Shadow', avatar: '🦅', desc: 'Swift & unpredictable', style: 'swift' },
  { name: 'Pixel', avatar: '🤖', desc: 'Color frequency analyzer', style: 'color' },
  { name: 'Luna', avatar: '🌙', desc: 'Balanced card saver', style: 'defense' },
  { name: 'Ace', avatar: '⚡', desc: 'High risk, high reward', style: 'chaos' },
];

export const AVATAR_OPTIONS = ['👑', '🦁', '🐺', '🦅', '⚡', '🌙', '🐱', '🦊', '🐉', '🐯', '🐼', '💎'];

export const COLOR_CONFIG: Record<CardColor, { name: string; hex: string; bgClass: string; textClass: string; borderClass: string; gradient: string }> = {
  gold: {
    name: 'Royal Gold',
    hex: '#F59E0B',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-300',
    gradient: 'from-[#FDE047] via-[#F59E0B] to-[#B45309]',
  },
  crimson: {
    name: 'Royal Crimson',
    hex: '#FF1E56',
    bgClass: 'bg-rose-600',
    textClass: 'text-rose-300',
    borderClass: 'border-rose-300',
    gradient: 'from-[#FF3B69] via-[#E11D48] to-[#881337]',
  },
  sapphire: {
    name: 'Royal Sapphire',
    hex: '#2563EB',
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-300',
    borderClass: 'border-blue-300',
    gradient: 'from-[#38BDF8] via-[#2563EB] to-[#1E3A8A]',
  },
  emerald: {
    name: 'Royal Emerald',
    hex: '#10B981',
    bgClass: 'bg-emerald-600',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-300',
    gradient: 'from-[#34D399] via-[#059669] to-[#064E3B]',
  },
  wild: {
    name: 'Royal Wild',
    hex: '#A855F7',
    bgClass: 'bg-purple-600',
    textClass: 'text-purple-300',
    borderClass: 'border-amber-400',
    gradient: 'from-[#EC4899] via-[#8B5CF6] to-[#3B82F6]',
  },
};

let cardCounter = 0;
function nextCardId(prefix: string): string {
  cardCounter += 1;
  return `${prefix}-${cardCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

// Generate a full standard 108-card UNU deck
export function createDeck(): Card[] {
  const deck: Card[] = [];
  const standardColors: CardColor[] = ['gold', 'crimson', 'sapphire', 'emerald'];

  standardColors.forEach((color) => {
    // One 0 per color
    deck.push({
      id: nextCardId(`${color}-0`),
      color,
      type: 'number',
      value: 0,
    });

    // Two 1-9 per color
    for (let v = 1; v <= 9; v++) {
      deck.push({
        id: nextCardId(`${color}-${v}-a`),
        color,
        type: 'number',
        value: v,
      });
      deck.push({
        id: nextCardId(`${color}-${v}-b`),
        color,
        type: 'number',
        value: v,
      });
    }

    // Action cards: 2 of each (Skip, Reverse, Draw Two) per color
    const actions: CardType[] = ['skip', 'reverse', 'draw2'];
    actions.forEach((act) => {
      deck.push({
        id: nextCardId(`${color}-${act}-a`),
        color,
        type: act,
      });
      deck.push({
        id: nextCardId(`${color}-${act}-b`),
        color,
        type: act,
      });
    });
  });

  // 4 Wild cards and 4 Wild Draw Four cards
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: nextCardId(`wild-${i}`),
      color: 'wild',
      type: 'wild',
    });
    deck.push({
      id: nextCardId(`wild4-${i}`),
      color: 'wild',
      type: 'wild4',
    });
  }

  return shuffleDeck(deck);
}

// Fisher-Yates shuffle
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Check if move is legal
export function isLegalMove(
  card: Card,
  topCard: Card | null,
  activeColor: CardColor,
  pendingPenalty: number,
  stackingAllowed: boolean
): boolean {
  if (!topCard) return true;

  // Stacking penalty active
  if (pendingPenalty > 0) {
    if (!stackingAllowed) {
      return false; // must draw cards
    }
    // With stacking:
    if (topCard.type === 'draw2' && card.type === 'draw2') {
      return true; // Any +2 can stack on +2
    }
    if (topCard.type === 'wild4' && card.type === 'wild4') {
      return true; // Any +4 can stack on +4
    }
    return false;
  }

  // Wild cards are always legal on normal turns
  if (card.color === 'wild' || card.type === 'wild' || card.type === 'wild4') {
    return true;
  }

  // Matches currently active color
  if (card.color === activeColor) {
    return true;
  }

  // Matches top card type (e.g. Skip on Skip, Reverse on Reverse, Draw Two on Draw Two)
  if (card.type !== 'number' && card.type === topCard.type) {
    return true;
  }

  // Matches number value
  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) {
    return true;
  }

  return false;
}

// Get all legal cards in player's hand
export function getLegalMoves(
  hand: Card[],
  topCard: Card | null,
  activeColor: CardColor,
  pendingPenalty: number,
  stackingAllowed: boolean
): Card[] {
  return hand.filter((card) => isLegalMove(card, topCard, activeColor, pendingPenalty, stackingAllowed));
}

// Determine best bot move
export function pickBotMove(
  hand: Card[],
  topCard: Card | null,
  activeColor: CardColor,
  pendingPenalty: number,
  stackingAllowed: boolean,
  _personality?: string
): { card: Card | null; chosenColor: CardColor } {
  const legal = getLegalMoves(hand, topCard, activeColor, pendingPenalty, stackingAllowed);

  // If no legal card, must draw
  if (legal.length === 0) {
    // Pick color bot holds most of
    const chosenColor = pickMostFrequentColor(hand);
    return { card: null, chosenColor };
  }

  // Count colors in bot's hand to favor colors it has more of
  const colorCounts: Record<CardColor, number> = {
    gold: 0,
    crimson: 0,
    sapphire: 0,
    emerald: 0,
    wild: 0,
  };
  hand.forEach((c) => {
    if (colorCounts[c.color] !== undefined) colorCounts[c.color]++;
  });

  // If penalty is active, stack immediately
  if (pendingPenalty > 0) {
    return { card: legal[0], chosenColor: pickMostFrequentColor(hand) };
  }

  // Sort legal moves by strategic preference:
  // 1. Prefer matching active color with standard numbers to save Wilds & Actions
  // 2. Play action cards (Draw Two, Skip, Reverse) when opponent has few cards
  // 3. Save Wild / Wild+4 for when needed, unless few cards left
  const sorted = [...legal].sort((a, b) => {
    const aIsWild = a.color === 'wild';
    const bIsWild = b.color === 'wild';
    if (aIsWild && !bIsWild) return 1;
    if (!aIsWild && bIsWild) return -1;

    // Prefer card with color the bot has the most of
    const aColorWeight = colorCounts[a.color] || 0;
    const bColorWeight = colorCounts[b.color] || 0;
    return bColorWeight - aColorWeight;
  });

  const chosenCard = sorted[0];
  const chosenColor = pickMostFrequentColor(hand.filter((c) => c.id !== chosenCard.id));

  return {
    card: chosenCard,
    chosenColor,
  };
}

export function pickMostFrequentColor(hand: Card[]): CardColor {
  const counts: Record<'gold' | 'crimson' | 'sapphire' | 'emerald', number> = {
    gold: 0,
    crimson: 0,
    sapphire: 0,
    emerald: 0,
  };
  hand.forEach((c) => {
    if (c.color !== 'wild' && counts[c.color] !== undefined) {
      counts[c.color]++;
    }
  });

  let maxCol: CardColor = 'gold';
  let maxCount = -1;
  (['gold', 'crimson', 'sapphire', 'emerald'] as const).forEach((col) => {
    if (counts[col] > maxCount) {
      maxCount = counts[col];
      maxCol = col;
    }
  });

  return maxCol;
}
