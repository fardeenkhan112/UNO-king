import { GameState, Card, CardColor, Player, GameSettings } from '../types';
import { BOT_PROFILES, createDeck, pickBotMove, isLegalMove } from './cardUtils';

export interface LocalGameEvents {
  onStateUpdate: (state: GameState) => void;
  onUnoCalled?: (player: Player) => void;
  onUnuCalled?: (player: Player) => void;
  onVictory?: (winner: Player) => void;
}

export class SinglePlayerEngine {
  private state: GameState;
  private deck: Card[] = [];
  private discardPile: Card[] = [];
  private botTimeout: ReturnType<typeof setTimeout> | null = null;
  private events: LocalGameEvents;
  private isDestroyed: boolean = false;

  constructor(
    userName: string,
    userAvatar: string,
    botCount: number,
    settings: GameSettings,
    events: LocalGameEvents
  ) {
    this.events = events;

    const players: Player[] = [
      {
        id: 'player-local',
        name: userName || 'Player',
        avatar: userAvatar || '👑',
        isBot: false,
        isHost: true,
        cardCount: 7,
        hand: [],
        connected: true,
        calledUnu: false,
      },
    ];

    for (let i = 0; i < botCount; i++) {
      const profile = BOT_PROFILES[i % BOT_PROFILES.length];
      players.push({
        id: `bot-${i}`,
        name: profile.name,
        avatar: profile.avatar,
        isBot: true,
        isHost: false,
        cardCount: 7,
        hand: [],
        connected: true,
        calledUnu: false,
      });
    }

    this.state = {
      roomId: 'local-solo',
      roomCode: 'SOLO',
      players,
      hostId: 'player-local',
      gameStatus: 'playing',
      topCard: null,
      activeColor: 'gold',
      currentPlayerIndex: 0,
      turnDirection: 1,
      pendingPenalty: 0,
      winner: null,
      rankings: [],
      settings,
      lastActionMessage: 'Match started! First turn is yours.',
    };

    this.startMatch();
  }

  public getState(): GameState {
    return this.state;
  }

  private startMatch() {
    this.deck = createDeck();
    this.discardPile = [];
    this.state.gameStatus = 'playing';
    this.state.winner = null;
    this.state.rankings = [];
    this.state.pendingPenalty = 0;
    this.state.currentPlayerIndex = 0;
    this.state.turnDirection = 1;

    // Deal 7 cards to each player
    this.state.players.forEach((p) => {
      p.hand = [];
      for (let i = 0; i < 7; i++) {
        const c = this.deck.pop();
        if (c) p.hand.push(c);
      }
      p.cardCount = p.hand.length;
      p.calledUno = false;
      p.calledUnu = false;
    });

    // Top card
    let top = this.deck.pop()!;
    while (top.type === 'wild4') {
      this.deck.unshift(top);
      top = this.deck.pop()!;
    }
    this.discardPile.push(top);
    this.state.topCard = top;
    this.state.activeColor = top.color === 'wild' ? 'gold' : top.color;
    this.state.lastActionMessage = `Match started! Top card is ${top.color.toUpperCase()} ${
      top.type === 'number' ? top.value : top.type
    }.`;

    this.notify();
    this.scheduleBotTurn();
  }

  private notify() {
    if (this.isDestroyed) return;
    this.events.onStateUpdate({ ...this.state, players: [...this.state.players] });
  }

  private scheduleBotTurn() {
    if (this.botTimeout) clearTimeout(this.botTimeout);
    const current = this.state.players[this.state.currentPlayerIndex];
    if (current && current.isBot && this.state.gameStatus === 'playing') {
      const delay = 900 + Math.random() * 800;
      this.botTimeout = setTimeout(() => {
        this.botTimeout = null;
        this.runBotTurn(current);
      }, delay);
    }
  }

  private clearTimers() {
    if (this.botTimeout) clearTimeout(this.botTimeout);
    this.botTimeout = null;
  }

