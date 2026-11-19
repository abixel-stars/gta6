// Synthesized sound and music for Solmar. Everything is WebAudio: no audio
// files, no network. All nodes are created lazily on first user gesture.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.volume = 0.7;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      // Engine hum: sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Police siren: two alternating tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) {
      this.ctx = null;
      return false;
    }
    return true;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx) return;
    const target = driving ? 0.05 + speedNorm * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(
      55 + speedNorm * 165,
      this.ctx.currentTime,
      0.08
    );
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.2);
  }

  update(dt) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenTimer += dt;
    if (this.sirenGain.gain.value > 0.01) {
      const phase = Math.floor(this.sirenTimer / 0.45) % 2;
      this.sirenOsc.frequency.setTargetAtTime(
        phase === 0 ? 720 : 960,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1800;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.4;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
  }

  gunshot() {
    this.noiseBurst(0.14, 0.5, 2600);
    this.blip(140, 0.1, 'square', 0.2);
  }

  punch() {
    this.noiseBurst(0.09, 0.35, 500);
    this.blip(90, 0.12, 'sine', 0.3);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.22);
    setTimeout(() => this.blip(880, 0.12, 'sine', 0.22), 80);
  }

  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.25), i * 110));
  }

  busted() {
    this.blip(220, 0.5, 'sawtooth', 0.2);
    setTimeout(() => this.blip(165, 0.7, 'sawtooth', 0.2), 200);
  }

  carDoor() {
    this.noiseBurst(0.08, 0.25, 900);
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // Warm pad loop: Am - F - C - G, one chord per bar, soft triangle voices.
    const chords = [
      [220, 261.6, 329.6],
      [174.6, 220, 261.6],
      [196, 261.6, 329.6],
      [196, 246.9, 293.7],
    ];
    const barMs = 2400;
    const playBar = () => {
      if (!this.ctx) return;
      const chord = chords[this.musicStep % chords.length];
      this.musicStep++;
      const t = this.ctx.currentTime;
      chord.forEach((f) => {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.4);
        g.gain.setValueAtTime(0.12, t + barMs / 1000 - 0.5);
        g.gain.linearRampToValueAtTime(0.0001, t + barMs / 1000);
        o.connect(g);
        g.connect(this.musicGain);
        o.start(t);
        o.stop(t + barMs / 1000 + 0.05);
      });
      // Soft bass pulse on each beat.
      for (let b = 0; b < 4; b++) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = chord[0] / 2;
        const g = this.ctx.createGain();
        const bt = t + (b * barMs) / 4000;
        g.gain.setValueAtTime(0.0001, bt);
        g.gain.linearRampToValueAtTime(0.16, bt + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, bt + 0.5);
        o.connect(g);
        g.connect(this.musicGain);
        o.start(bt);
        o.stop(bt + 0.55);
      }
    };
    playBar();
    this.musicTimer = setInterval(playBar, barMs);
  }
}
