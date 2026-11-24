// ZENITH — audio.js (round 3 redo)
// Every sound is synthesised live with WebAudio — no files, no network.
// Short effects are one-shot oscillators and filtered noise; the engine
// is a pair of detuned oscillators whose pitch and brightness follow the
// speed; the siren is a triangle wave swept by an LFO, and its loudness
// now follows how close the nearest cruiser is; the radio is a
// step-sequenced bassline with hats and a soft pad.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.noiseCache = null;
  }

  // AudioContext needs a user gesture; call from a click/key handler.
  init() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  }

  get ready() {
    return !!this.ctx;
  }

  // One shared second of white noise, reused by every noise effect.
  noiseBank() {
    if (!this.noiseCache) {
      const len = this.ctx.sampleRate;
      this.noiseCache = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseCache.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseCache;
  }

  note(freq, dur, { type = 'sine', vol = 0.2, slideTo = 0, delay = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  hiss(dur, { vol = 0.3, cutoff = 1000, kind = 'lowpass', delay = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBank();
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = kind;
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // A little arpeggio helper for the musical stingers.
  riff(freqs, { type = 'sine', vol = 0.2, step = 0.09, dur = 0.22 } = {}) {
    freqs.forEach((f, i) => this.note(f, dur, { type, vol, delay: i * step }));
  }

  shot() {
    this.hiss(0.16, { vol: 0.5, cutoff: 1800, kind: 'highpass' });
    this.note(160, 0.1, { type: 'square', vol: 0.25, slideTo: 60 });
  }
  dryClick() {
    this.note(1200, 0.05, { type: 'square', vol: 0.12 });
  }
  reload() {
    this.note(500, 0.06, { type: 'square', vol: 0.15 });
    this.note(700, 0.06, { type: 'square', vol: 0.15, delay: 0.12 });
  }
  chime() {
    this.riff([523, 659, 784], { type: 'sine', vol: 0.22 });
  }
  cash() {
    this.riff([880, 1174, 1568], { type: 'triangle', vol: 0.2, step: 0.07, dur: 0.16 });
  }
  thud() {
    this.hiss(0.12, { vol: 0.4, cutoff: 300 });
    this.note(90, 0.12, { vol: 0.3, slideTo: 45 });
  }
  crash() {
    this.hiss(0.35, { vol: 0.55, cutoff: 500 });
    this.note(70, 0.3, { vol: 0.35, slideTo: 35 });
  }
  door() {
    this.hiss(0.08, { vol: 0.25, cutoff: 900 });
  }
  // A two-tone car horn: two squares a minor third apart, short and rude.
  horn() {
    this.note(392, 0.28, { type: 'square', vol: 0.18 });
    this.note(494, 0.28, { type: 'square', vol: 0.14 });
  }
  busted() {
    this.riff([392, 330, 262], { type: 'sawtooth', vol: 0.16, step: 0.22, dur: 0.35 });
  }
  missionStart() {
    this.riff([262, 392, 523], { type: 'triangle', vol: 0.2, step: 0.1, dur: 0.2 });
  }
  // Two sharp beeps for the low-time warning on timed jobs.
  beep() {
    this.note(980, 0.09, { type: 'square', vol: 0.16 });
    this.note(980, 0.09, { type: 'square', vol: 0.16, delay: 0.14 });
  }

  // Engine: a sawtooth plus a square sub-oscillator an octave down,
  // both through one low-pass whose cutoff opens with speed.
  engineStart() {
    if (!this.ready || this.engineNodes) return;
    const saw = this.ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 55;
    const sub = this.ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 27.5;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    saw.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(this.master);
    saw.start();
    sub.start();
    this.engineNodes = { saw, sub, filter, gain };
  }

  engineSet(speed01, on) {
    if (!this.engineNodes) return;
    const t = this.ctx.currentTime;
    const { saw, sub, filter, gain } = this.engineNodes;
    const base = 50 + speed01 * 130;
    saw.frequency.setTargetAtTime(base, t, 0.08);
    sub.frequency.setTargetAtTime(base / 2, t, 0.08);
    filter.frequency.setTargetAtTime(350 + speed01 * 1400, t, 0.08);
    gain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
  }

  engineStop() {
    if (!this.engineNodes) return;
    for (const osc of [this.engineNodes.saw, this.engineNodes.sub]) {
      try {
        osc.stop();
      } catch (e) {
        /* already stopped */
      }
    }
    this.engineNodes = null;
  }

  // Siren: one triangle oscillator, its frequency wobbled by a square
  // LFO between the two classic tones — no timers involved. The gain
  // node is kept so sirenSet() can ride the volume with distance.
  sirenStart() {
    if (!this.ready || this.sirenNodes) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 770;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 1.2;
    const depth = this.ctx.createGain();
    depth.gain.value = 110;
    lfo.connect(depth).connect(osc.frequency);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    osc.connect(gain).connect(this.master);
    osc.start();
    lfo.start();
    this.sirenNodes = { osc, lfo, gain };
  }

  // `dist` is the distance to the nearest cruiser in metres: loud up
  // close, a whisper past ~120 m.
  sirenSet(dist) {
    if (!this.sirenNodes) return;
    const d = Number.isFinite(dist) ? dist : 120;
    const vol = Math.max(0.012, 0.06 - (Math.min(d, 120) / 120) * 0.048);
    this.sirenNodes.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2);
  }

  sirenStop() {
    if (!this.sirenNodes) return;
    for (const osc of [this.sirenNodes.osc, this.sirenNodes.lfo]) {
      try {
        osc.stop();
      } catch (e) {
        /* noop */
      }
    }
    this.sirenNodes = null;
  }

  // SUMMIT FM: a D-minor bassline at 102 BPM, 32 steps, with off-beat
  // hats and a two-chord pad underneath.
  musicStart() {
    if (!this.ready || this.musicTimer || !this.musicOn) return;
    const bass = [
      73.4, 0, 0, 73.4, 0, 0, 87.3, 0, 73.4, 0, 0, 73.4, 98, 0, 87.3, 0,
      65.4, 0, 0, 65.4, 0, 0, 73.4, 0, 87.3, 0, 98, 0, 110, 0, 98, 0,
    ];
    const stepDur = 60 / 102 / 4;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const step = this.musicStep % bass.length;
      const f = bass[step];
      if (f) this.note(f, stepDur * 0.95, { type: 'triangle', vol: 0.16 });
      if (step % 4 === 2) this.hiss(0.03, { vol: 0.05, cutoff: 6000, kind: 'highpass' });
      if (step === 0) this.note(146.8, 1.6, { vol: 0.05 });
      if (step === 16) this.note(174.6, 1.6, { vol: 0.05 });
      this.musicStep++;
    }, stepDur * 1000);
  }

  musicStop() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.musicStart();
    else this.musicStop();
    return this.musicOn;
  }
}
