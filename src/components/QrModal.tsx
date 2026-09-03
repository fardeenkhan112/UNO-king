import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, QrCode as QrIcon } from 'lucide-react';
import { sound } from '../utils/sound';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export const QrModal: React.FC<QrModalProps> = ({ isOpen, onClose, roomCode }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?room=${roomCode}`
    : `https://unoking.game/join/${roomCode}`;

  useEffect(() => {
    if (!isOpen || !roomCode) return;

    QRCode.toDataURL(joinUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#080B14',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });
  }, [isOpen, roomCode, joinUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    sound.playClick();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="qr-modal"
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#111728] via-[#0D1220] to-[#080B14] border border-amber-500/30 shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-5 sm:p-6 text-white flex flex-col items-center text-center max-h-[92vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          id="close-qr-modal-btn"
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#E5A93C] mb-1">
          <QrIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          INVITE VIA CAMERA
        </div>
        <h3 className="text-xl sm:text-2xl font-royal font-bold text-white mb-3 sm:mb-4">
          Scan to Join
        </h3>

        {/* QR Code Container */}
        <div className="p-2.5 sm:p-3 bg-white rounded-2xl shadow-xl border-4 border-amber-500/40 mb-3 sm:mb-4 flex items-center justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code to join room ${roomCode}`}
              className="w-44 h-44 sm:w-52 sm:h-52 rounded-lg object-contain"
            />
          ) : (
            <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center text-slate-500 text-xs sm:text-sm">
              Generating QR Code...
            </div>
          )}
        </div>

        {/* Room Code Display */}
        <div className="mb-4 sm:mb-5">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
            ROOM CODE
          </div>
          <div className="text-2xl sm:text-3xl font-royal font-black tracking-widest text-[#E5A93C] px-4 py-1 rounded-xl bg-slate-900 border border-amber-500/30">
            {roomCode}
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex items-center gap-2">
          <button
            id="qr-copy-link-btn"
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#F59E0B] text-black font-extrabold font-royal text-xs sm:text-sm hover:brightness-110 active:scale-95 shadow-[0_0_15px_rgba(229,169,60,0.3)] transition-all cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'COPIED LINK!' : 'COPY LINK'}
          </button>
          <button
            id="qr-close-btn"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
