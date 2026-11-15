/* ============================================================
   engine.js — practice session logic
   Modes: freestyle · training · tenhearts · custom
   All scheduling happens inside one rAF loop in an
   "elapsed session time" domain so pausing is exact.
   ============================================================ */

import { DIFFICULTIES, MIN_WINDOW } from './data.js';

const SEQ_GAP = { easy: 480, normal: 380, hard: 280, veryhard: 210, extreme: 150 };
const MAX_LEVEL = 30;

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export class Trainer {
  /**
   * @param {object} config
   * @param {'freestyle'|'training'|'tenhearts'|'custom'} config.mode
   * @param {object} config.difficulty   key of DIFFICULTIES (training)
   * @param {object} config.custom       custom practice config
   * @param {object} config.freestyle    freestyle config
   * @param {object} config.tenhearts    ten-heart config
   */
  constructor(config = {}, callbacks = {}) {
    this.config = {
      mode: config.mode || 'freestyle',
      difficulty: config.difficulty || 'normal',
      custom: config.custom || {},
      freestyle: config.freestyle || {},
      tenhearts: config.tenhearts || {},
    };
    this.cb = callbacks;

    this.difficulty = DIFFICULTIES[this.config.difficulty] || DIFFICULTIES.normal;
    this.noTimer = this.config.mode === 'tenhearts';
    this.usesSequence = this._resolveUsesSequence();
    this.challenge = this._resolveChallenge();

    this.activeSlots = this._resolveActiveSlots();
    this.baseWindow = this._resolveBaseWindow();
    this.baseLength = this._resolveBaseLength();
    this.baseGap = this._resolveBaseGap();
    this.pool = this._resolvePool();
    this.ramp = this._resolveRamp();

    this.running = false;
    this.paused = false;
    this.startTime = 0;
    this.pausedTotal = 0;
    this.pausedAt = 0;
    this.raf = 0;

    this.resetCounters();
  }

  /* ---------------- config resolution ---------------- */

  _resolveUsesSequence() {
    const m = this.config.mode;
    if (m === 'training') return true;
    if (m === 'custom') return this.config.custom.mode !== 'freestyle';
    return false;
  }

  _resolveChallenge() {
    const m = this.config.mode;
    if (m === 'freestyle') return !!this.config.freestyle.challenge;
    if (m === 'tenhearts') return this.config.tenhearts.challenge !== false;
    if (m === 'custom') return this.config.custom.mode === 'freestyle' ? this.config.custom.challenge !== false : true;
    return true;
  }

  _resolveActiveSlots() {
    if (this.config.mode === 'custom') {
      const slots = (this.config.custom.slots || []).filter((n) => n >= 0 && n < 9);
      if (slots.length >= 2) return [...new Set(slots)].sort((a, b) => a - b);
    }
    return [0, 1, 2, 3, 4, 5, 6, 7, 8];
  }

  _resolveBaseWindow() {
    const m = this.config.mode;
    if (m === 'training') return this.difficulty.window;
    if (m === 'custom') {
      return this.config.custom.mode === 'freestyle'
        ? Math.min(4000, Math.max(MIN_WINDOW, this.config.custom.lifetime || 2000))
        : Math.min(4000, Math.max(MIN_WINDOW, this.config.custom.window || 1300));
    }
    if (m === 'tenhearts') return Infinity;
    return Math.min(5000, Math.max(900, this.config.freestyle.lifetime || 2200));
  }

  _resolveBaseLength() {
    if (this.config.mode === 'custom') return Math.min(12, Math.max(1, this.config.custom.length || 3));
    if (this.config.mode === 'training') return this.difficulty.length;
    return 1;
  }

  _resolveBaseGap() {
    if (this.config.mode === 'custom') return Math.min(1200, Math.max(0, this.config.custom.gap ?? 320));
    if (this.config.mode === 'training') return SEQ_GAP[this.config.difficulty] || 320;
    return 0;
  }

  _resolvePool() {
    if (this.config.mode === 'custom') return this.config.custom.pool || 'mixed';
    if (this.config.mode === 'training') return this.difficulty.pool;
    return 'random';
  }

  /** Numeric ramp factor per level (0 disables progression). */
  _resolveRamp() {
    if (this.config.mode === 'training') return this.difficulty.ramp;
    if (this.config.mode === 'custom') return this.config.custom.ramp ? 0.07 : 0;
    if (this.config.mode === 'freestyle') return 0.05;
    if (this.config.mode === 'tenhearts') return 0;
    return 0.05;
  }

  /* ---------------- counters ---------------- */

  resetCounters() {
    this.switches = 0;
    this.correct = 0;
    this.incorrect = 0;
    this.reactionSum = 0;
    this.reactionCount = 0;
    this.fastestReaction = null;
    this.streak = 0;
    this.bestStreak = 0;
    this.roundHits = 0;
    this.roundMisses = 0;
    this.rounds = 0;
    this.level = 1;
    this.hitsForLevel = 0;
    this.xpProgress = 0;
    this.target = null;
    this.sequence = [];
    this.seqIndex = 0;
    this.seqStartedAt = 0;
    this.roundStartedAt = 0;
    this.nextAt = 0;
    this.pending = null;
    this.fastestRound = null;
    this.comboFlashAt = 0;
  }

  /* ---------------- lifecycle ---------------- */

  start() {
    this.resetCounters();
    this.running = true;
    this.paused = false;
    this.startTime = performance.now();
    this.pausedTotal = 0;
    this.roundStartedAt = 0;

    if (this.usesSequence) {
      this._newSequence(0);
      const first = this.sequence[0];
      this._issueTarget(first, 0);
    } else if (this.challenge) {
      this.nextAt = this.config.mode === 'tenhearts' ? 350 : 420;
    }

    this.cb.onStart && this.cb.onStart(this.snapshot());
    this._loop();
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.pausedAt = performance.now();
    if (this.target && this.target.finite) {
      this.target.consumed = this.elapsed() - this.target.startedAt;
    }
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cb.onPause && this.cb.onPause(this.snapshot());
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.pausedTotal += performance.now() - this.pausedAt;
    this.paused = false;
    if (this.target) {
      // the window keeps the time it had left when paused
      this.target.startedAt = this.elapsed() - this.target.consumed;
    }
    this.cb.onResume && this.cb.onResume(this.snapshot());
    this._loop();
  }

  /** End the session and return its summary (also used by UI). */
  finish() {
    if (!this.running) return null;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.target = null;
    const summary = this.summary();
    this.cb.onFinish && this.cb.onFinish(summary);
    return summary;
  }

  elapsed() {
    if (!this.running) return this.lastElapsed || 0;
    const now = performance.now();
    return now - this.startTime - this.pausedTotal - (this.paused ? now - this.pausedAt : 0);
  }

  /* ---------------- sequences ---------------- */

  windowForLevel(level = this.level) {
    if (this.baseWindow === Infinity) return Infinity;
    const lv = Math.max(1, level);
    const shrink = this.ramp * (lv - 1) * 0.55;
    const scaled = this.baseWindow * (1 - Math.min(0.62, shrink));
    return Math.max(MIN_WINDOW, Math.round(scaled));
  }

  lengthForLevel(level = this.level) {
    if (!this.usesSequence) return 1;
    return Math.min(14, this.baseLength + Math.floor((Math.max(1, level) - 1) / 3));
  }

  gapForLevel(level = this.level) {
    const base = this.baseGap;
    const shrink = this.ramp * (level - 1) * 0.4;
    return Math.max(60, Math.round(base * (1 - Math.min(0.6, shrink))));
  }

  _newSequence(level) {
    const len = this.lengthForLevel(level);
    const seq = [];
    let prev = this.target ? this.target.slot : pick(this.activeSlots);
    for (let i = 0; i < len; i++) {
      const next = this._pickNext(prev);
      seq.push(next);
      prev = next;
    }
    this.sequence = seq;
    this.seqIndex = 0;
    this.seqStartedAt = this.elapsed();
    this.roundStartedAt = this.elapsed();
  }

  _pickNext(prev) {
    const candidates = this.activeSlots.filter((s) => s !== prev);
    if (!candidates.length) return prev;
    if (this.pool === 'near') {
      const near = candidates.filter((s) => Math.abs(s - prev) <= 2);
      if (near.length && Math.random() < 0.82) return pick(near);
      return pick(candidates);
    }
    if (this.pool === 'mixed') {
      const mid = candidates.filter((s) => {
        const d = Math.abs(s - prev);
        return d >= 2 && d <= 5;
      });
      if (mid.length && Math.random() < 0.68) return pick(mid);
      return pick(candidates);
    }
    return pick(candidates);
  }

  _issueTarget(slot, index) {
    const w = this.windowForLevel();
    this.target = {
      slot,
      index,
      startedAt: this.elapsed(),
      window: w,
      finite: w !== Infinity,
      consumed: 0,
    };
    this.nextAt = 0;
    this.cb.onCue && this.cb.onCue({
      slot,
      windowMs: w,
      index,
      length: this.sequence.length,
      level: this.level,
    });
  }

  /* ---------------- input ---------------- */

  /**
   * A hotbar slot was pressed.
   * @returns {'hit'|'wrong'|'neutral'|'ignored'}
   */
  pressSlot(slot) {
    if (!this.running || this.paused) return 'ignored';
    if (!this.activeSlots.includes(slot)) return 'ignored';

    this.switches += 1;
    const t = this.target;

    if (!t) {
      this.cb.onSwitch && this.cb.onSwitch({ slot, judged: false });
      return 'neutral';
    }

    if (slot === t.slot) {
      const reaction = this.elapsed() - t.startedAt;
      this.correct += 1;
      this.reactionSum += reaction;
      this.reactionCount += 1;
      this.fastestReaction = this.fastestReaction === null ? reaction : Math.min(this.fastestReaction, reaction);
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.roundHits += 1;
      this.hitsForLevel += 1;
      this._updateXP();

      const res = {
        slot,
        target: t.slot,
        reaction,
        streak: this.streak,
        index: t.index,
        length: this.sequence.length,
      };
      this.target = null;
      this.cb.onSwitch && this.cb.onSwitch({ slot, judged: true });
      this.cb.onHit && this.cb.onHit(res);

      if (this.streak > 0 && this.streak % 10 === 0) {
        this.cb.onCombo && this.cb.onCombo({ streak: this.streak });
      }

      this._advanceAfterHit(res);
      return 'hit';
    }

    this.incorrect += 1;
    this.roundMisses += 1;
    this.streak = 0;
    this.cb.onSwitch && this.cb.onSwitch({ slot, judged: true });
    this.cb.onWrong && this.cb.onWrong({ slot, target: t.slot });
    // a wrong slot costs a slice of the remaining window (timed modes only)
    if (t.finite && Number.isFinite(t.window)) {
      const spent = this.elapsed() - t.startedAt;
      const keep = Math.max(0, t.window - spent - Math.min(260, t.window * 0.2));
      t.startedAt = this.elapsed() - (t.window - keep);
      t.consumed = t.window - keep;
    }
    return 'wrong';
  }

  /** Utility actions from the arena. */
  pressAction(action) {
    if (!this.running || this.paused) return;
    if (action === 'reset' && this.target) {
      this._miss('skipped');
    }
  }

  _updateXP() {
    const perLevel = this.usesSequence ? 8 : 10;
    this.xpProgress = (this.hitsForLevel % perLevel) / perLevel;
    if (this.hitsForLevel > 0 && this.hitsForLevel % perLevel === 0 && !this.usesSequence) {
      this._levelUp();
    }
  }

  _levelUp() {
    if (this.level >= MAX_LEVEL) return;
    this.level += 1;
    this.cb.onLevel && this.cb.onLevel({ level: this.level, windowMs: this.windowForLevel() });
  }

  _advanceAfterHit(res) {
    if (this.usesSequence) {
      this.seqIndex += 1;
      if (this.seqIndex >= this.sequence.length) {
        this._completeRound();
        return;
      }
      const gap = this.gapForLevel();
      this.nextAt = this.elapsed() + Math.max(40, gap * 0.35);
      this.pending = { kind: 'next', index: this.seqIndex };
      return;
    }
    // freestyle / hearts: wait, then a new random target appears
    const rate = this._freeRate();
    this.nextAt = this.elapsed() + rate;
    this.pending = { kind: 'spawn' };
  }

  _freeRate() {
    if (this.config.mode === 'tenhearts') return Math.max(500, this.config.tenhearts.rate || 1700);
    if (this.config.mode === 'custom') return Math.max(400, this.config.custom.rate || 1500);
    return Math.max(400, this.config.freestyle.rate || 1600);
  }

  _completeRound() {
    const timeMs = this.elapsed() - this.roundStartedAt;
    this.rounds += 1;
    const roundOk = this.roundHits >= this.roundMisses;
    if (this.ramp) {
      if (roundOk) this._levelUp();
      else this.level = Math.max(1, this.level - 1);
    }
    if (this.fastestRound === null || timeMs < this.fastestRound) this.fastestRound = timeMs;

    const info = {
      round: this.rounds,
      level: this.level,
      timeMs,
      hits: this.roundHits,
      misses: this.roundMisses,
      length: this.sequence.length,
    };
    this.roundHits = 0;
    this.roundMisses = 0;
    this.cb.onRound && this.cb.onRound(info);

    this._newSequence(this.level);
    this.nextAt = this.elapsed() + 620;
    this.pending = { kind: 'next', index: 0 };
  }

  _spawnFreeTarget() {
    const prev = this.target ? this.target.slot : null;
    const slot = this._pickNext(prev === null ? pick(this.activeSlots) : prev);
    const lifetime = this.windowForLevel();
    this.target = {
      slot,
      index: 0,
      startedAt: this.elapsed(),
      window: lifetime,
      finite: lifetime !== Infinity,
      consumed: 0,
    };
    this.nextAt = 0;
    this.cb.onCue && this.cb.onCue({ slot, windowMs: lifetime, index: 0, length: 0, level: this.level });
  }

  _miss(reason = 'timeout') {
    if (!this.target) return;
    const target = this.target;
    this.incorrect += 1;
    this.roundMisses += 1;
    this.streak = 0;
    this.cb.onMiss && this.cb.onMiss({ target: target.slot, reason });
    this.target = null;

    if (this.usesSequence) {
      this.seqIndex += 1;
      if (this.seqIndex >= this.sequence.length) {
        this._completeRound();
        return;
      }
      this.nextAt = this.elapsed() + 260;
      this.pending = { kind: 'next', index: this.seqIndex };
      return;
    }
    this.nextAt = this.elapsed() + Math.max(320, this._freeRate() * 0.6);
    this.pending = { kind: 'spawn' };
  }

  /* ---------------- loop ---------------- */

  _loop() {
    if (!this.running || this.paused) return;
    const step = () => {
      if (!this.running || this.paused) {
        this.raf = 0;
        return;
      }
      this._step();
      this.raf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(step);
  }

  _step() {
    const e = this.elapsed();
    this.lastElapsed = e;

    if (this.target && this.target.finite) {
      const spent = e - this.target.startedAt;
      if (spent >= this.target.window) {
        this._miss('timeout');
      }
    }

    if (!this.target && this.nextAt && e >= this.nextAt) {
      const pending = this.pending;
      this.nextAt = 0;
      this.pending = null;
      if (pending && pending.kind === 'next') {
        const slot = this.sequence[pending.index];
        if (typeof slot === 'number') this._issueTarget(slot, pending.index);
      } else if (this.challenge) {
        this._spawnFreeTarget();
      }
    }

    this.cb.onTick && this.cb.onTick(this.snapshot());
  }

  /* ---------------- snapshots ---------------- */

  accuracy() {
    const judged = this.correct + this.incorrect;
    return judged ? (this.correct / judged) * 100 : null;
  }

  avgReaction() {
    return this.reactionCount ? this.reactionSum / this.reactionCount : null;
  }

  windowRemaining() {
    if (!this.target || !this.target.finite) return null;
    const spent = this.elapsed() - this.target.startedAt;
    return Math.max(0, this.target.window - spent);
  }

  snapshot() {
    const judged = this.correct + this.incorrect;
    return {
      mode: this.config.mode,
      difficulty: this.config.mode === 'training' ? this.config.difficulty : null,
      elapsed: this.elapsed(),
      switches: this.switches,
      correct: this.correct,
      incorrect: this.incorrect,
      judged,
      accuracy: judged ? (this.correct / judged) * 100 : null,
      avgReaction: this.avgReaction(),
      fastestReaction: this.fastestReaction,
      streak: this.streak,
      bestStreak: this.bestStreak,
      level: this.level,
      xp: this.xpProgress,
      rounds: this.rounds,
      usesSequence: this.usesSequence,
      challenge: this.challenge,
      noTimer: this.noTimer,
      seqIndex: this.seqIndex,
      seqLength: this.sequence.length,
      seqProgress: this.sequence.length ? this.seqIndex / this.sequence.length : 0,
      target: this.target ? { slot: this.target.slot, window: this.target.window, finite: this.target.finite } : null,
      windowRemaining: this.windowRemaining(),
      windowMs: this.target ? this.target.window : this.windowForLevel(),
      paused: this.paused,
      activeSlots: this.activeSlots,
    };
  }

  summary() {
    const judged = this.correct + this.incorrect;
    return {
      mode: this.config.mode,
      difficulty: this.config.mode === 'training' ? this.config.difficulty : null,
      durationMs: this.elapsed(),
      switches: this.switches,
      correct: this.correct,
      incorrect: this.incorrect,
      judged,
      accuracy: judged ? (this.correct / judged) * 100 : null,
      avgReaction: this.avgReaction(),
      fastestReaction: this.fastestReaction,
      bestStreak: this.bestStreak,
      rounds: this.rounds,
      level: this.level,
      fastestRound: this.fastestRound,
      usesSequence: this.usesSequence,
    };
  }
}
