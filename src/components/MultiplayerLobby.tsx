import React, { useState } from 'react';
import {
  Crown,
  Copy,
  Check,
  Share2,
  QrCode as QrIcon,
  Bot,
  Plus,
  Trash2,
  Play,
  LogOut,
  User,
  Link as LinkIcon,
} from 'lucide-react';
import { GameState, Player, GameSettings } from '../types';
import { sound } from '../utils/sound';

interface MultiplayerLobbyProps {
  gameState: GameState;
  currentPlayerId: string;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onOpenQr: () => void;
  onUpdateSettings?: (settings: Partial<GameSettings>) => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  gameState,
  currentPlayerId,
  onAddBot,
  onRemoveBot,
  onStartGame,
  onLeaveRoom,
  onOpenQr,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const me = gameState.players.find((p) => p.id === currentPlayerId);
  const isHost = me?.isHost || gameState.hostId === currentPlayerId;
  const isRoomFull = gameState.players.length >= 8;

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?room=${gameState.roomCode}`
    : `https://unuking.game/join/${gameState.roomCode}`;

  const handleCopyCode = () => {
    sound.playClick();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(gameState.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    sound.playClick();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShare = async () => {
    sound.playClick();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my UNO KING table!',
          text: `Join my UNO KING Royal Card Game room: ${gameState.roomCode}`,
          url: joinUrl,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Generate 8 slots
  const slots: (Player | null)[] = [];
  for (let i = 0; i < 8; i++) {
    slots.push(gameState.players[i] || null);
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 py-3 sm:py-8 animate-fade-in">
      <div
        id="multiplayer-lobby-card"
        className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#111728] via-[#0D1220] to-[#080B14] border border-amber-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-3.5 sm:p-6 md:p-8 backdrop-blur-md"
      >
        {/* Top Header & Invite Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-6 pb-4 sm:pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#FDE047] mb-1">
              <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FDE047] animate-pulse" />
              ROYAL LOBBY • INVITE FRIENDS
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] sm:text-xs text-slate-400 font-semibold uppercase">ROOM CODE:</span>
              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-transparent border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <span className="text-2xl sm:text-3xl md:text-4xl font-royal font-black tracking-widest text-[#FDE047] drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">
                  {gameState.roomCode}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: 4 compact columns on mobile, auto flex on tablet/desktop */}
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
            <button
              id="copy-code-btn"
              onClick={handleCopyCode}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 sm:px-3 rounded-xl btn-3d-dark text-slate-200 text-[11px] sm:text-xs font-bold font-royal tracking-wider border border-slate-700 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
              <span>{copiedCode ? 'COPIED' : 'CODE'}</span>
            </button>

            <button
              id="copy-link-btn"
              onClick={handleCopyLink}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 sm:px-3 rounded-xl btn-3d-dark text-slate-200 text-[11px] sm:text-xs font-bold font-royal tracking-wider border border-slate-700 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <LinkIcon className="w-3.5 h-3.5 text-blue-400" />}
              <span>{copiedLink ? 'COPIED' : 'LINK'}</span>
            </button>

            <button
              id="share-btn"
              onClick={handleShare}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 sm:px-3 rounded-xl btn-3d-dark text-slate-200 text-[11px] sm:text-xs font-bold font-royal tracking-wider border border-slate-700 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-purple-400" />
              <span>SHARE</span>
            </button>

            <button
              id="open-qr-btn"
              onClick={() => {
                sound.playClick();
                onOpenQr();
              }}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-2 sm:px-3 rounded-xl btn-3d-dark text-amber-300 text-[11px] sm:text-xs font-bold font-royal tracking-wider border border-amber-500/40 cursor-pointer"
            >
              <QrIcon className="w-3.5 h-3.5 text-[#FDE047]" />
              <span>QR</span>
            </button>
          </div>
        </div>

        {/* Players Area Header */}
        <div className="flex items-center justify-between mt-4 sm:mt-6 mb-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm sm:text-base font-royal font-bold text-white tracking-wide">
              Table Seats
            </h4>
            <span className="text-[11px] sm:text-xs font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 shadow-sm">
              {gameState.players.length} / 8 Players
            </span>
          </div>

          {/* Add Bot button (host only - hidden on mobile screens, visible on tablet/desktop) */}
          {isHost && (
            <button
              id="add-bot-btn"
              onClick={() => {
                sound.playClick();
                onAddBot();
              }}
              disabled={isRoomFull}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-royal transition-all cursor-pointer ${
                isRoomFull
                  ? 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-800/60 to-indigo-900/60 hover:from-purple-700/70 hover:to-indigo-800/70 text-purple-200 border border-purple-400/40 shadow-[0_4px_12px_rgba(168,85,247,0.3)] active:scale-95'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <Bot className="w-3.5 h-3.5 text-purple-300" />
              <span>+ ADD BOT</span>
            </button>
          )}
        </div>

        {/* 8 Player Slots Grid - 1-column on mobile (<sm), 2-col on tablet (sm:), 4-col on desktop (lg:) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {slots.map((player, idx) => {
            const slotNum = idx + 1;
            if (player) {
              const isMe = player.id === currentPlayerId;
              return (
                <div
                  key={player.id}
                  id={`player-slot-${slotNum}`}
                  className={`relative flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all ${
                    player.isHost
                      ? 'bg-gradient-to-br from-amber-500/20 via-[#141B30] to-[#0A0E1A] border-amber-400/60 shadow-[0_4px_16px_rgba(245,158,11,0.2)]'
                      : isMe
                      ? 'bg-gradient-to-br from-blue-900/30 via-[#121A30] to-[#0A0E1A] border-blue-400/50 shadow-sm'
                      : 'bg-[#0E1324]/90 border-slate-800/90 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="relative text-xl sm:text-2xl w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center flex-shrink-0 shadow-inner">
                      {player.avatar}
                      {player.isHost && (
                        <Crown className="w-3.5 h-3.5 text-[#FDE047] absolute -top-1.5 -right-1.5 drop-shadow-[0_0_6px_rgba(253,224,71,0.8)]" />
                      )}
                    </div>
                    <div className="leading-tight min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-white truncate max-w-[130px] sm:max-w-[110px]">
                          {player.name}
                        </span>
                        {isMe && (
                          <span className="text-[9px] text-blue-300 font-bold px-1.5 py-[2px] rounded bg-blue-500/20 border border-blue-400/30 flex-shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        {player.isBot ? (
                          <span className="text-purple-300 flex items-center gap-1">
                            <Bot className="w-2.5 h-2.5" /> Bot
                          </span>
                        ) : player.isHost ? (
                          <span className="text-amber-300 flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" /> Host
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" /> Ready
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove Bot button (host only) */}
                  {isHost && player.isBot && (
                    <button
                      id={`remove-bot-${player.id}`}
                      onClick={() => {
                        sound.playClick();
                        onRemoveBot(player.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors flex-shrink-0 cursor-pointer ml-1"
                      title="Remove Bot"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
              );
            } else {
              return (
                <div
                  key={`empty-${slotNum}`}
                  id={`empty-slot-${slotNum}`}
                  onClick={isHost && !isRoomFull ? () => { sound.playClick(); onAddBot(); } : undefined}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-dashed border-slate-800/80 bg-[#090D18]/50 text-slate-500 select-none transition-all ${
                    isHost && !isRoomFull ? 'cursor-pointer hover:border-amber-500/40 hover:bg-amber-500/5 active:scale-[0.99]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-dashed border-slate-800 flex items-center justify-center font-bold text-xs text-slate-500 flex-shrink-0">
                      {slotNum}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] sm:text-xs font-semibold text-slate-400">Seat {slotNum}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {isHost && !isRoomFull ? 'Tap to add bot' : 'Open seat'}
                      </div>
                    </div>
                  </div>
                  {isHost && !isRoomFull && (
                    <span className="text-[10px] font-bold text-amber-400/80 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                      + BOT
                    </span>
                  )}
                </div>
              );
            }
          })}
        </div>

        {/* Start Game Action Banner (Clean, responsive layout on mobile) */}
        <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <button
            id="leave-lobby-btn"
            onClick={() => {
              sound.playClick();
              onLeaveRoom();
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 text-xs font-bold transition-colors w-full sm:w-auto justify-center cursor-pointer border border-slate-800 hover:border-rose-500/30 order-2 sm:order-1"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            LEAVE ROOM
          </button>

          {isHost ? (
            <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full sm:w-auto order-1 sm:order-2">
              {gameState.players.length < 2 && (
                <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-medium w-full sm:w-auto py-1">
                  <span>Need 1 more player!</span>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onAddBot();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 border border-purple-400/50 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Bot className="w-3 h-3 text-purple-300" />
                    + Add Bot Now
                  </button>
                </div>
              )}

              <button
                id="lobby-start-game-btn"
                onClick={() => {
                  if (gameState.players.length < 2) {
                    sound.playBoing();
                    return;
                  }
                  sound.playClick();
                  onStartGame();
                }}
                disabled={gameState.players.length < 2}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl font-black font-royal text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer ${
                  gameState.players.length >= 2
                    ? 'btn-3d-gold text-black shadow-[0_8px_25px_rgba(245,158,11,0.5)] active:scale-95'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                START GAME ({gameState.players.length} Players)
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-medium py-2 order-1 sm:order-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              Waiting for host to start the game...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
