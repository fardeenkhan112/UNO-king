import React from 'react';
import { X, Crown, RotateCcw, Ban, Plus, Sparkles, ShieldAlert, Trophy, Clock } from 'lucide-react';
import { sound } from '../utils/sound';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="how-to-play-modal"
        className="relative w-full max-w-2xl rounded-3xl bg-gradient-to-b from-[#111728] via-[#0D1220] to-[#080B14] border border-amber-500/30 shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-4 sm:p-8 text-white max-h-[90vh] flex flex-col"
      >
        {/* Close Button */}
        <button
          id="close-rules-btn"
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Heading */}
        <div className="mb-4 sm:mb-6 pr-8">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#E5A93C] mb-1">
            <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            OFFICIAL ROYAL CODEX
          </div>
          <h3 className="text-xl sm:text-3xl font-royal font-bold text-white tracking-wide">
            How to Play UNO KING
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Master the table, play action cards strategically, and claim the crown.
          </p>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto space-y-3 sm:space-y-4 pr-1 sm:pr-2 cards-scrollbar text-sm text-slate-300">
          {/* Section 1: How to Win */}
          <div className="p-3 sm:p-4 rounded-2xl bg-[#090D18] border border-slate-800">
            <div className="flex items-center gap-2 font-royal font-bold text-sm sm:text-base text-amber-400 mb-1">
              <Trophy className="w-4 h-4 text-[#E5A93C]" />
              How to Win & Match Cards
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
              Each player begins with <strong>7 cards</strong>. On your turn, match the top card of the discard pile by either <strong>color</strong> (Gold, Crimson, Sapphire, Emerald) or <strong>number/symbol</strong>. Be the first player to empty all cards from your hand to claim the crown!
            </p>
          </div>

          {/* Section 2: Action Cards */}
          <div className="p-3 sm:p-4 rounded-2xl bg-[#090D18] border border-slate-800">
            <div className="flex items-center gap-2 font-royal font-bold text-sm sm:text-base text-amber-400 mb-2.5">
              <Sparkles className="w-4 h-4 text-[#E5A93C]" />
              Action Cards
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
              <div className="flex items-start gap-2.5 p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <Ban className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Skip Card</strong>
                  Next player loses their turn immediately.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Reverse Card</strong>
                  Reverses turn direction (acts as Skip in 2-player).
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Draw Two (+2)</strong>
                  Next player draws 2 cards and misses their turn (or stacks!).
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Wild & Wild Draw 4</strong>
                  Changes the active color realm. Wild +4 also adds +4 penalty!
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: UNO Call Rule */}
          <div className="p-3 sm:p-4 rounded-2xl bg-[#090D18] border border-slate-800">
            <div className="flex items-center gap-2 font-royal font-bold text-sm sm:text-base text-amber-400 mb-1">
              <Crown className="w-4 h-4 text-[#E5A93C]" />
              The Royal UNO Call
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
              When playing down to your final card, hit the glowing <strong>CALL UNO!</strong> crown button. If you forget to declare UNO before your turn concludes, you risk drawing 2 penalty cards!
            </p>
          </div>

          {/* Section 4: Stacking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <div className="p-3 rounded-2xl bg-[#090D18] border border-slate-800">
              <div className="flex items-center gap-1.5 font-royal font-bold text-xs text-amber-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                Stacking Rule
              </div>
              <p className="text-xs text-slate-400">
                When stacking is enabled, matching +2 or +4 cards can be chained to pass the penalty forward.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[#090D18] border border-slate-800">
              <div className="flex items-center gap-1.5 font-royal font-bold text-xs text-amber-400 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Penalty Stacking Rule
              </div>
              <p className="text-xs text-slate-400">
                When enabled in room settings, you can counter a +2 with another +2 (or +4 on +4), accumulating penalties!
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Button */}
        <div className="mt-4 pt-3 sm:pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#F59E0B] text-black font-extrabold font-royal text-xs sm:text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            I UNDERSTAND
          </button>
        </div>
      </div>
    </div>
  );
};
