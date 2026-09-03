import React, { useState } from 'react';
import { X, Crown, Check } from 'lucide-react';
import { UserProfile } from '../types';
import { AVATAR_OPTIONS } from '../utils/cardUtils';
import { sound } from '../utils/sound';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (updated: UserProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
}) => {
  const [name, setName] = useState<string>(profile.name);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(profile.avatar);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    const cleanName = name.trim().slice(0, 16) || 'Player';
    onSave({
      name: cleanName,
      avatar: selectedAvatar,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="profile-modal"
        className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#111728] via-[#0D1220] to-[#080B14] border border-amber-500/30 shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-5 sm:p-8 text-white"
      >
        {/* Close button */}
        <button
          id="close-profile-btn"
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#E5A93C] mb-1">
          <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          PLAYER IDENTITY
        </div>
        <h3 className="text-xl sm:text-2xl font-royal font-bold text-white mb-1">
          Guest Profile
        </h3>
        <p className="text-slate-400 text-xs mb-5 sm:mb-6">
          Customize your royal table presence. Saved locally on this browser.
        </p>

        <form onSubmit={handleSave} className="space-y-4 sm:space-y-5">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              id="profile-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="e.g. Fardeen"
              className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white font-semibold text-sm sm:text-base focus:outline-none focus:border-[#E5A93C] focus:ring-1 focus:ring-[#E5A93C]"
            />
          </div>

          {/* Avatar Selection Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Choose Royal Crest Avatar
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {AVATAR_OPTIONS.map((av) => {
                const isSelected = selectedAvatar === av;
                return (
                  <button
                    type="button"
                    key={av}
                    onClick={() => {
                      sound.playClick();
                      setSelectedAvatar(av);
                    }}
                    className={`h-11 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl border transition-all cursor-pointer touch-manipulation ${
                      isSelected
                        ? 'bg-amber-500/20 border-[#E5A93C] scale-105 sm:scale-110 shadow-[0_0_12px_rgba(229,169,60,0.4)]'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {av}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-profile-btn"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#F59E0B] text-black font-extrabold font-royal text-xs sm:text-sm hover:brightness-110 active:scale-95 shadow-[0_0_15px_rgba(229,169,60,0.3)] transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              SAVE PROFILE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
