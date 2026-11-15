/* ============================================================
   audio.js — tiny WebAudio SFX engine (no external files)
   ============================================================ */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.6;
    this.failed = false;
  }

  init() {
    if (this.ctx || this.failed) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        this.failed = true;
        return;
      }
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.failed = true;
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.5 : 0, this.ctx.currentTime, 0.02);
    }
    if (this.enabled) this.resume();
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.5 : 0, this.ctx.currentTime, 0.02);
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _tone({ freq = 440, type = 'square', dur = 0.06, gain = 0.25, slideTo = null, delay = 0, attack = 0.004 }) {
    if (!this.enabled || this.failed) return;
    this.init();
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + dur);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  click() {
    // crisp Minecraft-ish inventory tick
    this._tone({ freq: 620 + Math.random() * 90, type: 'square', dur: 0.035, gain: 0.16, slideTo: 420 });
  }

  switchSlot(speedFactor = 1) {
    this._tone({ freq: 480 + speedFactor * 120, type: 'triangle', dur: 0.03, gain: 0.1, slideTo: 700 });
  }

  success(streak = 0) {
    const base = 660 + Math.min(10, streak) * 26;
    this._tone({ freq: base, type: 'square', dur: 0.05, gain: 0.11 });
    this._tone({ freq: base * 1.5, type: 'square', dur: 0.07, gain: 0.09, delay: 0.045 });
  }

  error() {
    this._tone({ freq: 190, type: 'sawtooth', dur: 0.13, gain: 0.16, slideTo: 90 });
    this._tone({ freq: 96, type: 'square', dur: 0.1, gain: 0.07, slideTo: 60, delay: 0.01 });
  }

  miss() {
    this._tone({ freq: 260, type: 'triangle', dur: 0.16, gain: 0.12, slideTo: 120 });
  }

  levelUp() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this._tone({ freq: f, type: 'square', dur: 0.09, gain: 0.1, delay: i * 0.065 }));
  }

  roundClear() {
    [440, 554.37, 659.25, 880].forEach((f, i) =>
      this._tone({ freq: f, type: 'triangle', dur: 0.14, gain: 0.11, delay: i * 0.075 }),
    );
  }

  start() {
    this._tone({ freq: 392, type: 'triangle', dur: 0.1, gain: 0.12 });
    this._tone({ freq: 587.33, type: 'triangle', dur: 0.14, gain: 0.1, delay: 0.09 });
  }

  finish() {
    [659.25, 523.25, 392].forEach((f, i) =>
      this._tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.11, delay: i * 0.1 }),
    );
  }

  cue() {
    this._tone({ freq: 880, type: 'sine', dur: 0.04, gain: 0.045 });
  }

  ui() {
    this._tone({ freq: 340, type: 'triangle', dur: 0.03, gain: 0.05, slideTo: 460 });
  }
}

export const audio = new AudioEngine();
