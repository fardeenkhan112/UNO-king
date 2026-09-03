import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown, Trophy, RotateCcw, Home, PlusCircle } from 'lucide-react';
import { GameState, Player } from '../types';
import { sound } from '../utils/sound';

interface GameResultModalProps {
  gameState: GameState;
  currentPlayerId: string;
  onRematch: () => void;
  onNewGame: () => void;
  onLeave: () => void;
}

export const GameResultModal: React.FC<GameResultModalProps> = ({
  gameState,
  currentPlayerId,
  onRematch,
  onNewGame,
  onLeave,
}) => {
  const winner = gameState.winner;
  const isMeWinner = winner?.id === currentPlayerId;
  const isHost = gameState.hostId === currentPlayerId;

  useEffect(() => {
    // Sound & celebratory confetti
    sound.playVictory();

    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#E5A93C', '#E11D48', '#2563EB', '#059669', '#FFFFFF'],
      });
    } catch {
      // ignore
    }
  }, []);

  const rankings = gameState.rankings || gameState.players;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-lg animate-fade-in">
      <div
        id="game-result-modal"
        className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[#141B2E] via-[#0E1322] to-[#070A12] border-2 border-amber-500/50 shadow-[0_25px_70px_rgba(0,0,0,0.9)] p-5 sm:p-8 text-white text-center flex flex-col items-center max-h-[92vh] overflow-y-auto cards-scrollbar"
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-amber-500/20 blur-3xl pointer-events-none rounded-full" />

        {/* Crown Badge */}
        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-[0_0_30px_rgba(229,169,60,0.6)] mb-2.5 sm:mb-3 border-2 border-amber-200 flex-shrink-0">
          <Crown className="w-8 h-8 sm:w-12 sm:h-12 drop-shadow" />
        </div>

        <div className="text-[10px] sm:text-xs font-bold font-royal tracking-widest text-[#E5A93C] uppercase mb-1">
          CROWN CLAIMED!
        </div>

        <h2 className="text-2xl sm:text-4xl font-royal font-black text-white tracking-wide mb-1 sm:mb-2">
          {isMeWinner ? 'YOU WIN!' : `${winner?.name || 'Player'} Wins!`}
        </h2>

        <p className="text-xs sm:text-sm text-slate-300 max-w-xs mb-4 sm:mb-6">
          {isMeWinner
            ? 'You emptied your royal hand first and ascended to the throne!'
            : `${winner?.name} has triumphed over the table.`}
        </p>

        {/* Standings / Final Rankings List */}
        <div className="w-full bg-[#090D18]/90 border border-slate-800 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 text-left">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            FINAL STANDINGS
          </div>

          <div className="space-y-1.5 max-h-36 sm:max-h-44 overflow-y-auto pr-1 cards-scrollbar">
            {rankings.map((player: Player, index: number) => {
              const isWinner = index === 0;
              const isUser = player.id === currentPlayerId;
              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs sm:text-sm ${
                    isWinner
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold'
                      : isUser
                      ? 'bg-blue-600/20 border border-blue-500/30 text-blue-200 font-semibold'
                      : 'bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 font-royal font-bold text-center flex-shrink-0">
                      {index === 0 ? '👑' : `${index + 1}.`}
                    </span>
                    <span className="text-base flex-shrink-0">{player.avatar}</span>
                    <span className="truncate max-w-[120px] sm:max-w-[200px]">
                      {player.name} {isUser && '(You)'}
                    </span>
                  </div>

                  <span className="text-[11px] sm:text-xs text-slate-400 flex-shrink-0 ml-2">
                    {isWinner ? 'Winner' : `${player.cardCount || 0} cards`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
          {isHost ? (
            <button
              id="rematch-btn"
              onClick={() => {
                sound.playClick();
                onRematch();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#F59E0B] text-black font-extrabold font-royal text-xs sm:text-sm hover:brightness-110 active:scale-95 shadow-[0_0_20px_rgba(229,169,60,0.4)] transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              PLAY AGAIN
            </button>
          ) : (
            <button
              id="rematch-btn"
              onClick={() => {
                sound.playClick();
                onRematch();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#F59E0B] text-black font-extrabold font-royal text-xs sm:text-sm hover:brightness-110 active:scale-95 shadow-[0_0_20px_rgba(229,169,60,0.4)] transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              REMATCH REQUEST
            </button>
          )}

          <button
            id="new-game-btn"
            onClick={() => {
              sound.playClick();
              onNewGame();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-royal font-bold text-xs sm:text-sm border border-slate-700 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            NEW GAME
          </button>

          <button
            id="leave-result-btn"
            onClick={() => {
              sound.playClick();
              onLeave();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-royal text-xs transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            HOME
          </button>
        </div>
      </div>
    </div>
  );
};
