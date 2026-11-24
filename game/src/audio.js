// ZENITH — audio. Everything is synthesized with WebAudio: engine hum,
// gunshots, sirens, and three procedural radio stations (no audio assets).
import { CONFIG, RADIO } from './config.js';

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.station = 0;
    this.radioOn = false;
    this.radioTimer = 0;
    this.radioStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch (_e) {
      this.ctx = null;
    }
  }

  stationName() {
    return RADIO[this.station].name;
  }

  nextStation() {
    this.station = (this.station + 1) % RADIO.length;
    this.radioStep = 0;
    return this.stationName();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // Short filtered noise burst: gunshot.
  gunshot() {
    if (!this.ctx) return;
    const dur = 0.16;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  // Two-tone police siren, toggled.
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 750;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.06;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.7;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    } else if (!on && this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo.stop();
      } catch (_e) {}
      this.sirenOsc = null;
      this.sirenLfo = null;
      this.sirenGain = null;
    }
  }

  // Engine: a sawtooth whose pitch follows speed; started on demand.
  engine(speed01) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.09, this.ctx.currentTime, 0.1);
  }

  engineOff() {
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  // Little blip for pickups and UI clicks.
  blip(freq) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq || 660;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + 0.2);
  }

  // Mission-complete jingle: four rising notes.
  jingle() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const t = this.ctx.currentTime + i * 0.13;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.32);
    });
  }

  // Radio sequencer: one note per step, bass on the beat, hi-hat ticks.
  update(dt, driving) {
    if (!this.ctx || this.muted) return;
    const st = RADIO[this.station];
    const stepDur = 60 / st.bpm / 2;
    this.radioTimer += dt * (driving ? 1 : 0.7);
    while (this.radioTimer >= stepDur) {
      this.radioTimer -= stepDur;
      const step = this.radioStep++;
      const scale = st.scale;
      // Bass on steps 0 and 4, melody wandering on the rest.
      const isBeat = step % 8 === 0 || step % 8 === 4;
      const note = isBeat
        ? st.root - 12
        : st.root + scale[(step * 5 + 3) % scale.length] + (step % 16 === 14 ? 12 : 0);
      const o = this.ctx.createOscillator();
      o.type = isBeat ? 'triangle' : 'square';
      o.frequency.value = midiToFreq(note);
      const g = this.ctx.createGain();
      const vol = isBeat ? 0.16 : 0.05;
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + stepDur * 1.8);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + stepDur * 2);
    }
  }
}
