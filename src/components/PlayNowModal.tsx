import React, { useState } from 'react';
import { Bot, Swords, Sparkles, X, Sliders, ShieldAlert } from 'lucide-react';
import { sound } from '../utils/sound';

interface PlayNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMatch: (botCount: number, settings: { stacking: boolean }) => void;
}

interface BotOption {
  count: number;
  label: string;
  totalText: string;
  desc: string;
  badge?: string;
}

const BOT_OPTIONS: BotOption[] = [
  {
    count: 1,
    label: '1 Bot',
    totalText: '2-Player Game',
    desc: '1v1 Duel. Fast head-to-head showdown.',
    badge: 'Fast Duel',
  },
  {
    count: 2,
    label: '2 Bots',
    totalText: '3-Player Game',
    desc: 'Triad Clash. Quick tactical skirmish.',
  },
  {
    count: 3,
    label: '3 Bots',
    totalText: '4-Player Table',
    desc: 'Recommended balance. The classic party format.',
    badge: 'Recommended',
  },
  {
    count: 4,
    label: '4 Bots',
    totalText: '5-Player Table',
    desc: 'Pentagon Royale. Dynamic action shifts.',
  },
  {
    count: 5,
    label: '5 Bots',
    totalText: '6-Player Table',
    desc: 'Royal Circle. High-stakes strategic play.',
  },
  {
    count: 6,
    label: '6 Bots',
    totalText: '7-Player Table',
    desc: 'Grand Court. Constant rotation and penalties.',
  },
  {
    count: 7,
    label: '7 Bots',
    totalText: '8-Player Table',
    desc: 'Full Royal Table. Maximum chaotic action.',
    badge: 'Max Chaos',
  },
];

export const PlayNowModal: React.FC<PlayNowModalProps> = ({
  isOpen,
  onClose,
  onStartMatch,
}) => {
  const [selectedBots, setSelectedBots] = useState<number>(3); // Default 3 bots
  const [stacking, setStacking] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSelect = (count: number) => {
    sound.playClick();
    setSelectedBots(count);
  };

  const handleStart = () => {
    sound.playClick();
    onStartMatch(selectedBots, { stacking });
  };

  const totalPlayers = selectedBots + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="play-now-modal"
        className="relative w-full max-w-2xl rounded-3xl bg-gradient-to-b from-[#111728] via-[#0D1220] to-[#080B14] border border-amber-500/30 shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-4 sm:p-7 text-white overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />

        {/* Close Button */}
        <button
          id="close-play-now-btn"
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Heading */}
        <div className="mb-4 sm:mb-5 pr-8">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#E5A93C] mb-1">
            <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            SINGLE PLAYER MODE
          </div>
          <h3 className="text-xl sm:text-3xl font-royal font-bold text-white tracking-wide">
            Select AI Opponents
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Choose how many bots you want to challenge at the table.
          </p>
        </div>

        {/* Bot Selection List */}
        <div className="overflow-y-auto space-y-2 pr-1 max-h-[46vh] cards-scrollbar">
          {BOT_OPTIONS.map((opt) => {
            const isSelected = selectedBots === opt.count;
            return (
              <div
                key={opt.count}
                id={`bot-option-${opt.count}`}
                onClick={() => handleSelect(opt.count)}
                className={`relative flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-200 border ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500/20 via-blue-600/20 to-purple-600/20 border-[#E5A93C] shadow-[0_0_20px_rgba(229,169,60,0.25)]'
                    : 'bg-[#0F1424]/60 hover:bg-[#141B30] border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center font-royal font-bold flex-shrink-0 ${
                      isSelected
                        ? 'bg-[#E5A93C] text-black shadow-md'
                        : 'bg-slate-800 text-amber-400'
                    }`}
                  >
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-bold text-sm sm:text-lg text-white">
                        {opt.label}
                      </span>
                      <span className="text-[10px] sm:text-xs text-amber-300 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                        {opt.totalText}
                      </span>
                      {opt.badge && (
                        <span className="text-[9px] sm:text-[10px] uppercase font-bold text-purple-300 bg-purple-500/20 px-1.5 sm:px-2 py-0.5 rounded-full border border-purple-500/30">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">{opt.desc}</p>
                  </div>
                </div>

                {/* Radio indicator */}
                <div
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border transition-colors flex-shrink-0 ml-2 ${
                    isSelected ? 'border-[#E5A93C] bg-[#E5A93C]' : 'border-slate-600'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Optional House Rules Accordion */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Hide Game Rules' : 'Customize Table Rules'}</span>
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mt-2 sm:mt-3 p-2.5 sm:p-3 rounded-xl bg-[#090D18] border border-slate-800 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Stacking (+2 on +2)
                </label>
                <button
                  onClick={() => setStacking(!stacking)}
                  className={`px-2.5 py-1 rounded-lg border font-semibold cursor-pointer ${
                    stacking
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {stacking ? 'Enabled (House Rule)' : 'Disabled (Official)'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom CTA */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm">
            <span className="text-slate-400">Total: </span>
            <span className="text-white font-bold">You + {selectedBots} AI</span>{' '}
            <span className="text-[#E5A93C] font-semibold">({totalPlayers} Players)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="cancel-play-now-btn"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="px-3.5 py-2 sm:py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="start-match-btn"
              onClick={handleStart}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl btn-3d-gold text-black font-black font-royal text-xs sm:text-sm tracking-wider active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              START MATCH ({selectedBots} {selectedBots === 1 ? 'BOT' : 'BOTS'})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
