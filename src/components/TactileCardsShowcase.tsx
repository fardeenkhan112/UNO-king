import React, { useState, useRef } from 'react';
import { CardView } from './CardView';
import { Card } from '../types';
import { Sparkles, MousePointerClick } from 'lucide-react';
import { sound } from '../utils/sound';

interface ShowcaseCardItem {
  id: string;
  card: Card;
  label: string;
  baseRotate: number;
  baseTranslateY: number;
  baseTranslateX: number;
  baseZIndex: number;
  flipDirection?: 'left' | 'center' | 'right';
  isDominant?: boolean;
}

const SHOWCASE_CARDS: ShowcaseCardItem[] = [
  {
    id: 'showcase-left',
    card: { id: 'card-reverse', color: 'crimson', type: 'reverse' },
    label: 'Crimson Reverse',
    baseRotate: -12,
    baseTranslateY: 14,
    baseTranslateX: -6,
    baseZIndex: 10,
    flipDirection: 'left',
  },
  {
    id: 'showcase-center',
    card: { id: 'card-wild', color: 'wild', type: 'wild' },
    label: 'Royal Wild Crown',
    baseRotate: 0,
    baseTranslateY: -8,
    baseTranslateX: 0,
    baseZIndex: 25,
    flipDirection: 'center',
    isDominant: true,
  },
  {
    id: 'showcase-right',
    card: { id: 'card-draw2', color: 'sapphire', type: 'draw2' },
    label: 'Sapphire +2',
    baseRotate: 12,
    baseTranslateY: 14,
    baseTranslateX: 6,
    baseZIndex: 10,
    flipDirection: 'right',
  },
];

export const TactileCardsShowcase: React.FC = () => {
  return (
    <section className="relative w-full max-w-6xl mx-auto px-3 sm:px-6 py-12 sm:py-20">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-[550px] h-80 sm:h-[380px] bg-gradient-to-r from-rose-500/15 via-amber-500/20 to-blue-600/20 blur-[90px] pointer-events-none rounded-full" />

      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 relative z-10 px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111728] border border-[#E5A93C]/30 text-amber-400 text-xs font-semibold tracking-wider uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#E5A93C]" />
          Interactive 3D Physics
        </div>
        <h2 className="text-2xl sm:text-4xl font-bold font-royal tracking-wide text-white mb-2 sm:mb-3">
          Tactile, High-Energy Cards
        </h2>
        <p className="text-slate-400 text-xs sm:text-base">
          Hover or tap any card to flip it in 3D with audio feedback.
        </p>
      </div>

      {/* Showcase Container */}
      <div className="relative z-10 w-full max-w-4xl mx-auto rounded-3xl bg-gradient-to-b from-[#0F1424]/95 via-[#0B0F19]/95 to-[#070A12]/98 border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-md p-4 sm:p-10 overflow-hidden">
        {/* Subtle radial inner spotlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(229,169,60,0.12),transparent_60%)] pointer-events-none" />

        {/* Card Stage with 3D Perspective */}
        <div className="perspective-1000 w-full flex items-center justify-center min-h-[260px] sm:min-h-[340px] py-4">
          {/* Overlapping fan layout where center card sits on top and side cards tuck underneath */}
          <div className="relative flex items-center justify-center -space-x-8 sm:-space-x-12 md:-space-x-16">
            {SHOWCASE_CARDS.map((item) => (
              <InteractiveShowcaseCard key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Mobile / Touch Hint */}
        <div className="flex sm:hidden items-center justify-center gap-2 mt-2 text-[11px] text-slate-400">
          <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
          <span>Tap any card to flip with sound effect</span>
        </div>
      </div>
    </section>
  );
};

interface InteractiveShowcaseCardProps {
  item: ShowcaseCardItem;
}

const InteractiveShowcaseCard: React.FC<InteractiveShowcaseCardProps> = ({ item }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Interactive tilt (max 10 degrees)
    const tiltX = ((y - centerY) / centerY) * -10;
    const tiltY = ((x - centerX) / centerX) * 10;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => {
    if (!isHovered) {
      sound.playFlip();
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  const handleTouchToggle = () => {
    sound.playFlip();
    setIsHovered((prev) => !prev);
  };

  // 3D transforms:
  // When hovered/tapped: lifts up, rises above other cards (z-index 50), flips 180deg
  // For the left card: flips from leftward orientation smoothly
  const flipAngle = item.flipDirection === 'left' ? -180 : 180;
  const currentRotateY = isHovered ? flipAngle : 0;
  const currentRotateZ = isHovered ? 0 : item.baseRotate;
  const currentTranslateY = isHovered ? -20 : item.baseTranslateY;
  const currentTranslateX = isHovered ? (item.flipDirection === 'left' ? -8 : item.flipDirection === 'right' ? 8 : 0) : item.baseTranslateX;
  const currentScale = isHovered ? 1.08 : item.isDominant ? 1.04 : 0.98;
  const currentZIndex = isHovered ? 60 : item.baseZIndex;

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleTouchToggle}
      style={{
        zIndex: currentZIndex,
      }}
      className="relative cursor-pointer select-none transition-transform duration-500 ease-out"
    >
      <div
        style={{
          transform: `translateX(${currentTranslateX}px) translateY(${currentTranslateY}px) rotateZ(${currentRotateZ}deg) scale(${currentScale}) rotateX(${
            isHovered ? tilt.x * 0.4 : 0
          }deg) rotateY(${currentRotateY + (isHovered ? tilt.y * 0.4 : 0)}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 550ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        className="relative w-24 h-36 sm:w-36 sm:h-54 md:w-44 md:h-64"
      >
        {/* FRONT FACE (Normal Front View) */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
          className="absolute inset-0 w-full h-full"
        >
          <CardView
            card={item.card}
            size="hero"
            className="w-full h-full shadow-[0_15px_35px_rgba(0,0,0,0.75)]"
          />
        </div>

        {/* BACK FACE (Royal UNO King Back View) */}
        <div
          style={{
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
          className="absolute inset-0 w-full h-full"
        >
          <CardView
            isBack
            size="hero"
            className="w-full h-full shadow-[0_20px_45px_rgba(229,169,60,0.45)]"
          />
        </div>
      </div>
    </div>
  );
};
