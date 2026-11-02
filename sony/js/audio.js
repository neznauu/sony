/* ═══════════════════════════════════════════
   AUDIO — фоновая музыка и короткие Web Audio эффекты.
   ═══════════════════════════════════════════ */

const AudioEngine = {
  ctx: null,
  master: null,
  music: null,
  initialized: false,

  init () {
    if (this.initialized) return true;

    this.music = new Audio(CONFIG.BACKGROUND_MUSIC);
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = Math.max(0, Math.min(1, CONFIG.BACKGROUND_MUSIC_VOLUME));
    this.music.addEventListener('error', () => {
      console.error('Background music failed to load:', CONFIG.BACKGROUND_MUSIC);
    });

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.42;
        this.master.connect(this.ctx.destination);
      } else {
        console.warn('Web Audio API unavailable; sound effects are disabled.');
      }
    } catch (e) {
      console.warn('Sound effects unavailable:', e);
    }

    this.initialized = true;
    return true;
  },

  resume () {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.music && this.music.paused) {
      const playback = this.music.play();
      if (playback && playback.catch) {
        playback.catch(error => console.warn('Background music could not start:', error));
      }
    }
  },

  crossfadeTo () {
    if (!this.init()) return;
    this.resume();
  },

  playTouch () {
    if (!this.ctx || !this.master) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(86, t);
    o.frequency.exponentialRampToValueAtTime(64, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.24);
  },

  playJumpBlip () {
    if (!this.ctx || !this.master) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(196, t);
    o.frequency.linearRampToValueAtTime(392, t + 0.075);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.028, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.11);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.13);
  },

  playLanding () {
    if (!this.ctx || !this.master) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(82, t + 0.14);
    const g = c.createGain();
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.18);
  },

  playStarChime () {
    if (!this.ctx || !this.master) return;
    const c = this.ctx, t = c.currentTime;
    [1046.5, 1568].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = c.createGain();
      const at = t + i * 0.09;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.022, at + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
      o.connect(g); g.connect(this.master);
      o.start(at); o.stop(at + 1.15);
    });
  },

  playPaperRustle () {
    if (!this.ctx || !this.master) return;
    this._rustle(this.master, 0.09);
  },

  stopAll () {
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
    }
  },

  _noise (dur) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.max(1, Math.floor(sr * dur)), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  _rustle (dest, level) {
    const c = this.ctx, t = c.currentTime;
    const ns = c.createBufferSource();
    ns.buffer = this._noise(0.8);
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.55;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.linearRampToValueAtTime(5200, t + 0.22);
    f.frequency.linearRampToValueAtTime(2800, t + 0.6);
    const g = c.createGain();
    const peak = level || 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.04);
    g.gain.linearRampToValueAtTime(peak * 0.55, t + 0.18);
    g.gain.linearRampToValueAtTime(peak * 0.8, t + 0.28);
    g.gain.linearRampToValueAtTime(0, t + 0.62);
    ns.connect(f); f.connect(g); g.connect(dest);
    ns.start(t); ns.stop(t + 0.65);
  }
};
