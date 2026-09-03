import React from 'react';
import { Card, CardColor } from '../types';
import { Crown, RotateCcw, Ban, Plus, Sparkles } from 'lucide-react';
import { COLOR_CONFIG } from '../utils/cardUtils';

interface CardViewProps {
  card?: Card;
  isBack?: boolean;
  isLegal?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  selected?: boolean;
  disabled?: boolean;
  id?: string;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isBack = false,
  isLegal = false,
  onClick,
  size = 'md',
  className = '',
  selected = false,
  disabled = false,
  id,
}) => {
  // Dimension presets with mobile-first responsive scaling and tactile proportion
  const sizeClasses = {
    sm: 'w-12 h-18 text-[10px] rounded-xl sm:w-14 sm:h-20 sm:text-xs',
    md: 'w-16 h-24 text-xs rounded-2xl sm:w-20 sm:h-[7.5rem] sm:text-sm',
    lg: 'w-22 h-32 text-xs sm:w-[6.5rem] sm:h-[9.5rem] md:w-28 md:h-[10.5rem] sm:text-base rounded-2xl',
    hero: 'w-36 h-52 sm:w-44 sm:h-64 md:w-48 md:h-70 text-lg sm:text-xl rounded-3xl',
  }[size];

  // =========================================================================
  // 3D CARD BACK (Royal Casino Luxury Style)
  // =========================================================================
  if (isBack || !card) {
    return (
      <div
        id={id}
        onClick={!disabled ? onClick : undefined}
        className={`${sizeClasses} relative select-none flex flex-col items-center justify-center bg-gradient-to-b from-[#182038] via-[#0E1424] to-[#080B14] border-2 border-[#E5A93C] card-3d-shadow overflow-hidden transition-all duration-300 ${
          onClick && !disabled ? 'cursor-pointer hover:border-[#FDE047] hover:scale-105 active:scale-95' : ''
        } ${className}`}
      >
        {/* Specular 3D Gloss Sheen */}
        <div className="absolute -top-10 -left-10 w-28 h-28 bg-gradient-to-br from-white/30 via-white/10 to-transparent rounded-full blur-[2px] pointer-events-none" />

        {/* Outer Filigree Gold Border */}
        <div className="absolute inset-1 rounded-xl border border-[#E5A93C]/40 pointer-events-none flex flex-col items-center justify-center p-1">
          {/* Subtle Guilloche Diamond Background Pattern */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#E5A93C_1px,transparent_1px)] [background-size:6px_6px]" />

          {/* Center 3D Golden Oval Medallion */}
          <div className="relative z-10 w-[78%] h-[62%] rounded-[50%] bg-gradient-to-b from-[#E5A93C] via-[#B45309] to-[#78350F] p-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.6)] -rotate-12 flex items-center justify-center border border-amber-200/80">
            <div className="w-full h-full rounded-[50%] bg-gradient-to-b from-[#0F1626] to-[#070A12] flex flex-col items-center justify-center text-center p-1 shadow-inner">
              <Crown className="w-2/5 h-2/5 text-[#FDE047] drop-shadow-[0_0_8px_rgba(253,224,71,0.8)] animate-pulse mb-0.5" />
              <div className="text-[10px] sm:text-xs font-black font-royal tracking-widest text-[#FDE047] drop-shadow leading-none">
                UNO
              </div>
              <div className="text-[7px] sm:text-[9px] font-bold font-royal tracking-wider text-amber-200/90 leading-tight">
                KING
              </div>
            </div>
          </div>
        </div>

        {/* 3D Bottom Edge Bevel Shadow */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40 pointer-events-none" />
      </div>
    );
  }

  // =========================================================================
  // 3D CARD FRONT (Vivid Jewels with Iconic Center Capsule Oval)
  // =========================================================================
  let bgGradient = '';
  let borderColor = '';
  let emblemTextColor = '';
  let badgeGlow = '';

  if (card.color === 'gold') {
    bgGradient = 'bg-gradient-to-br from-[#FFE066] via-[#F59E0B] to-[#B45309]';
    borderColor = 'border-[#FEF08A]';
    emblemTextColor = 'text-[#B45309]';
    badgeGlow = 'shadow-[0_0_20px_rgba(245,158,11,0.5)]';
  } else if (card.color === 'crimson') {
    bgGradient = 'bg-gradient-to-br from-[#FF4370] via-[#E11D48] to-[#881337]';
    borderColor = 'border-[#FFE4E6]';
    emblemTextColor = 'text-[#BE123C]';
    badgeGlow = 'shadow-[0_0_20px_rgba(225,29,72,0.5)]';
  } else if (card.color === 'sapphire') {
    bgGradient = 'bg-gradient-to-br from-[#38BDF8] via-[#2563EB] to-[#1E3A8A]';
    borderColor = 'border-[#BFDBFE]';
    emblemTextColor = 'text-[#1D4ED8]';
    badgeGlow = 'shadow-[0_0_20px_rgba(37,99,235,0.5)]';
  } else if (card.color === 'emerald') {
    bgGradient = 'bg-gradient-to-br from-[#34D399] via-[#059669] to-[#064E3B]';
    borderColor = 'border-[#A7F3D0]';
    emblemTextColor = 'text-[#047857]';
    badgeGlow = 'shadow-[0_0_20px_rgba(5,150,105,0.5)]';
  } else {
    // Wild Card - True Solid Luxury Jet Black with Rich Golden Rim
    bgGradient = 'bg-black bg-gradient-to-b from-[#121216] via-[#050508] to-[#000000]';
    borderColor = 'border-[#F59E0B]';
    emblemTextColor = 'text-[#FDE047]';
    badgeGlow = 'shadow-[0_0_30px_rgba(245,158,11,0.45),0_10px_35px_rgba(0,0,0,0.95)]';
  }

  // Symbol or Number content inside oval or corners
  const renderSymbol = (isCorner = false) => {
    switch (card.type) {
      case 'number':
        return (
          <span
            className={`font-black font-royal ${
              isCorner
                ? 'text-[11px] sm:text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                : `${emblemTextColor} drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)] ${
                    size === 'md' ? 'text-3xl sm:text-4xl' : size === 'sm' ? 'text-xl' : 'text-4xl sm:text-5xl'
                  }`
            }`}
          >
            {card.value}
          </span>
        );
      case 'skip':
        return isCorner ? (
          <Ban className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
        ) : (
          <Ban
            className={`${emblemTextColor} drop-shadow-[0_3px_5px_rgba(0,0,0,0.3)] ${
              size === 'md' ? 'w-8 h-8 sm:w-10 sm:h-10' : size === 'sm' ? 'w-5 h-5' : 'w-11 h-11 sm:w-14 sm:h-14'
            }`}
          />
        );
      case 'reverse':
        return isCorner ? (
          <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
        ) : (
          <RotateCcw
            className={`${emblemTextColor} drop-shadow-[0_3px_5px_rgba(0,0,0,0.3)] ${
              size === 'md' ? 'w-8 h-8 sm:w-10 sm:h-10' : size === 'sm' ? 'w-5 h-5' : 'w-11 h-11 sm:w-14 sm:h-14'
            }`}
          />
        );
      case 'draw2':
        return isCorner ? (
          <span className="font-black text-[10px] sm:text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">+2</span>
        ) : (
          <div
            className={`flex items-center font-black font-royal tracking-tight ${emblemTextColor} drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${
              size === 'md' ? 'text-2xl sm:text-3xl' : size === 'sm' ? 'text-lg' : 'text-3xl sm:text-4xl'
            }`}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 -mr-0.5" />2
          </div>
        );
      case 'wild':
      case 'wild4':
        return isCorner ? (
          card.type === 'wild4' ? (
            <span className="font-black text-[10px] sm:text-xs text-[#FDE047] drop-shadow-[0_0_6px_rgba(253,224,71,0.8)]">+4</span>
          ) : (
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FDE047] drop-shadow-[0_0_6px_rgba(253,224,71,0.8)]" />
          )
        ) : (
          <div className="relative flex items-center justify-center">
            {/* 3D 4-Quadrant Gemstone Sphere Perfectly Centered */}
            <div
              className={`${
                size === 'hero'
                  ? 'w-16 h-16 sm:w-20 sm:h-20'
                  : size === 'lg'
                  ? 'w-12 h-12 sm:w-14 sm:h-14'
                  : size === 'md'
                  ? 'w-10 h-10 sm:w-12 sm:h-12'
                  : 'w-7 h-7'
              } rounded-full grid grid-cols-2 overflow-hidden border-2 border-white shadow-[0_6px_18px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.8)] rotate-45`}
            >
              <div className="bg-[#FF1E56]" />
              <div className="bg-[#2563EB]" />
              <div className="bg-[#F59E0B]" />
              <div className="bg-[#10B981]" />
            </div>
            <Crown
              className={`${
                size === 'hero' ? 'w-7 h-7' : size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
              } text-[#FDE047] absolute drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] animate-pulse`}
            />
          </div>
        );
    }
  };

  const isClickable = onClick && !disabled && isLegal;

  return (
    <div
      id={id}
      onClick={isClickable ? onClick : undefined}
      className={`${sizeClasses} relative select-none flex flex-col justify-between p-1.5 sm:p-2.5 text-white ${bgGradient} border-2 ${borderColor} card-3d-shadow overflow-hidden transition-all duration-200 ${
        isLegal
          ? 'cursor-pointer card-legal-pulse hover:border-white ring-2 ring-[#FDE047] ring-offset-2 ring-offset-[#080B14]'
          : disabled
          ? 'opacity-40 cursor-not-allowed filter grayscale-[25%]'
          : 'opacity-100'
      } ${selected ? 'ring-4 ring-[#FDE047] -translate-y-3 shadow-2xl' : ''} ${badgeGlow} ${className}`}
    >
      {/* Specular 3D Gloss Highlight Sheen */}
      <div className="absolute -top-8 -left-8 w-24 h-24 bg-gradient-to-br from-white/35 via-white/10 to-transparent rounded-full blur-[1px] pointer-events-none" />

      {/* Decorative Inner White Hairline Rim */}
      <div className="absolute inset-0.5 rounded-xl border border-white/30 pointer-events-none" />

      {/* Subtle Guilloche/Carbon Texture (for non-wild cards) */}
      {card.color !== 'wild' && (
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:6px_6px] pointer-events-none" />
      )}

      {/* Top Left Corner Symbol */}
      <div className="relative z-20 flex flex-col items-start leading-none drop-shadow">
        {renderSymbol(true)}
      </div>

      {/* Center 3D Classic Tilted Oval Medallion Capsule */}
      <div className="relative z-10 flex items-center justify-center my-auto">
        <div
          className={`w-[84%] h-[66%] rounded-[50%] ${
            card.color === 'wild'
              ? 'bg-[#000000] border-2 border-[#F59E0B] shadow-[0_8px_25px_rgba(0,0,0,1),inset_0_2px_6px_rgba(245,158,11,0.5)]'
              : 'bg-gradient-to-b from-white via-slate-50 to-slate-200 border-2 border-white shadow-[0_5px_15px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.1)]'
          } -rotate-12 flex items-center justify-center p-1 sm:p-2 transition-transform`}
        >
          <div className="rotate-12 flex items-center justify-center">
            {renderSymbol(false)}
          </div>
        </div>
      </div>

      {/* Bottom Right Inverted Corner Symbol */}
      <div className="relative z-20 flex flex-col items-end leading-none rotate-180 drop-shadow">
        {renderSymbol(true)}
      </div>

      {/* Playable floating indicator crown */}
      {isLegal && !disabled && (
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-30">
          <Crown className="w-3.5 h-3.5 text-[#FDE047] animate-bounce drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]" />
        </div>
      )}

      {/* Bottom 3D Bevel Shadow */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-black/30 pointer-events-none" />
    </div>
  );
};

