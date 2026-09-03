import React, { useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { GameState, Card, CardColor } from '../types';
import { CardView } from './CardView';
import { ColorPickerModal } from './ColorPickerModal';
import { COLOR_CONFIG, isLegalMove } from '../utils/cardUtils';
import { sound } from '../utils/sound';
import {
  Crown,
  RotateCw,
  RotateCcw,
  Bot,
  Layers,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  LogOut,
  Shield,
} from 'lucide-react';

interface GameTableProps {
  gameState: GameState;
  currentPlayerId: string;
  onPlayCard: (cardId: string, chosenColor?: CardColor, calledUno?: boolean) => void;
  onDrawCard: () => void;
  onCallUnu: () => void;
  onLeaveGame: () => void;
  socket: Socket | null;
}

const REACTIONS = ['😂', '😭', '😈', '🔥', '💀', '👑', '🎉'];

export const GameTable: React.FC<GameTableProps> = ({
  gameState,
  currentPlayerId,
  onPlayCard,
  onDrawCard,
  onCallUnu,
  onLeaveGame,
  socket,
}) => {
  const [selectedWildCard, setSelectedWildCard] = useState<Card | null>(null);
  const [localCalledUno, setLocalCalledUno] = useState(false);
  const [reaction, setReaction] = useState<{ playerId: string; emoji: string; id: number } | null>(null);

  useEffect(() => {
    if (!socket) return;
    let hideTimer: number | undefined;
    const onReaction = ({ playerId, emoji }: { playerId: string; emoji: string }) => {
      setReaction({ playerId, emoji, id: Date.now() });
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setReaction(null), 1000);
    };
    socket.on('reaction:show', onReaction);
    return () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      socket.off('reaction:show', onReaction);
    };
  }, [socket]);

  const me = gameState.players.find((p) => p.id === currentPlayerId);
  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = activePlayer?.id === currentPlayerId;
  const topCard = gameState.topCard;
  const activeColor = gameState.activeColor;
  const pendingPenalty = gameState.pendingPenalty;
  const myHand = me?.hand || [];
  const activeColorInfo = COLOR_CONFIG[activeColor] || COLOR_CONFIG.gold;
  const otherPlayers = useMemo(
    () => gameState.players.filter((player) => player.id !== currentPlayerId),
    [gameState.players, currentPlayerId],
  );

  useEffect(() => {
    if (myHand.length > 2 || gameState.gameStatus !== 'playing') {
      setLocalCalledUno(false);
    }
  }, [myHand.length, gameState.gameStatus]);


  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;
    const legal = isLegalMove(card, topCard, activeColor, pendingPenalty, gameState.settings.stacking);
    if (!legal) {
      sound.playBoing();
      return;
    }

    if (card.color === 'wild' || card.type === 'wild' || card.type === 'wild4') {
      sound.playFlip();
      setSelectedWildCard(card);
      return;
    }

    sound.playCardPlay();
    if (card.type === 'skip' || card.type === 'reverse') {
      window.setTimeout(() => sound.playBoing(), 100);
    } else if (card.type === 'draw2') {
      window.setTimeout(() => sound.playSlideWhistle(), 120);
    } else if (card.type !== 'number') {
      window.setTimeout(() => sound.playAction(), 100);
    }
    onPlayCard(card.id, undefined, localCalledUno);
  };

  const handleSelectColor = (chosenColor: CardColor) => {
    if (!selectedWildCard) return;
    sound.playCardPlay();
    window.setTimeout(
      () => (selectedWildCard.type === 'wild4' ? sound.playSlideWhistle() : sound.playBoing()),
      110,
    );
    onPlayCard(selectedWildCard.id, chosenColor, localCalledUno);
    setSelectedWildCard(null);
  };

  const handleDraw = () => {
    if (!isMyTurn) return;
    pendingPenalty > 0 ? sound.playSlideWhistle() : sound.playCardDraw();
    onDrawCard();
  };

  const handleUnoButton = () => {
    if (!isMyTurn || localCalledUno || me?.calledUno || me?.calledUnu) return;
    sound.playUnoCall();
    setLocalCalledUno(true);
    onCallUnu();
  };

  const canCallUno = isMyTurn && myHand.length >= 1 && myHand.length <= 2 && !localCalledUno && !me?.calledUno && !me?.calledUnu;

  return (
    <section className="game-table-shell" aria-label="UNO KING game table">
      <div className="game-table-noise" aria-hidden="true" />
      <div className="game-table-aurora game-table-aurora-a" aria-hidden="true" />
      <div className="game-table-aurora game-table-aurora-b" aria-hidden="true" />

      {reaction && (
        <div className="reaction-burst" key={reaction.id} aria-hidden="true">
          <div className="reaction-burst__emoji">{reaction.emoji}</div>
        </div>
      )}

      <header className="game-topbar">
        <div className="game-topbar__brand">
          <span className="game-topbar__crest"><Crown size={15} /></span>
          <div>
            <div className="game-topbar__title">UNO KING</div>
            <div className="game-topbar__subtitle">ROYAL MATCH</div>
          </div>
        </div>

        <div className="game-topbar__middle">
          <span className="room-pill"><span>ROOM</span><b>{gameState.roomCode}</b></span>
          <span className="table-status">
            <span className={`status-dot ${isMyTurn ? 'is-live' : ''}`} />
            {isMyTurn ? 'YOUR TURN' : `${activePlayer?.name || 'Player'}'S TURN`}
          </span>
          <span className="color-chip">
            <i style={{ backgroundColor: activeColorInfo.hex }} />
            <span className="color-chip__label">{activeColorInfo.name}</span>
          </span>
        </div>

        <button type="button" onClick={onLeaveGame} className="icon-text-btn icon-text-btn--quiet" aria-label="Leave match" title="Leave match">
          <LogOut size={15} />
          <span>Leave</span>
        </button>
      </header>

      <div className="opponents-rail">
        {otherPlayers.map((player) => {
          const isTurn = activePlayer?.id === player.id;
          return (
            <div key={player.id} className={`opponent-card ${isTurn ? 'is-active' : ''}`}>
              <div className="opponent-card__avatar">
                <span>{player.avatar}</span>
                {player.isHost && <Crown className="opponent-card__crown" size={11} />}
                {!player.connected && <span className="opponent-card__offline" />}
              </div>
              <div className="opponent-card__info">
                <div className="opponent-card__name-row">
                  <strong>{player.name}</strong>
                  {player.isBot && <Bot size={11} className="text-purple-300" />}
                </div>
                <div className="opponent-card__stats">
                  <span><Layers size={11} /> {player.cardCount}</span>
                  {player.calledUno || player.calledUnu ? <b>UNO</b> : null}
                </div>
              </div>
              {isTurn && <span className="opponent-card__active">ACTIVE</span>}
            </div>
          );
        })}
      </div>

      <div className="table-stage">
        <div className="table-glow" aria-hidden="true" />
        <div className="table-felt" aria-hidden="true">
          <div className="table-felt__crest"><Crown size={34} /></div>
          <div className="table-felt__ring" />
        </div>

        <div className="pile-row">
          <div className="pile-block">
            <button
              type="button"
              className={`draw-pile ${isMyTurn ? 'is-clickable' : 'is-disabled'}`}
              onClick={isMyTurn ? handleDraw : undefined}
              disabled={!isMyTurn}
              aria-label={isMyTurn ? 'Draw a card' : 'Draw pile'}
            >
              <span className="draw-pile__back draw-pile__back--1" />
              <span className="draw-pile__back draw-pile__back--2" />
              <CardView id="draw-pile-btn" isBack size="lg" />
              {pendingPenalty > 0 && <span className="penalty-badge"><AlertTriangle size={11} /> +{pendingPenalty}</span>}
            </button>
            <span className="pile-label">{isMyTurn ? 'DRAW CARD' : 'DRAW PILE'}</span>
          </div>


          <div className="pile-block">
            <div className="discard-pile">
              <div className="discard-aura" style={{ backgroundColor: activeColorInfo.hex }} />
              {topCard ? <CardView card={topCard} size="lg" className="relative z-10" /> : <div className="discard-empty">EMPTY</div>}
            </div>
            <span className="pile-label">DISCARD</span>
          </div>
        </div>
      </div>

      <div className="reaction-rail" aria-label="Quick reactions">
        {REACTIONS.map((emoji) => (
          <button key={emoji} type="button" onClick={() => socket?.emit('reaction:send', { emoji })} aria-label={`Send ${emoji}`}>
            {emoji}
          </button>
        ))}
      </div>

      <div className="player-zone">
        <div className="player-status-card">
          <div className="player-identity">
            <div className={`player-avatar ${isMyTurn ? 'is-turn' : ''}`}>{me?.avatar || '👑'}</div>
            <div className="player-copy">
              <div className="player-name-line">
                <strong>{me?.name || 'You'}</strong>
                <span>{myHand.length} cards</span>
              </div>
              <div className={`player-turn-line ${isMyTurn ? 'is-your-turn' : ''}`}>
                {isMyTurn ? <><ArrowRight size={12} /> Your turn — play or draw.</> : <>Waiting for {activePlayer?.name || 'player'}...</>}
              </div>
            </div>
          </div>
          <button
            id="call-uno-btn"
            type="button"
            onClick={handleUnoButton}
            disabled={!canCallUno}
            className={`uno-btn ${canCallUno ? 'is-ready' : me?.calledUno || me?.calledUnu || localCalledUno ? 'is-called' : 'is-disabled'}`}
          >
            <Crown size={15} />
            <span>{me?.calledUno || me?.calledUnu || localCalledUno ? 'UNO CALLED' : 'CALL UNO'}</span>
          </button>
        </div>

        <div className="hand-shell">
          <div className="hand-shell__header">
            <span>YOUR HAND</span>
            <span>{myHand.length} cards</span>
          </div>
          <div className="hand-scroll cards-scrollbar">
            {myHand.length ? myHand.map((card) => {
              const legal = isMyTurn && isLegalMove(card, topCard, activeColor, pendingPenalty, gameState.settings.stacking);
              return (
                <div key={card.id} className="hand-card-slot">
                  <CardView card={card} size="md" isLegal={legal} onClick={() => handleCardClick(card)} disabled={!isMyTurn || !legal} />
                </div>
              );
            }) : (
              <div className="empty-hand">No cards in hand.</div>
            )}
          </div>
        </div>
      </div>

      <ColorPickerModal isOpen={selectedWildCard !== null} onSelectColor={handleSelectColor} />
    </section>
  );
};
