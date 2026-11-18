// SOLMAR BAY — audio.js
// One job: every sound in the game, synthesised live with WebAudio. No audio
// files, no network: oscillators and filtered noise, built from scratch.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenTimer = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture (or never, in headless shot mode).
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

  get ready() { return !!this.ctx; }

  _noiseBuffer(seconds = 1) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _blip(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shot() { this._noise(0.16, 0.5, 1800, 'highpass'); this._blip(160, 0.1, 'square', 0.25, 60); }
  dryClick() { this._blip(1200, 0.05, 'square', 0.12); }
  reload() { this._blip(500, 0.06, 'square', 0.15); setTimeout(() => this._blip(700, 0.06, 'square', 0.15), 120); }
  chime() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._blip(f, 0.22, 'sine', 0.22), i * 90)); }
  cash() { [880, 1174, 1568].forEach((f, i) => setTimeout(() => this._blip(f, 0.16, 'triangle', 0.2), i * 70)); }
  thud() { this._noise(0.12, 0.4, 300); this._blip(90, 0.12, 'sine', 0.3, 45); }
  crash() { this._noise(0.35, 0.55, 500); this._blip(70, 0.3, 'sine', 0.35, 35); }
  door() { this._noise(0.08, 0.25, 900); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this._blip(f, 0.35, 'sawtooth', 0.16), i * 220)); }
  missionStart() { [262, 392, 523].forEach((f, i) => setTimeout(() => this._blip(f, 0.2, 'triangle', 0.2), i * 100)); }

  // Engine hum: one sawtooth through a low-pass, pitch follows speed.
  engineStart() {
    if (!this.ready || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  engineSet(speed01, on) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(350 + speed01 * 1400, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0.0, t, 0.1);
  }

  engineStop() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
    this.engineOsc = null;
  }

  // Two-tone police siren while any police car is near.
  sirenStart() {
    if (!this.ready || this.sirenTimer) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.045;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
    let hi = false;
    this.sirenTimer = setInterval(() => {
      if (!this.sirenOsc) return;
      hi = !hi;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 660, this.ctx.currentTime, 0.05);
    }, 420);
  }

  sirenStop() {
    if (this.sirenTimer) { clearInterval(this.sirenTimer); this.sirenTimer = null; }
    if (this.sirenOsc) { try { this.sirenOsc.stop(); } catch (e) { /* noop */ } this.sirenOsc = null; }
  }

  // Radio: a lazy synthwave loop — minor-key bass, soft pad, hat ticks.
  // Bassline in A minor, 96 BPM, 16 steps a bar, 2 bars looping.
  musicStart() {
    if (!this.ready || this.musicTimer || !this.musicOn) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0,
                  55, 0, 55, 0, 65.4, 0, 55, 0, 82.4, 0, 73.4, 0, 65.4, 0, 58.3, 0];
    const stepDur = 60 / 96 / 4;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const f = bass[this.musicStep % bass.length];
      if (f) this._blip(f, stepDur * 0.95, 'triangle', 0.16);
      if (this.musicStep % 4 === 2) this._noise(0.03, 0.05, 6000, 'highpass');
      if (this.musicStep % 32 === 0) this._blip(220, 1.6, 'sine', 0.05);
      if (this.musicStep % 32 === 16) this._blip(261.6, 1.6, 'sine', 0.05);
      this.musicStep++;
    }, stepDur * 1000);
  }

  musicStop() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.musicStart();
    else this.musicStop();
    return this.musicOn;
  }
}