  private drawCards(player: Player, count: number): Card[] {
    const drawn: Card[] = [];
    if (!player.hand) player.hand = [];

    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) {
        if (this.discardPile.length > 1) {
          const top = this.discardPile.pop()!;
          this.deck = this.discardPile;
          for (let j = this.deck.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [this.deck[j], this.deck[k]] = [this.deck[k], this.deck[j]];
          }
          this.discardPile = [top];
        } else {
          this.deck = createDeck();
        }
      }
      const card = this.deck.pop();
      if (card) {
        player.hand.push(card);
        drawn.push(card);
      }
    }

    player.cardCount = player.hand.length;
    return drawn;
  }

  private advanceTurn(steps: number = 1) {
    const n = this.state.players.length;
    const effective = steps * this.state.turnDirection;
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + effective) % n;
    if (this.state.currentPlayerIndex < 0) {
      this.state.currentPlayerIndex += n;
    }
    const current = this.state.players[this.state.currentPlayerIndex];
    if (current && current.hand && current.hand.length > 1) {
      current.calledUnu = false;
    }
  }

  public playCard(playerId: string, cardId: string, chosenColor?: CardColor, calledUnu?: boolean) {
    const current = this.state.players[this.state.currentPlayerIndex];
    if (!current || current.id !== playerId || this.state.gameStatus !== 'playing') return;

    const card = current.hand?.find((c) => c.id === cardId);
    if (!card) return;

    const legal = isLegalMove(
      card,
      this.state.topCard,
      this.state.activeColor,
      this.state.pendingPenalty,
      this.state.settings.stacking
    );
    if (!legal) return;

    if (calledUnu && current.hand?.length >= 1 && current.hand.length <= 2 && !current.calledUnu) {
      current.calledUnu = true;
      current.calledUno = true;
      if (this.events.onUnoCalled) this.events.onUnoCalled(current);
    }

    this.applyPlay(current, card, chosenColor);
  }

  public drawCard(playerId: string) {
    const current = this.state.players[this.state.currentPlayerIndex];
    if (!current || current.id !== playerId || this.state.gameStatus !== 'playing') return;

    const count = this.state.pendingPenalty > 0 ? this.state.pendingPenalty : 1;
    this.state.pendingPenalty = 0;
    this.drawCards(current, count);
    if ((current.hand?.length || 0) > 1) {
      current.calledUno = false;
      current.calledUnu = false;
    }

    this.state.lastActionMessage =
      count > 1 ? `${current.name} drew ${count} penalty cards.` : `${current.name} drew a card.`;

    this.advanceTurn(1);
    this.notify();
    this.scheduleBotTurn();
  }

  public callUno(playerId: string) {
    const current = this.state.players[this.state.currentPlayerIndex];
    if (!current || current.id !== playerId || this.state.gameStatus !== 'playing') return;
    if (!current.hand || current.hand.length < 1 || current.hand.length > 2 || current.calledUno) return;
    current.calledUno = true;
    current.calledUnu = true;
    if (this.events.onUnoCalled) this.events.onUnoCalled(current);
    this.notify();
  }

  public callUnu(playerId: string) {
    this.callUno(playerId);
  }

  private runBotTurn(bot: Player) {
    if (this.isDestroyed || this.state.gameStatus !== 'playing') return;
    if (this.state.players[this.state.currentPlayerIndex]?.id !== bot.id) return;

    const botHand = bot.hand || [];
    const move = pickBotMove(
      botHand,
      this.state.topCard,
      this.state.activeColor,
      this.state.pendingPenalty,
      this.state.settings.stacking
    );

    if (move.card) {
      if (botHand.length === 2 && !bot.calledUno) {
        bot.calledUno = true;
        bot.calledUnu = true;
        if (this.events.onUnoCalled) this.events.onUnoCalled(bot);
      }
      this.applyPlay(bot, move.card, move.chosenColor);
    } else {
      const count = this.state.pendingPenalty > 0 ? this.state.pendingPenalty : 1;
      this.state.pendingPenalty = 0;
      this.drawCards(bot, count);

      this.state.lastActionMessage =
        count > 1 ? `${bot.name} drew ${count} penalty cards.` : `${bot.name} drew a card.`;

      this.advanceTurn(1);
      this.notify();
      this.scheduleBotTurn();
    }
  }

  private applyPlay(player: Player, card: Card, chosenColor?: CardColor) {
    player.hand = player.hand?.filter((c) => c.id !== card.id) || [];
    player.cardCount = player.hand.length;

    this.discardPile.push(card);
    this.state.topCard = card;

    // Victory check
    if (player.hand.length === 0) {
      this.state.gameStatus = 'finished';
      this.state.winner = player;
      this.clearTimers();

      const sorted = [...this.state.players].sort(
        (a, b) => (a.hand?.length || 0) - (b.hand?.length || 0)
      );
      this.state.rankings = sorted;
      this.state.lastActionMessage = `👑 ${player.name} played their last card and WON the crown!`;

      this.notify();
      if (this.events.onVictory) this.events.onVictory(player);
      return;
    }

    let steps = 1;

    if (card.color === 'wild' || card.type === 'wild' || card.type === 'wild4') {
      this.state.activeColor = chosenColor || 'gold';
    } else {
      this.state.activeColor = card.color;
    }

    if (card.type === 'skip') {
      steps = 2;
      this.state.lastActionMessage = `${player.name} played a Skip! Next turn skipped.`;
    } else if (card.type === 'reverse') {
      if (this.state.players.length === 2) {
        steps = 2;
        this.state.lastActionMessage = `${player.name} reversed direction! Next turn skipped.`;
      } else {
        this.state.turnDirection = (this.state.turnDirection * -1) as 1 | -1;
        steps = 1;
        this.state.lastActionMessage = `${player.name} reversed the turn direction!`;
      }
    } else if (card.type === 'draw2') {
      if (this.state.settings.stacking) {
        this.state.pendingPenalty += 2;
        steps = 1;
        this.state.lastActionMessage = `${player.name} stacked +2! (+${this.state.pendingPenalty} pending)`;
      } else {
        this.advanceTurn(1);
        const nextP = this.state.players[this.state.currentPlayerIndex];
        this.drawCards(nextP, 2);
        this.state.lastActionMessage = `${player.name} played +2! ${nextP.name} drew 2 cards.`;
        steps = 1;
      }
    } else if (card.type === 'wild4') {
      if (this.state.settings.stacking) {
        this.state.pendingPenalty += 4;
        steps = 1;
        this.state.lastActionMessage = `${player.name} played Wild +4 to ${this.state.activeColor}! (+${this.state.pendingPenalty} pending)`;
      } else {
        this.advanceTurn(1);
        const nextP = this.state.players[this.state.currentPlayerIndex];
        this.drawCards(nextP, 4);
        this.state.lastActionMessage = `${player.name} played Wild +4 to ${this.state.activeColor}! ${nextP.name} drew 4 cards.`;
        steps = 1;
      }
    } else if (card.type === 'wild') {
      steps = 1;
      this.state.lastActionMessage = `${player.name} played a Wild card and chose ${this.state.activeColor.toUpperCase()}!`;
    } else {
      steps = 1;
      this.state.lastActionMessage = `${player.name} played ${card.color.toUpperCase()} ${card.value}.`;
    }

    this.advanceTurn(steps);
    this.notify();
    this.scheduleBotTurn();
  }

  public rematch() {
    this.startMatch();
  }

  public destroy() {
    this.isDestroyed = true;
    this.clearTimers();
  }
}
