import React from 'react';
import { Crown, Volume2, VolumeX, HelpCircle, User } from 'lucide-react';
import { UserProfile } from '../types';
import { sound } from '../utils/sound';

interface NavbarProps {
  profile: UserProfile;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenHowToPlay: () => void;
  onOpenProfile: () => void;
  onLogoClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  soundEnabled,
  onToggleSound,
  onOpenHowToPlay,
  onOpenProfile,
  onLogoClick,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full navbar-shell">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-[62px] flex items-center justify-between">
        {/* LOGO */}
        <div
          id="uno-king-logo"
          onClick={() => {
            sound.playClick();
            if (onLogoClick) onLogoClick();
          }}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          {/* Crown icon inside rounded square */}
          <div className="navbar-crest">
            <Crown className="w-5 h-5 text-[#E5A93C] drop-shadow-[0_0_8px_rgba(229,169,60,0.5)]" />
          </div>

          <div className="leading-tight">
            <div className="flex items-center text-[17px] sm:text-xl font-royal font-black tracking-wider">
              <span className="text-white">UNO</span>
              <span className="text-[#E5A93C] ml-1.5 drop-shadow-[0_0_8px_rgba(229,169,60,0.4)]">
                KING
              </span>
            </div>
            <div className="text-[8px] sm:text-[9px] font-bold tracking-[0.2em] text-slate-500 uppercase">
              ROYAL CARD GAME
            </div>
          </div>
        </div>

        {/* RIGHT CONTROLS */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Sound Toggle */}
          <button
            id="sound-toggle-btn"
            onClick={() => {
              sound.playClick();
              onToggleSound();
            }}
            className="nav-control"
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            title={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
            <span className="hidden md:inline text-xs font-semibold">
              {soundEnabled ? 'Sound' : 'Muted'}
            </span>
          </button>

          {/* How to Play button */}
          <button
            id="how-to-play-btn"
            onClick={() => {
              sound.playClick();
              onOpenHowToPlay();
            }}
            className="nav-control"
            aria-label="How to play"
            title="How to play"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline text-xs font-semibold">Rules</span>
          </button>

          {/* Profile / Guest Button */}
          <button
            id="profile-btn"
            onClick={() => {
              sound.playClick();
              onOpenProfile();
            }}
            className="nav-profile"
            title="Edit Profile"
          >
            <span className="text-base">{profile.avatar}</span>
            <span className="text-white max-w-[80px] sm:max-w-[110px] truncate">
              {profile.name}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
