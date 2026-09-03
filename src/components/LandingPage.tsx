import React, { useState } from 'react';
import {
  Crown,
  Play,
  Users,
  LogIn,
  Zap,
  Globe,
  ShieldCheck,
  Bot,
  Smartphone,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { TactileCardsShowcase } from './TactileCardsShowcase';
import { sound } from '../utils/sound';

interface LandingPageProps {
  onPlayNow: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onOpenHowToPlay: () => void;
  onOpenProfile: () => void;
  joinError?: string | null;
  isJoining?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onPlayNow,
  onCreateRoom,
  onJoinRoom,
  onOpenHowToPlay,
  onOpenProfile,
  joinError,
  isJoining = false,
}) => {
  const [inviteCode, setInviteCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setInviteCode(val);
    setLocalError(null);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    if (inviteCode.length !== 4) {
      setLocalError('Please enter a 4-character room code.');
      return;
    }
    setLocalError(null);
    onJoinRoom(inviteCode);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* ==================================================== */}
      {/* 1. HERO SECTION */}
      {/* ==================================================== */}
      <section className="relative w-full min-h-[85vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-12 pb-16 overflow-hidden">
        {/* Ambient subtle glow background */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-gradient-to-b from-[#E5A93C]/10 via-[#2563EB]/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 left-10 w-48 h-48 bg-rose-500/5 blur-[80px] pointer-events-none rounded-full" />

        {/* Top Premium Badge */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#111728]/90 border border-[#E5A93C]/40 text-[#E5A93C] text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-4 sm:mb-6 shadow-[0_0_15px_rgba(229,169,60,0.15)] animate-fade-in">
          <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>REAL-TIME MULTIPLAYER • 1 TO 8 PLAYERS</span>
        </div>

        {/* Hero Heading */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-royal font-black tracking-tight text-white max-w-4xl leading-[1.15] sm:leading-[1.1] mb-4 sm:mb-6">
          Become the{' '}
          <span className="text-[#E5A93C] drop-shadow-[0_0_25px_rgba(229,169,60,0.4)]">
            UNO
          </span>{' '}
          <span className="text-[#E5A93C] drop-shadow-[0_0_25px_rgba(229,169,60,0.4)]">
            KING
          </span>
          .
        </h1>

        {/* Supporting Text */}
        <p className="text-slate-300 text-sm sm:text-lg md:text-xl max-w-2xl leading-relaxed mb-8 sm:mb-10 font-normal px-2">
          The ultimate party card game. Play instantly against smart bots or create a custom room with friends for 1 to 8 players.
        </p>

        {/* Main CTA Dual Buttons */}
        <div className="w-full max-w-md flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* PLAY NOW (AI Match Flow) */}
          <div className="w-full sm:w-1/2 flex flex-col items-center">
            <button
              id="hero-play-now-btn"
              onClick={() => {
                sound.playClick();
                onPlayNow();
              }}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 sm:py-4 px-6 rounded-2xl btn-3d-gold text-black font-royal font-black text-sm sm:text-base transition-all cursor-pointer touch-manipulation"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
              PLAY NOW
            </button>
            <span className="text-[11px] text-slate-400 mt-1.5 font-medium">
              Select bots & play instantly
            </span>
          </div>

          {/* CREATE ROOM (Multiplayer Flow) */}
          <div className="w-full sm:w-1/2 flex flex-col items-center">
            <button
              id="hero-create-room-btn"
              onClick={() => {
                sound.playClick();
                onCreateRoom();
              }}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 sm:py-4 px-6 rounded-2xl btn-3d-dark text-white font-royal font-black text-sm sm:text-base border border-amber-500/50 hover:border-amber-400 transition-all cursor-pointer touch-manipulation"
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#FDE047]" />
              CREATE ROOM
            </button>
            <span className="text-[11px] text-slate-400 mt-1.5 font-medium">
              Invite friends & play up to 8 players
            </span>
          </div>
        </div>

        {/* ==================================================== */}
        {/* INVITE CODE BOX ON LANDING PAGE */}
        {/* ==================================================== */}
        <div className="w-full max-w-xs sm:max-w-sm mt-2 sm:mt-4 p-3.5 sm:p-4 rounded-2xl bg-[#0B0F19]/90 border border-slate-800 shadow-xl backdrop-blur-md">
          <div className="text-[11px] sm:text-xs font-bold font-royal uppercase tracking-wider text-slate-400 mb-2">
            HAVE AN INVITE CODE?
          </div>
          <form onSubmit={handleJoinSubmit} className="flex items-center gap-2">
            <input
              type="text"
              id="landing-room-code-input"
              value={inviteCode}
              onChange={handleCodeChange}
              maxLength={4}
              placeholder="ENTER 4 LETTERS"
              className="flex-1 uppercase font-royal font-black tracking-widest text-center py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#FDE047] focus:ring-1 focus:ring-[#FDE047] text-xs sm:text-sm"
            />
            <button
              type="submit"
              id="landing-join-btn"
              disabled={isJoining}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 sm:px-5 rounded-xl btn-3d-gold text-black font-royal font-black text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {isJoining ? 'JOINING...' : 'JOIN'}
            </button>
          </form>

          {/* Friendly Validation / Error States */}
          {(localError || joinError) && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 mt-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{localError || joinError}</span>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================== */}
      {/* 2. TACTILE HIGH-ENERGY CARDS SECTION (3D INTERACTION) */}
      {/* ==================================================== */}
      <TactileCardsShowcase />

      {/* ==================================================== */}
      {/* 3. FEATURE BENEFIT CARDS (COMPACT CUTE 1-LINE ROW) */}
      {/* ==================================================== */}
      <section className="w-full max-w-5xl mx-auto px-2 sm:px-6 py-8 sm:py-10">
        <div className="text-center max-w-md mx-auto mb-4 sm:mb-5">
          <div className="text-[10px] sm:text-xs font-bold font-royal uppercase tracking-widest text-[#FDE047] mb-0.5">
            INSTANT PLAY
          </div>
          <h3 className="text-lg sm:text-xl font-royal font-bold text-white">
            Engineered for Fast Fun
          </h3>
        </div>

        {/* 1 Single Horizontal Row of Cute Compact Feature Chips */}
        <div className="w-full flex items-stretch gap-2 sm:gap-2.5 overflow-x-auto cards-scrollbar justify-start md:justify-center py-2 px-1">
          {/* Card 1 */}
          <div className="flex-shrink-0 w-32 sm:w-40 min-w-[125px] sm:min-w-[145px] p-2.5 sm:p-3 rounded-2xl bg-gradient-to-b from-[#13192B] to-[#0A0E18] border border-slate-800 hover:border-amber-400/50 transition-all flex flex-col items-center text-center shadow-md group">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 text-[#FDE047] border border-amber-400/30 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h4 className="font-royal font-bold text-xs text-white mb-0.5 whitespace-nowrap">No Download</h4>
            <p className="text-[10px] text-slate-400 leading-tight">
              Direct browser play with zero installation.
            </p>
          </div>

          {/* Card 2 */}
          <div className="flex-shrink-0 w-32 sm:w-40 min-w-[125px] sm:min-w-[145px] p-2.5 sm:p-3 rounded-2xl bg-gradient-to-b from-[#13192B] to-[#0A0E18] border border-slate-800 hover:border-blue-400/50 transition-all flex flex-col items-center text-center shadow-md group">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-400/30 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h4 className="font-royal font-bold text-xs text-white mb-0.5 whitespace-nowrap">No Accounts</h4>
            <p className="text-[10px] text-slate-400 leading-tight">
              Play instantly as a guest. Set your crest.
            </p>
          </div>

          {/* Card 3 */}
          <div className="flex-shrink-0 w-32 sm:w-40 min-w-[125px] sm:min-w-[145px] p-2.5 sm:p-3 rounded-2xl bg-gradient-to-b from-[#13192B] to-[#0A0E18] border border-slate-800 hover:border-rose-400/50 transition-all flex flex-col items-center text-center shadow-md group">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-400/30 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h4 className="font-royal font-bold text-xs text-white mb-0.5 whitespace-nowrap">Private Rooms</h4>
            <p className="text-[10px] text-slate-400 leading-tight">
              Invite friends with 4 letters, link, or QR.
            </p>
          </div>

          {/* Card 4 */}
          <div className="flex-shrink-0 w-32 sm:w-40 min-w-[125px] sm:min-w-[145px] p-2.5 sm:p-3 rounded-2xl bg-gradient-to-b from-[#13192B] to-[#0A0E18] border border-slate-800 hover:border-purple-400/50 transition-all flex flex-col items-center text-center shadow-md group">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-400/30 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h4 className="font-royal font-bold text-xs text-white mb-0.5 whitespace-nowrap">Smart AI Bots</h4>
            <p className="text-[10px] text-slate-400 leading-tight">
              Play against strategic AI opponents.
            </p>
          </div>

          {/* Card 5 */}
          <div className="flex-shrink-0 w-32 sm:w-40 min-w-[125px] sm:min-w-[145px] p-2.5 sm:p-3 rounded-2xl bg-gradient-to-b from-[#13192B] to-[#0A0E18] border border-slate-800 hover:border-emerald-400/50 transition-all flex flex-col items-center text-center shadow-md group">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-400/30 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <h4 className="font-royal font-bold text-xs text-white mb-0.5 whitespace-nowrap">Cross-Platform</h4>
            <p className="text-[10px] text-slate-400 leading-tight">
              Phones, tablets, laptops & desktop.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* 4. HOW IT WORKS (3-STEP FLOW) */}
      {/* ==================================================== */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center max-w-xl mx-auto mb-12">
          <div className="text-xs font-bold uppercase tracking-widest text-[#E5A93C] mb-1">
            SIMPLE 3-STEP FLOW
          </div>
          <h3 className="text-3xl font-royal font-bold text-white">
            How It Works
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="relative p-6 rounded-3xl bg-[#0F1424] border border-slate-800 flex flex-col">
            <div className="text-3xl font-royal font-black text-[#E5A93C]/40 mb-3">01</div>
            <h4 className="text-lg font-royal font-bold text-white mb-2">
              Play Solo or Create Room
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Hit <strong>Play Now</strong> for an instant match against AI bots, or <strong>Create Room</strong> to invite friends.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative p-6 rounded-3xl bg-[#0F1424] border border-slate-800 flex flex-col">
            <div className="text-3xl font-royal font-black text-[#E5A93C]/40 mb-3">02</div>
            <h4 className="text-lg font-royal font-bold text-white mb-2">
              Share Code or QR
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Copy the 4-character room code, share the invite link, or show the QR code to your friends.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative p-6 rounded-3xl bg-[#0F1424] border border-slate-800 flex flex-col">
            <div className="text-3xl font-royal font-black text-[#E5A93C]/40 mb-3">03</div>
            <h4 className="text-lg font-royal font-bold text-white mb-2">
              Match Cards & Win
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Match cards by color or number, use action cards strategically, and be the first to empty your hand.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* 5. FINAL CTA SECTION */}
      {/* ==================================================== */}
      <section className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <div className="relative rounded-3xl bg-gradient-to-b from-[#141B30] via-[#0E1424] to-[#070A12] border border-[#E5A93C]/40 p-8 sm:p-14 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32 bg-amber-500/15 blur-3xl pointer-events-none rounded-full" />

          <div className="inline-flex p-3 rounded-2xl bg-amber-500/15 text-[#E5A93C] mb-4 border border-amber-500/30">
            <Crown className="w-8 h-8" />
          </div>

          <h3 className="text-3xl sm:text-5xl font-royal font-black text-white tracking-wide mb-3">
            READY TO CLAIM THE CROWN?
          </h3>

          <p className="text-slate-300 text-sm sm:text-base max-w-md mx-auto mb-8">
            Play instantly against AI or create a private room and invite your friends.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                sound.playClick();
                onPlayNow();
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#E5A93C] to-[#F59E0B] text-black font-royal font-black text-sm hover:brightness-110 active:scale-95 shadow-[0_0_25px_rgba(229,169,60,0.4)] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              PLAY NOW (AI)
            </button>

            <button
              onClick={() => {
                sound.playClick();
                onCreateRoom();
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-[#090D18] hover:bg-[#111728] text-white font-royal font-bold text-sm border border-amber-500/40 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#E5A93C]" />
              CREATE ROOM
            </button>
          </div>
        </div>
      </section>

      {/* ==================================================== */}
      {/* 6. FOOTER */}
      {/* ==================================================== */}
      <footer className="w-full border-t border-slate-800/80 py-8 px-4 sm:px-6 mt-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-royal font-bold">
            <Crown className="w-4 h-4 text-[#E5A93C]" />
            <span className="text-white">UNO KING</span>
            <span className="text-slate-500">|</span>
            <span className="font-normal text-slate-400">
              Fast, Modern Multiplayer Card Battles
            </span>
          </div>

          <div className="text-center font-medium">
            <strong className="text-amber-400 font-bold">⚡Built &amp; Designed by &quot;FARDEEN KHAN&quot;</strong>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={onOpenHowToPlay} className="hover:text-amber-400 transition-colors">
              Rules
            </button>
            <button onClick={onOpenProfile} className="hover:text-amber-400 transition-colors">
              Profile
            </button>
            <span className="text-emerald-400 font-semibold">Free to Play</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
