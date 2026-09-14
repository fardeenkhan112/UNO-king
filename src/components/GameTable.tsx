import React, { useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Card, CardColor, GameState, Player } from '../types';
import { CardView } from './CardView';
import { ColorPickerModal } from './ColorPickerModal';
import { COLOR_CONFIG, isLegalMove } from '../utils/cardUtils';
import { sound } from '../utils/sound';
import {
  Bot,
  Check,
  Crown,
  Eye,
  Layers,
  LogOut,
  Medal,
  Sparkles,
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

type PlayerMeta = Player & {
  placement?: number;
  hasFinished?: boolean;
};

const meta = (player?: Player | null): PlayerMeta | null =>
  player ? (player as PlayerMeta) : null;

const getPlacement = (player?: Player | null, winnerId?: string) => {
  const p = meta(player);
  if (p?.placement) return p.placement;
  if (winnerId && player?.id === winnerId) return 1;
  return undefined;
};

const getPlacementTone = (place?: number) => {
  if (place === 1) return 'gold';
  if (place === 2) return 'diamond';
  if (place === 3) return 'silver';
  if (place === 4) return 'bronze';
  return 'default';
};

const placeLabel = (place?: number) => {
  if (!place) return '';
  if (place === 1) return '1ST';
  if (place === 2) return '2ND';
  if (place === 3) return '3RD';
  return `${place}TH`;
};

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
  const [reaction, setReaction] = useState<{ emoji: string; id: number } | null>(null);

  useEffect(() => {
    if (!socket) return;

    let timer: number | undefined;
    const handleReaction = ({ emoji }: { playerId: string; emoji: string }) => {
      setReaction({ emoji, id: Date.now() });
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setReaction(null), 900);
    };

    socket.on('reaction:show', handleReaction);
    return () => {
      if (timer) window.clearTimeout(timer);
      socket.off('reaction:show', handleReaction);
    };
  }, [socket]);

  const me = meta(gameState.players.find((player) => player.id === currentPlayerId));
  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  const activeMeta = meta(activePlayer);
  const winnerId = gameState.winner?.id;
  const winnerFromRanking =
    gameState.rankings?.find((player) => getPlacement(player, winnerId) === 1)?.id;
  const resolvedWinnerId = winnerId || winnerFromRanking;
  const resolvedWinner =
    gameState.players.find((player) => player.id === resolvedWinnerId) ||
    gameState.winner ||
    gameState.rankings?.find((player) => getPlacement(player, resolvedWinnerId) === 1) ||
    null;

  const mePlacement = getPlacement(me, resolvedWinnerId);
  const isSpectator = Boolean(meta(me)?.hasFinished || mePlacement);
  const isMyTurn = !isSpectator && activePlayer?.id === currentPlayerId;
  const topCard = gameState.topCard;
  const activeColor = gameState.activeColor;
  const pendingPenalty = gameState.pendingPenalty;
  const myHand = me?.hand || [];
  const activeColorInfo = COLOR_CONFIG[activeColor] || COLOR_CONFIG.gold;

  const otherPlayers = useMemo(
    () => gameState.players.filter((player) => player.id !== currentPlayerId),
    [gameState.players, currentPlayerId],
  );

  const placements = useMemo(
    () =>
      [...gameState.players]
        .map((player) => ({ player, place: getPlacement(player, resolvedWinnerId) }))
        .filter((entry) => entry.place)
        .sort((a, b) => (a.place || 99) - (b.place || 99)),
    [gameState.players, resolvedWinnerId],
  );

  useEffect(() => {
    if (myHand.length > 2 || gameState.gameStatus !== 'playing' || isSpectator) {
      setLocalCalledUno(false);
    }
  }, [myHand.length, gameState.gameStatus, isSpectator]);

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;

    const legal = isLegalMove(
      card,
      topCard,
      activeColor,
      pendingPenalty,
      gameState.settings.stacking,
    );

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
    onPlayCard(card.id, undefined, localCalledUno);
  };

  const handleSelectColor = (chosenColor: CardColor) => {
    if (!selectedWildCard || !isMyTurn) return;
    sound.playCardPlay();
    onPlayCard(selectedWildCard.id, chosenColor, localCalledUno);
    setSelectedWildCard(null);
  };

  const handleDraw = () => {
    if (!isMyTurn) return;
    pendingPenalty > 0 ? sound.playSlideWhistle() : sound.playCardDraw();
    onDrawCard();
  };

  const handleUno = () => {
    if (!isMyTurn || localCalledUno || me?.calledUno || me?.calledUnu) return;
    sound.playUnoCall();
    setLocalCalledUno(true);
    onCallUnu();
  };

  const canCallUno =
    isMyTurn &&
    myHand.length >= 1 &&
    myHand.length <= 2 &&
    !localCalledUno &&
    !me?.calledUno &&
    !me?.calledUnu;

  return (
    <section className="uno-room" aria-label="UNO KING royal game room">
      <div className="uno-room__glow uno-room__glow--gold" aria-hidden="true" />
      <div className="uno-room__glow uno-room__glow--blue" aria-hidden="true" />

      {reaction && (
        <div className="uno-reaction" key={reaction.id} aria-hidden="true">
          {reaction.emoji}
        </div>
      )}

      {/* Only the actual game controls remain here. */}
      <header className="uno-room__controls">
        <div className="uno-room__pills">
          <div className="uno-pill">
            <span>ROOM</span>
            <strong>{gameState.roomCode}</strong>
          </div>

          <div className={`uno-pill uno-pill--turn ${isMyTurn ? 'is-active' : ''}`}>
            <span className="uno-pill__dot" />
            <strong>
              {isSpectator
                ? `FINISHED • ${placeLabel(mePlacement)} PLACE`
                : isMyTurn
                  ? 'YOUR TURN'
                  : `${activeMeta?.name || 'PLAYER'}'S TURN`}
            </strong>
          </div>

          <div className="uno-pill uno-pill--color">
            <span
              className="uno-pill__color"
              style={{ background: activeColorInfo.hex }}
            />
            <strong>{activeColorInfo.name}</strong>
          </div>
        </div>

        <button type="button" className="uno-leave" onClick={onLeaveGame}>
          <LogOut size={15} />
          <span>LEAVE</span>
        </button>
      </header>

      <div className="uno-room__content">
        <div className="uno-players-row" aria-label="Players">
          {otherPlayers.map((player) => {
            const p = meta(player);
            const placement = getPlacement(player, resolvedWinnerId);
            const turn = activePlayer?.id === player.id && !p?.hasFinished;

            return (
              <div
                key={player.id}
                className={`uno-player ${turn ? 'is-turn' : ''} ${placement ? 'is-finished' : ''} uno-player--${getPlacementTone(placement)}`}
              >
                <div className="uno-player__avatar">
                  <span>{player.avatar}</span>
                  {player.isBot && <Bot size={11} />}
                  {player.isHost && <Crown size={11} className="uno-player__host" />}
                </div>

                <div className="uno-player__body">
                  <strong>{player.name}</strong>
                  <span>
                    <Layers size={12} /> {player.cardCount}
                    {placement && <em>{placeLabel(placement)}</em>}
                  </span>
                </div>

                {turn && <b className="uno-player__turn">TURN</b>}
                {placement && <span className="uno-player__done"><Medal size={13} /></span>}
              </div>
            );
          })}
        </div>

        <div className="uno-table-wrap">
          <div className="uno-table">
            <div className="uno-table__ring" />
            <div className="uno-table__logo" aria-hidden="true">
              <Crown size={34} />
            </div>

            <div className="uno-piles">
              <div className="uno-pile">
                <button
                  type="button"
                  className={`uno-draw ${isMyTurn ? 'can-draw' : ''}`}
                  onClick={isMyTurn ? handleDraw : undefined}
                  disabled={!isMyTurn}
                  aria-label={isMyTurn ? 'Draw a card' : 'Draw pile'}
                >
                  <span className="uno-draw__back uno-draw__back--1" />
                  <span className="uno-draw__back uno-draw__back--2" />
                  <CardView id="uno-draw-card" isBack size="lg" />
                  {pendingPenalty > 0 && <b className="uno-pile__penalty">+{pendingPenalty}</b>}
                </button>
                <small>DRAW CARD</small>
              </div>

              <div className="uno-pile">
                <div className="uno-discard">
                  {topCard ? (
                    <CardView card={topCard} size="lg" className="uno-discard__card" />
                  ) : (
                    <span>EMPTY</span>
                  )}
                </div>
                <small>DISCARD</small>
              </div>
            </div>

            <div className="uno-table-message">
              {isSpectator ? (
                <>
                  <Eye size={15} />
                  <strong>WATCHING MATCH</strong>
                </>
              ) : isMyTurn ? (
                <>
                  <Sparkles size={15} />
                  <strong>YOUR MOVE</strong>
                </>
              ) : (
                <strong>{activeMeta?.name || 'PLAYER'} IS PLAYING</strong>
              )}
            </div>
          </div>
        </div>

        <div className="uno-reactions" aria-label="Quick reactions">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => socket?.emit('reaction:send', { emoji })}
              aria-label={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className={`uno-self ${isSpectator ? 'is-spectator' : ''}`}>
          <div className="uno-self__avatar">{me?.avatar || '👑'}</div>
          <div className="uno-self__copy">
            <div className="uno-self__title">
              <strong>{me?.name || 'You'}</strong>
              {mePlacement ? (
                <span className="uno-self__place"><Medal size={12} /> {placeLabel(mePlacement)} PLACE</span>
              ) : (
                <span>{myHand.length} CARDS</span>
              )}
            </div>
            <small>
              {isSpectator
                ? `You finished in ${placeLabel(mePlacement)} place — watch the rest of the match.`
                : isMyTurn
                  ? 'Your turn — play or draw.'
                  : `Waiting for ${activeMeta?.name || 'the next player'}...`}
            </small>
          </div>

          {!isSpectator && (
            <div className="uno-self__actions">
              <button
                id="call-uno-btn"
                type="button"
                onClick={handleUno}
                disabled={!canCallUno}
                className={`uno-call ${canCallUno ? 'is-ready' : me?.calledUno || me?.calledUnu || localCalledUno ? 'is-called' : ''}`}
              >
                <Crown size={17} />
                <span>{me?.calledUno || me?.calledUnu || localCalledUno ? 'UNO CALLED' : 'CALL UNO'}</span>
              </button>
            </div>
          )}
        </div>

        {isSpectator ? (
          <div className="uno-spectator">
            <div className="uno-spectator__icon"><Eye size={17} /></div>
            <div>
              <strong>SPECTATOR MODE</strong>
              <span>
                {placements.length}/{gameState.players.length} placements completed. You can still watch the table and reactions.
              </span>
            </div>
            {mePlacement && <b>{placeLabel(mePlacement)}</b>}
          </div>
        ) : (
          <div className="uno-hand">
            <div className="uno-hand__head">
              <span>YOUR HAND</span>
              <b>{myHand.length} CARDS</b>
            </div>

            <div className="uno-hand__scroll cards-scrollbar">
              {myHand.length ? (
                myHand.map((card) => {
                  const legal =
                    isMyTurn &&
                    isLegalMove(
                      card,
                      topCard,
                      activeColor,
                      pendingPenalty,
                      gameState.settings.stacking,
                    );

                  return (
                    <div key={card.id} className="uno-hand__card">
                      <CardView
                        card={card}
                        size="md"
                        isLegal={legal}
                        disabled={!isMyTurn || !legal}
                        onClick={() => handleCardClick(card)}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="uno-hand__empty">
                  <Check size={17} /> Your hand is empty.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ColorPickerModal
        isOpen={selectedWildCard !== null}
        onSelectColor={handleSelectColor}
      />
    </section>
  );
};
