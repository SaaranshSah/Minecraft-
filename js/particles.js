/* ============================================================
   particles.js — lightweight pixel particle field (canvas 2D)
   ============================================================ */

const MAX_PARTICLES = 420;

export class ParticleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.enabled = true;
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.raf = 0;
    this._last = 0;
    this._tick = this._tick.bind(this);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) this.clear();
  }

  clear() {
    this.particles.length = 0;
    this.ctx.clearRect(0, 0, this.w, this.h);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _spawn(x, y, opts) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const {
      count = 14,
      colors = ['#8ee05a', '#57b32d', '#ffd94a'],
      speed = 230,
      size = 4,
      gravity = 900,
      life = 0.7,
      spread = Math.PI * 2,
      angle = -Math.PI / 2,
    } = opts || {};
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.45 + Math.random() * 0.85);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: size * (0.6 + Math.random() * 0.9),
        color: colors[(Math.random() * colors.length) | 0],
        life: life * (0.65 + Math.random() * 0.7),
        age: 0,
        gravity,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
      });
    }
    this._start();
  }

  burst(x, y, opts) {
    if (!this.enabled) return;
    this._spawn(x, y, { count: 16, ...opts });
  }

  success(x, y) {
    this.burst(x, y, {
      count: 15,
      colors: ['#c9f5ab', '#8ee05a', '#57b32d', '#ffe9a3'],
      speed: 260,
      size: 4,
      life: 0.65,
      spread: Math.PI * 1.5,
    });
  }

  wrong(x, y) {
    if (!this.enabled) return;
    this.burst(x, y, {
      count: 9,
      colors: ['#ff5f4f', '#b83026', '#ffb3aa'],
      speed: 170,
      size: 3,
      life: 0.45,
      spread: Math.PI * 1.7,
    });
  }

  celebrate() {
    if (!this.enabled) return;
    const colors = ['#8ee05a', '#57b32d', '#ffd94a', '#4ae3d4', '#c9f5ab'];
    for (let i = 0; i < 3; i++) {
      this._spawn(this.w * (0.25 + Math.random() * 0.5), this.h * 0.55, {
        count: 18,
        colors,
        speed: 420,
        size: 5,
        life: 1.1,
        spread: Math.PI * 0.9,
        angle: -Math.PI / 2,
        gravity: 720,
      });
    }
  }

  rain() {
    if (!this.enabled) return;
    for (let i = 0; i < 26; i++) {
      this.particles.push({
        x: Math.random() * this.w,
        y: -12 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 70,
        vy: 120 + Math.random() * 180,
        size: 3 + Math.random() * 4,
        color: ['#8ee05a', '#ffd94a', '#4ae3d4', '#c9f5ab'][(Math.random() * 4) | 0],
        life: 1.6,
        age: 0,
        gravity: 240,
        rot: Math.random() * 3,
        vr: (Math.random() - 0.5) * 6,
      });
    }
    this._start();
  }

  _start() {
    if (this.raf) return;
    this._last = performance.now();
    this.raf = requestAnimationFrame(this._tick);
  }

  _tick(now) {
    this.raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - this._last) / 1000));
    this._last = now;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const t = p.age / p.life;
      ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
      ctx.fillStyle = p.color;
      const s = p.size * (1 - t * 0.35);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (this.particles.length) {
      this.raf = requestAnimationFrame(this._tick);
    } else {
      ctx.clearRect(0, 0, this.w, this.h);
    }
  }
}
