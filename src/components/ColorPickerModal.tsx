import React from 'react';
import { CardColor } from '../types';
import { Crown } from 'lucide-react';
import { sound } from '../utils/sound';

interface ColorPickerModalProps {
  isOpen: boolean;
  onSelectColor: (color: CardColor) => void;
}

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  onSelectColor,
}) => {
  if (!isOpen) return null;

  const colors: { color: CardColor; label: string; bgClass: string; borderClass: string; shadow: string }[] = [
    {
      color: 'crimson',
      label: 'Royal Crimson',
      bgClass: 'bg-gradient-to-br from-[#E11D48] to-[#9F1239]',
      borderClass: 'border-rose-400',
      shadow: 'shadow-[0_0_25px_rgba(225,29,72,0.5)]',
    },
    {
      color: 'sapphire',
      label: 'Royal Sapphire',
      bgClass: 'bg-gradient-to-br from-[#2563EB] to-[#1E3A8A]',
      borderClass: 'border-blue-400',
      shadow: 'shadow-[0_0_25px_rgba(37,99,235,0.5)]',
    },
    {
      color: 'gold',
      label: 'Royal Gold',
      bgClass: 'bg-gradient-to-br from-[#F59E0B] to-[#B45309]',
      borderClass: 'border-amber-300',
      shadow: 'shadow-[0_0_25px_rgba(245,158,11,0.5)]',
    },
    {
      color: 'emerald',
      label: 'Royal Emerald',
      bgClass: 'bg-gradient-to-br from-[#059669] to-[#064E3B]',
      borderClass: 'border-emerald-400',
      shadow: 'shadow-[0_0_25px_rgba(5,150,105,0.5)]',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="color-picker-modal"
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#111728] via-[#0D1220] to-[#080B14] border border-amber-500/30 shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-6 text-white text-center"
      >
        <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-[#E5A93C] mb-1">
          <Crown className="w-4 h-4" />
          WILD CARD PLAYED
        </div>
        <h3 className="text-2xl font-royal font-bold text-white mb-2">
          Choose Next Color
        </h3>
        <p className="text-slate-400 text-xs mb-6">
          The next player must match your chosen royal realm.
        </p>

        {/* 2x2 Grid of Colors */}
        <div className="grid grid-cols-2 gap-3.5">
          {colors.map((item) => (
            <button
              key={item.color}
              id={`color-choice-${item.color}`}
              onClick={() => {
                sound.playClick();
                onSelectColor(item.color);
              }}
              className={`h-20 sm:h-24 rounded-2xl flex flex-col items-center justify-center p-2 text-white font-royal font-bold text-sm border-2 ${item.borderClass} ${item.bgClass} ${item.shadow} hover:scale-105 active:scale-95 transition-transform cursor-pointer touch-manipulation`}
            >
              <span className="drop-shadow-md text-sm sm:text-base">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
