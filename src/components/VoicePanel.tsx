import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface VoicePanelProps {
  socket: Socket;
  myPlayerId: string;
  players: {
    id: string;
    name: string;
    avatar: string;
    isBot: boolean;
    connected: boolean;
  }[];
}

type SignalPayload = {
  fromId: string;
  targetId?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export const VoicePanel: React.FC<VoicePanelProps> = ({
  socket,
  myPlayerId,
  players,
}) => {
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const [mutedPeers, setMutedPeers] = useState<Record<string, boolean>>({});

  const joinedRef = useRef(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );

  const localStreamRef = useRef<MediaStream | null>(null);

  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const humans = useMemo(
    () =>
      players.filter(
        (p) => !p.isBot && p.connected && p.id !== myPlayerId,
      ),
    [myPlayerId, players],
  );

  const syncRemoteIds = () => {
    setRemoteIds(Array.from(peersRef.current.keys()));
  };

  const closePeer = (playerId: string) => {
    const peer = peersRef.current.get(playerId);

    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      peer.close();
    }

    peersRef.current.delete(playerId);
    pendingCandidatesRef.current.delete(playerId);

    const audio = audioElsRef.current.get(playerId);

    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    }

    audioElsRef.current.delete(playerId);

    setMutedPeers((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });

    syncRemoteIds();
  };

  const closeAllPeers = () => {
    peersRef.current.forEach((peer) => {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      peer.close();
    });

    peersRef.current.clear();
    pendingCandidatesRef.current.clear();

    audioElsRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });

    audioElsRef.current.clear();

    setRemoteIds([]);
    setMutedPeers({});
  };

  const flushCandidates = async (
    playerId: string,
    peer: RTCPeerConnection,
  ) => {
    const queue = pendingCandidatesRef.current.get(playerId) || [];

    if (queue.length === 0) return;

    pendingCandidatesRef.current.delete(playerId);

    for (const candidate of queue) {
      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // Ignore stale ICE candidates.
      }
    }
  };

  const createPeer = async (
    targetId: string,
    createOffer: boolean,
  ): Promise<RTCPeerConnection | undefined> => {
    if (!joinedRef.current) return undefined;

    if (!localStreamRef.current) return undefined;

    if (targetId === myPlayerId) return undefined;

    const existing = peersRef.current.get(targetId);

    if (existing) {
      return existing;
    }

    const peer = new RTCPeerConnection(rtcConfig);

    peersRef.current.set(targetId, peer);

    syncRemoteIds();

    const stream = localStreamRef.current;

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;

      socket.emit('voice:ice-candidate', {
        targetId,
        candidate: event.candidate.toJSON(),
      });
    };

    peer.ontrack = (event) => {
      const stream = event.streams[0];

      if (!stream) return;

      let audio = audioElsRef.current.get(targetId);

      if (!audio) {
        audio = document.createElement('audio');

        audio.autoplay = true;
        audio.playsInline = true;
        audio.className = 'hidden';

        document.body.appendChild(audio);

        audioElsRef.current.set(targetId, audio);
      }

      audio.srcObject = stream;
      audio.muted = deafened;

      void audio.play().catch(() => {
        // Browser may require user interaction before audio playback.
      });
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      if (state === 'failed' || state === 'closed') {
        closePeer(targetId);
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;

      if (state === 'failed' || state === 'closed') {
        closePeer(targetId);
      }
    };

    if (createOffer) {
      try {
        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        if (!joinedRef.current) {
          closePeer(targetId);
          return undefined;
        }

        socket.emit('voice:offer', {
          targetId,
          description: peer.localDescription,
        });
      } catch (cause) {
        console.error('Voice offer error:', cause);
        closePeer(targetId);
        return undefined;
      }
    }

    return peer;
  };

  /*
   * IMPORTANT:
   * Voice listeners stay attached for the entire lifetime of the component.
   *
   * We use joinedRef instead of putting `joined` in the dependency array.
   * This prevents listener teardown/re-registration races when joining voice.
   */
  useEffect(() => {
    const onPeerJoined = ({ playerId }: { playerId: string }) => {
      if (!joinedRef.current) return;
      if (playerId === myPlayerId) return;

      /*
       * Deterministic initiator:
       * only the player with the smaller ID creates the offer.
       */
      if (myPlayerId < playerId) {
        void createPeer(playerId, true);
      }
    };

    /*
     * Sent by server immediately after voice:join.
     *
     * This is the important fix for:
     * "I joined voice but existing players don't connect."
     */
    const onExistingPeers = ({
      playerIds,
    }: {
      playerIds: string[];
    }) => {
      if (!joinedRef.current) return;

      for (const playerId of playerIds) {
        if (!playerId || playerId === myPlayerId) continue;

        /*
         * Same deterministic rule.
         *
         * If my ID is smaller, I create the offer.
         * Otherwise I wait for the existing peer to offer me.
         */
        if (myPlayerId < playerId) {
          void createPeer(playerId, true);
        }
      }
    };

    const onOffer = async ({
      fromId,
      description,
    }: SignalPayload) => {
      if (!joinedRef.current) return;
      if (!description) return;
      if (fromId === myPlayerId) return;

      try {
        const peer = await createPeer(fromId, false);

        if (!peer) return;

        await peer.setRemoteDescription(description);

        await flushCandidates(fromId, peer);

        const answer = await peer.createAnswer();

        await peer.setLocalDescription(answer);

        if (!joinedRef.current) return;

        socket.emit('voice:answer', {
          targetId: fromId,
          description: peer.localDescription,
        });
      } catch (cause) {
        console.error('Voice offer handling error:', cause);
      }
    };

    const onAnswer = async ({
      fromId,
      description,
    }: SignalPayload) => {
      if (!description) return;

      const peer = peersRef.current.get(fromId);

      if (!peer) return;

      if (peer.signalingState !== 'have-local-offer') {
        return;
      }

      try {
        await peer.setRemoteDescription(description);

        await flushCandidates(fromId, peer);
      } catch (cause) {
        console.error('Voice answer handling error:', cause);
      }
    };

    const onCandidate = async ({
      fromId,
      candidate,
    }: SignalPayload) => {
      if (!candidate) return;

      const peer = peersRef.current.get(fromId);

      /*
       * ICE candidate may arrive before the remote description.
       * Queue it until setRemoteDescription() is complete.
       */
      if (!peer || !peer.remoteDescription) {
        const queue =
          pendingCandidatesRef.current.get(fromId) || [];

        queue.push(candidate);

        pendingCandidatesRef.current.set(
          fromId,
          queue.slice(-30),
        );

        return;
      }

      try {
        await peer.addIceCandidate(candidate);
      } catch {
        // Ignore stale ICE candidates.
      }
    };

    const onPeerLeft = ({
      playerId,
    }: {
      playerId: string;
    }) => {
      closePeer(playerId);
    };

    const onMute = ({
      playerId,
      muted: nextMuted,
    }: {
      playerId: string;
      muted: boolean;
    }) => {
      setMutedPeers((prev) => ({
        ...prev,
        [playerId]: nextMuted,
      }));
    };

    socket.on('voice:peer-joined', onPeerJoined);
    socket.on('voice:peers', onExistingPeers);
    socket.on('voice:offer', onOffer);
    socket.on('voice:answer', onAnswer);
    socket.on('voice:ice-candidate', onCandidate);
    socket.on('voice:peer-left', onPeerLeft);
    socket.on('voice:mute', onMute);

    return () => {
      socket.off('voice:peer-joined', onPeerJoined);
      socket.off('voice:peers', onExistingPeers);
      socket.off('voice:offer', onOffer);
      socket.off('voice:answer', onAnswer);
      socket.off('voice:ice-candidate', onCandidate);
      socket.off('voice:peer-left', onPeerLeft);
      socket.off('voice:mute', onMute);
    };
  }, [myPlayerId, socket]);

  /*
   * Safety net:
   * If someone was already in the room before we joined voice,
   * connect to them after our microphone stream becomes available.
   */
  useEffect(() => {
    if (!joinedRef.current) return;
    if (!localStreamRef.current) return;

    for (const player of humans) {
      if (myPlayerId < player.id) {
        void createPeer(player.id, true);
      }
    }
  }, [humans, myPlayerId, joined]);

  useEffect(() => {
    audioElsRef.current.forEach((audio) => {
      audio.muted = deafened;
    });
  }, [deafened]);

  /*
   * Keep joinedRef synchronized with React state.
   */
  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  /*
   * Component cleanup.
   */
  useEffect(() => {
    return () => {
      joinedRef.current = false;

      closeAllPeers();

      localStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      localStreamRef.current = null;

      socket.emit('voice:leave');
    };
  }, [socket]);

  const joinVoice = async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Microphone access is not supported in this browser.',
      );
      return;
    }

    if (joinedRef.current) {
      setOpen(true);
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

      localStreamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      setMuted(false);

      /*
       * Set ref BEFORE emitting voice:join.
       *
       * This is important because the server can immediately
       * send voice:peers after receiving voice:join.
       */
      joinedRef.current = true;

      setJoined(true);
      setOpen(true);

      socket.emit('voice:join');

      /*
       * Also proactively connect to currently visible humans.
       * The server handshake remains the primary mechanism.
       */
      for (const player of humans) {
        if (myPlayerId < player.id) {
          void createPeer(player.id, true);
        }
      }
    } catch (cause) {
      console.error('Microphone error:', cause);

      joinedRef.current = false;
      setJoined(false);

      setError(
        'Microphone permission was denied or no microphone is available.',
      );
    }
  };

  const leaveVoice = () => {
    joinedRef.current = false;

    socket.emit('voice:leave');

    closeAllPeers();

    localStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    localStreamRef.current = null;

    setJoined(false);
    setMuted(false);
    setDeafened(false);
    setError(null);
  };

  const toggleMute = () => {
    const nextMuted = !muted;

    localStreamRef.current
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = !nextMuted;
      });

    setMuted(nextMuted);

    socket.emit('voice:mute', {
      muted: nextMuted,
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`social-fab social-fab--voice ${
          joined ? 'is-live' : ''
        }`}
        aria-label={
          open
            ? 'Close voice controls'
            : joined
              ? 'Open voice controls'
              : 'Open voice chat'
        }
        title={
          open
            ? 'Close voice controls'
            : joined
              ? 'Voice controls'
              : 'Open voice chat'
        }
      >
        {open ? (
          <X className="w-[18px] h-[18px] text-emerald-200" />
        ) : (
          <Phone
            className={`w-[18px] h-[18px] ${
              joined
                ? 'text-emerald-300'
                : 'text-slate-300'
            }`}
          />
        )}

        {joined && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#080B14]" />
        )}
      </button>

      {open && (
        <div className="social-panel social-panel--voice animate-fade-in">
          <div className="social-panel__header">
            <div>
              <div className="font-royal font-bold text-emerald-300 tracking-wide text-sm">
                ROYAL VOICE
              </div>

              <div className="text-[10px] text-slate-500">
                Talk while you play
              </div>
            </div>

            <div className="social-panel__icon social-panel__icon--voice">
              <Phone className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div className="social-panel__voice-body">
            {!joined ? (
              <>
                <button
                  type="button"
                  onClick={joinVoice}
                  className="w-full px-3 py-2.5 rounded-xl bg-emerald-500/12 border border-emerald-400/30 text-emerald-200 text-xs font-bold hover:bg-emerald-500/18 transition flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  JOIN VOICE
                </button>

                <p className="text-[10px] leading-relaxed text-slate-500">
                  Your microphone stays off until you press Join Voice.
                </p>
              </>
            ) : (
              <>
                <div className="space-y-1.5 max-h-36 overflow-y-auto overscroll-contain">
                  <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="text-base">👑</span>
                      You
                    </span>

                    {muted ? (
                      <MicOff className="w-3.5 h-3.5 text-rose-300" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-emerald-300" />
                    )}
                  </div>

                  {humans.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-900/55 border border-slate-800/80 text-xs"
                    >
                      <span className="truncate pr-2">
                        {player.avatar} {player.name}
                      </span>

                      <span className="flex items-center gap-1.5 text-[10px]">
                        {mutedPeers[player.id] ? (
                          <MicOff className="w-3 h-3 text-slate-500" />
                        ) : (
                          <Mic className="w-3 h-3 text-emerald-300" />
                        )}

                        <span
                          className={
                            remoteIds.includes(player.id)
                              ? 'text-emerald-300'
                              : 'text-slate-600'
                          }
                        >
                          {remoteIds.includes(player.id)
                            ? 'LIVE'
                            : 'WAIT'}
                        </span>
                      </span>
                    </div>
                  ))}

                  {humans.length === 0 && (
                    <div className="text-[10px] text-slate-500 text-center py-2">
                      No other connected human players.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`h-10 rounded-xl border flex items-center justify-center transition ${
                      muted
                        ? 'bg-rose-500/10 border-rose-500/25'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                    aria-label={
                      muted
                        ? 'Unmute microphone'
                        : 'Mute microphone'
                    }
                    title={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? (
                      <MicOff className="w-4 h-4 text-rose-300" />
                    ) : (
                      <Mic className="w-4 h-4 text-emerald-300" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDeafened((value) => !value)
                    }
                    className={`h-10 rounded-xl border flex items-center justify-center transition ${
                      deafened
                        ? 'bg-rose-500/10 border-rose-500/25'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                    aria-label={
                      deafened
                        ? 'Enable remote audio'
                        : 'Deafen'
                    }
                    title={
                      deafened
                        ? 'Enable audio'
                        : 'Deafen'
                    }
                  >
                    {deafened ? (
                      <VolumeX className="w-4 h-4 text-rose-300" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-sky-300" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={leaveVoice}
                    className="h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center"
                    aria-label="Leave voice"
                    title="Leave voice"
                  >
                    <PhoneOff className="w-4 h-4 text-rose-300" />
                  </button>
                </div>
              </>
            )}

            {error && (
              <div className="text-[10px] leading-relaxed text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-2.5 py-2">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
