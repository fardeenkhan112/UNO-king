// Audio synthesizer using Web Audio API for rich, zero-asset game audio

class SoundManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    return this.soundEnabled;
  }

  private getContext(): AudioContext | null {
    if (!this.soundEnabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Tactile button click
  public playClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  // Smooth card play swoosh + snap
  public playCardPlay() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Filtered noise swoosh
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Subtle low thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    oscGain.gain.setValueAtTime(0.15, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Card draw sound
  public playCardDraw() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.09);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Royal action card (Wild, +4, Reverse, Skip)
  public playAction() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5 royal arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.18, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.25);
    });
  }

  // Royal UNO King Call (Fanfare + energetic Ta-Da)
  public playUnoCall() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // High energy fanfare chord
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + 0.5);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    });

    // Funny celebratory whistle squeak
    const squeak = ctx.createOscillator();
    const squeakGain = ctx.createGain();
    squeak.type = 'sine';
    squeak.frequency.setValueAtTime(800, now + 0.15);
    squeak.frequency.exponentialRampToValueAtTime(1600, now + 0.35);
    squeakGain.gain.setValueAtTime(0.12, now + 0.15);
    squeakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    squeak.connect(squeakGain);
    squeakGain.connect(ctx.destination);
    squeak.start(now + 0.15);
    squeak.stop(now + 0.46);
  }

  // Alias for backward compatibility
  public playUnuCall() {
    this.playUnoCall();
  }

  // Tactile 3D card flip sound (crisp whoosh & paper air snap)
  public playFlip() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Air swoosh
    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Tactile flick tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now + 0.01);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);
    oscGain.gain.setValueAtTime(0.12, now + 0.01);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now + 0.01);
    osc.stop(now + 0.08);
  }

  // Comical Cartoon Boing sound (for +2, +4, skip or reverse)
  public playBoing() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frequency ramp with cartoon spring wobble
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.32);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.42);
  }

  // Funny Cartoon Pop sound (for button clicks, color picks)
  public playPop() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.06);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  // Funny Slide Whistle (comical descending fail/penalty sound)
  public playSlideWhistle() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.45);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playTick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  // Grand Victory Chime
  public playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const chords = [
      { notes: [392.00, 493.88, 587.33], start: 0, dur: 0.25 }, // G
      { notes: [440.00, 554.37, 659.25], start: 0.22, dur: 0.25 }, // A
      { notes: [523.25, 659.25, 783.99, 1046.50], start: 0.44, dur: 0.8 }, // C High
    ];

    chords.forEach(({ notes, start, dur }) => {
      notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + start;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + dur + 0.05);
      });
    });
  }
}

export const sound = new SoundManager();
