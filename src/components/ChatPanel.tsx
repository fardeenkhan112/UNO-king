import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ChatMessage } from '../types';
import { MessageCircle, Send, Smile, X } from 'lucide-react';

const QUICK_EMOJIS = ['😂', '😭', '😈', '😎', '🔥', '💀', '👑', '❤️', '👍', '😡', '😱', '🎉'];

interface ChatPanelProps {
  socket: Socket;
  myPlayerId: string;
  players: { id: string; name: string; avatar: string }[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ socket, myPlayerId, players }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  useEffect(() => {
    const onMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-79), message]);
      if (!open && message.playerId !== myPlayerId) setUnread((n) => Math.min(99, n + 1));
    };
    const onError = (payload: { message?: string }) => {
      setError(payload.message || 'Chat unavailable.');
      window.setTimeout(() => setError(null), 2500);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:error', onError);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:error', onError);
    };
  }, [myPlayerId, open, socket]);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [messages, open]);

  const send = () => {
    const value = text.trim();
    if (!value || value.length > 200) return;
    socket.emit('chat:send', { text: value });
    setText('');
  };

  const addEmoji = (emoji: string) => {
    setText((current) => `${current}${emoji}`.slice(0, 200));
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Closed state is intentionally tiny and fixed so it never changes the game layout. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="social-fab social-fab--chat"
        aria-label={open ? 'Close chat' : 'Open chat'}
        title={open ? 'Close chat' : 'Open chat'}
      >
        {open ? <X className="w-[18px] h-[18px] text-amber-200" /> : <MessageCircle className="w-[18px] h-[18px] text-amber-300" />}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center border border-[#080B14]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="social-panel social-panel--chat animate-fade-in">
          <div className="social-panel__header">
            <div>
              <div className="font-royal font-bold text-amber-300 tracking-wide text-sm">ROYAL CHAT</div>
              <div className="text-[10px] text-slate-500">Talk to everyone at the table</div>
            </div>
            <div className="social-panel__icon social-panel__icon--chat">
              <MessageCircle className="w-4 h-4 text-amber-400" />
            </div>
          </div>

          <div className="social-panel__body">
            {messages.length === 0 ? (
              <div className="h-full grid place-items-center text-center text-slate-500 text-xs px-8">
                <div>
                  <div className="text-3xl mb-2">👑</div>
                  Start the conversation without leaving the table.
                </div>
              </div>
            ) : messages.map((message) => {
              const player = playerMap.get(message.playerId);
              const mine = message.playerId === myPlayerId;
              return (
                <div key={message.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 shrink-0 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-sm">
                    {player?.avatar || message.avatar || '👤'}
                  </div>
                  <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className="text-[9px] text-slate-500 px-1 mb-0.5 truncate max-w-full">{message.username}</div>
                    <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap ${mine ? 'bg-amber-500/15 border border-amber-400/30 text-amber-50 rounded-tr-sm' : 'bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-sm'}`}>
                      {message.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <div className="social-panel__composer">
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-2">
              {QUICK_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => addEmoji(emoji)} className="w-7 h-7 shrink-0 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 text-sm transition-colors" aria-label={`Insert ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-3">
              <button type="button" onClick={() => addEmoji('😊')} className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-300 shrink-0" aria-label="Add emoji">
                <Smile className="w-4 h-4" />
              </button>
              <input
                ref={inputRef}
                value={text}
                maxLength={200}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Type a message..."
                className="min-w-0 flex-1 h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 outline-none focus:border-amber-500/50"
              />
              <button type="button" onClick={send} disabled={!text.trim()} className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 disabled:opacity-40 flex items-center justify-center shrink-0 hover:bg-amber-400 transition-colors" aria-label="Send message">
                <Send className="w-4 h-4" />
              </button>
            </div>
            {error && <div className="pb-2 text-[10px] text-rose-300">{error}</div>}
          </div>
        </div>
      )}
    </>
  );
};
