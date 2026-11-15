/* ============================================================
   store.js — LocalStorage persistence, stats aggregation, records
   ============================================================ */

import {
  ACTION_DEFS,
  DEFAULT_BINDS,
  DEFAULT_CUSTOM,
  DEFAULT_FREESTYLE,
  DEFAULT_LOADOUT,
  DEFAULT_SETTINGS,
  DEFAULT_TENHEARTS,
  SLOT_COUNT,
} from './data.js';
import { ITEM_IDS } from './pixelart.js';

const KEY = 'slotcraft.hotbar-trainer.v1';
const MAX_SESSIONS = 40;

const clone = (v) => JSON.parse(JSON.stringify(v));

function blankRecords() {
  return {
    bestAvgReaction: null,
    bestAccuracy: null,
    bestStreak: 0,
    fastestReaction: null,
    fastestRound: null,
    bestRoundLevel: 0,
    totalSessions: 0,
    totalSwitches: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    totalMs: 0,
    reactionSum: 0,
    reactionCount: 0,
  };
}

export function defaults() {
  return {
    version: 1,
    settings: clone(DEFAULT_SETTINGS),
    binds: clone(DEFAULT_BINDS),
    loadout: [...DEFAULT_LOADOUT],
    sessions: [],
    records: blankRecords(),
    recovery: null,
    config: {
      freestyle: clone(DEFAULT_FREESTYLE),
      tenhearts: clone(DEFAULT_TENHEARTS),
      custom: clone(DEFAULT_CUSTOM),
      difficulty: 'normal',
      seenIntro: false,
    },
  };
}

const state = defaults();

/* ---------------- validation ---------------- */

function uniqueStrings(list) {
  return Array.isArray(list) && new Set(list).size === list.length;
}

function isValidBindId(id) {
  return typeof id === 'string' && id.length > 0 && id.length < 32;
}

/** Repair anything a user could have hand-edited into LocalStorage. */
export function sanitize(input) {
  const base = defaults();
  if (!input || typeof input !== 'object') return base;

  // settings
  if (input.settings && typeof input.settings === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key in input.settings) {
        const fallback = DEFAULT_SETTINGS[key];
        const val = input.settings[key];
        if (typeof fallback === 'number' && Number.isFinite(val)) base.settings[key] = val;
        else if (typeof fallback === 'boolean' && typeof val === 'boolean') base.settings[key] = val;
        else if (typeof fallback === 'string' && typeof val === 'string') base.settings[key] = val;
      }
    }
  }
  base.settings.volume = Math.min(1, Math.max(0, base.settings.volume));
  base.settings.hudScale = Math.min(1.5, Math.max(0.8, base.settings.hudScale || 1));

  // loadout
  if (Array.isArray(input.loadout) && input.loadout.length === SLOT_COUNT) {
    base.loadout = input.loadout.map((id) => (ITEM_IDS.includes(id) ? id : 'cobble'));
  }

  // binds
  if (input.binds && typeof input.binds === 'object') {
    const slots = input.binds.slots;
    if (Array.isArray(slots) && slots.length === SLOT_COUNT && slots.every(isValidBindId)) {
      base.binds.slots = [...slots];
    }
    if (input.binds.actions && typeof input.binds.actions === 'object') {
      for (const def of ACTION_DEFS) {
        const v = input.binds.actions[def.id];
        base.binds.actions[def.id] = isValidBindId(v) ? v : null;
      }
    }
  }

  // config
  if (input.config && typeof input.config === 'object') {
    const c = input.config;
    const mergeNumeric = (target, source, min, max) => {
      if (!source || typeof source !== 'object') return;
      for (const k of Object.keys(target)) {
        const v = source[k];
        if (typeof target[k] === 'number' && Number.isFinite(v)) {
          target[k] = Math.min(max, Math.max(min, v));
        } else if (typeof target[k] === 'boolean' && typeof v === 'boolean') {
          target[k] = v;
        } else if (typeof target[k] === 'string' && typeof v === 'string') {
          target[k] = v;
        }
      }
    };
    if (c.freestyle) mergeNumeric(base.config.freestyle, c.freestyle, 600, 6000);
    if (c.tenhearts) mergeNumeric(base.config.tenhearts, c.tenhearts, 600, 6000);
    if (c.custom) {
      mergeNumeric(base.config.custom, c.custom, 250, 6000);
      if (c.custom.slots && Array.isArray(c.custom.slots)) {
        const slots = [...new Set(c.custom.slots.filter((n) => Number.isInteger(n) && n >= 0 && n < SLOT_COUNT))];
        if (slots.length >= 2) base.config.custom.slots = slots.sort((a, b) => a - b);
      }
    }
    if (typeof c.difficulty === 'string') base.config.difficulty = c.difficulty;
    base.config.seenIntro = !!c.seenIntro;
  }

  // sessions
  if (Array.isArray(input.sessions)) {
    base.sessions = input.sessions.slice(0, MAX_SESSIONS).filter((s) => s && typeof s === 'object').map((s) => ({
      id: String(s.id || Math.random().toString(36).slice(2)),
      ts: Number(s.ts) || Date.now(),
      mode: String(s.mode || 'freestyle'),
      difficulty: s.difficulty ? String(s.difficulty) : null,
      durationMs: Math.max(0, Number(s.durationMs) || 0),
      switches: Math.max(0, Number(s.switches) || 0),
      correct: Math.max(0, Number(s.correct) || 0),
      incorrect: Math.max(0, Number(s.incorrect) || 0),
      judged: Math.max(0, Number(s.judged) || 0),
      accuracy: Number.isFinite(Number(s.accuracy)) ? Number(s.accuracy) : null,
      avgReaction: Number.isFinite(Number(s.avgReaction)) ? Number(s.avgReaction) : null,
      fastestReaction: Number.isFinite(Number(s.fastestReaction)) ? Number(s.fastestReaction) : null,
      bestStreak: Math.max(0, Number(s.bestStreak) || 0),
      rounds: Math.max(0, Number(s.rounds) || 0),
      level: Math.max(0, Number(s.level) || 0),
      fastestRound: Number.isFinite(Number(s.fastestRound)) ? Number(s.fastestRound) : null,
    }));
  }

  // interrupted-session recovery snapshot
  if (input.recovery && typeof input.recovery === 'object' && input.recovery.data) {
    const d = input.recovery.data;
    const ts = Number(input.recovery.ts);
    if (Number.isFinite(ts) && Number.isFinite(Number(d.switches))) {
      base.recovery = {
        ts,
        data: {
          mode: String(d.mode || 'freestyle'),
          difficulty: d.difficulty ? String(d.difficulty) : null,
          durationMs: Math.max(0, Number(d.durationMs) || 0),
          switches: Math.max(0, Number(d.switches) || 0),
          correct: Math.max(0, Number(d.correct) || 0),
          incorrect: Math.max(0, Number(d.incorrect) || 0),
          avgReaction: Number.isFinite(Number(d.avgReaction)) ? Number(d.avgReaction) : null,
          fastestReaction: Number.isFinite(Number(d.fastestReaction)) ? Number(d.fastestReaction) : null,
          bestStreak: Math.max(0, Number(d.bestStreak) || 0),
          rounds: Math.max(0, Number(d.rounds) || 0),
          level: Math.max(0, Number(d.level) || 0),
          fastestRound: Number.isFinite(Number(d.fastestRound)) ? Number(d.fastestRound) : null,
        },
      };
    }
  }

  // records — sanitise, then rebuild the counters from stored sessions if they look broken
  const rec = blankRecords();
  if (input.records && typeof input.records === 'object') {
    for (const k of Object.keys(rec)) {
      const v = Number(input.records[k]);
      if (Number.isFinite(v)) rec[k] = v;
    }
  }
  for (const k of ['bestAvgReaction', 'bestAccuracy', 'fastestReaction', 'fastestRound']) {
    if (rec[k] !== null && (!Number.isFinite(rec[k]) || rec[k] <= 0)) rec[k] = null;
  }
  base.records = rec;

  return base;
}

/* ---------------- load / save ---------------- */

let storageAvailable = true;

try {
  const probe = '__slotcraft_probe__';
  localStorage.setItem(probe, '1');
  localStorage.removeItem(probe);
} catch {
  storageAvailable = false;
}

export function load() {
  if (!storageAvailable) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return state;
    const parsed = JSON.parse(raw);
    Object.assign(state, sanitize(parsed));
  } catch (err) {
    console.warn('[store] could not read saved data, using defaults', err);
  }
  return state;
}

let saveTimer = 0;
export function save(immediate = false) {
  if (!storageAvailable) return;
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[store] save failed', err);
    }
  };
  if (immediate) {
    clearTimeout(saveTimer);
    write();
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 140);
}

export function getState() {
  return state;
}

export function storageOk() {
  return storageAvailable;
}

/* ---------------- settings ---------------- */

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

/* ---------------- binds ---------------- */

export function setSlotBind(slot, bindId) {
  state.binds.slots[slot] = bindId;
  save();
}

export function setActionBind(actionId, bindId) {
  state.binds.actions[actionId] = bindId;
  save();
}

export function resetBinds() {
  state.binds = clone(DEFAULT_BINDS);
  save();
}

export function allBindEntries() {
  const entries = state.binds.slots.map((bind, slot) => ({ kind: 'slot', slot, bind }));
  for (const def of ACTION_DEFS) {
    entries.push({ kind: 'action', action: def.id, label: def.label, bind: state.binds.actions[def.id] });
  }
  return entries;
}

/** Returns [{bind, owners:[...]}] for every duplicated binding. */
export function findDuplicates() {
  const byBind = new Map();
  for (const entry of allBindEntries()) {
    if (!entry.bind) continue;
    if (!byBind.has(entry.bind)) byBind.set(entry.bind, []);
    byBind.get(entry.bind).push(entry);
  }
  return [...byBind.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([bind, owners]) => ({ bind, owners }));
}

/* ---------------- loadout ---------------- */

export function setLoadoutItem(slot, itemId) {
  if (!ITEM_IDS.includes(itemId)) return;
  state.loadout[slot] = itemId;
  save();
}

export function resetLoadout() {
  state.loadout = [...DEFAULT_LOADOUT];
  save();
}

/* ---------------- stats ---------------- */

export function accuracyOf(correct, incorrect) {
  const judged = correct + incorrect;
  if (!judged) return null;
  return (correct / judged) * 100;
}

export function overallStats() {
  const r = state.records;
  const judged = r.totalCorrect + r.totalIncorrect;
  return {
    sessions: r.totalSessions,
    switches: r.totalSwitches,
    correct: r.totalCorrect,
    incorrect: r.totalIncorrect,
    judged,
    accuracy: judged ? (r.totalCorrect / judged) * 100 : null,
    avgReaction: r.reactionCount ? r.reactionSum / r.reactionCount : null,
    totalMs: r.totalMs,
  };
}

/**
 * Persist a finished session and update aggregate + personal records.
 * Returns the list of records that were beaten.
 */
export function pushSession(session) {
  const judged = session.correct + session.incorrect;
  const entry = {
    id: Math.random().toString(36).slice(2),
    ts: Date.now(),
    mode: session.mode,
    difficulty: session.difficulty || null,
    durationMs: Math.max(0, Math.round(session.durationMs)),
    switches: session.switches,
    correct: session.correct,
    incorrect: session.incorrect,
    judged,
    accuracy: judged ? (session.correct / judged) * 100 : null,
    avgReaction: session.avgReaction,
    fastestReaction: session.fastestReaction,
    bestStreak: session.bestStreak,
    rounds: session.rounds,
    level: session.level,
  };

  state.sessions.unshift(entry);
  if (state.sessions.length > MAX_SESSIONS) state.sessions.length = MAX_SESSIONS;

  const r = state.records;
  const beaten = [];

  r.totalSessions += 1;
  r.totalSwitches += entry.switches;
  r.totalCorrect += entry.correct;
  r.totalIncorrect += entry.incorrect;
  r.totalMs += entry.durationMs;

  if (entry.avgReaction) {
    r.reactionSum += entry.avgReaction * entry.judged;
    r.reactionCount += entry.judged;
    if (entry.judged >= 15 && (r.bestAvgReaction === null || entry.avgReaction < r.bestAvgReaction)) {
      r.bestAvgReaction = Math.round(entry.avgReaction);
      beaten.push('Fastest average reaction');
    }
  }
  if (entry.accuracy !== null && entry.judged >= 25) {
    if (r.bestAccuracy === null || entry.accuracy > r.bestAccuracy) {
      r.bestAccuracy = Math.round(entry.accuracy * 10) / 10;
      beaten.push('Highest accuracy');
    }
  }
  if (entry.bestStreak > r.bestStreak) {
    r.bestStreak = entry.bestStreak;
    beaten.push('Longest streak');
  }
  if (entry.fastestReaction && (r.fastestReaction === null || entry.fastestReaction < r.fastestReaction)) {
    r.fastestReaction = Math.round(entry.fastestReaction);
    beaten.push('Fastest single switch');
  }
  if (entry.level > r.bestRoundLevel) {
    r.bestRoundLevel = entry.level;
    beaten.push('Highest level reached');
  }
  if (Number.isFinite(session.fastestRound) && session.fastestRound > 0) {
    if (r.fastestRound === null || session.fastestRound < r.fastestRound) {
      r.fastestRound = Math.round(session.fastestRound);
      beaten.push('Fastest sequence');
    }
  }

  save(true);
  return { entry, beaten };
}

/* ---------------- interrupted session recovery ---------------- */

export function saveRecovery(data) {
  state.recovery = { data, ts: Date.now() };
  save(true);
}

export function clearRecovery() {
  if (!state.recovery) return;
  state.recovery = null;
  save(true);
}

/**
 * Consume a stored recovery snapshot. Returns the summary data or null.
 * Snapshots older than maxAge are discarded.
 */
export function takeRecovery(maxAge = 20 * 60 * 1000) {
  const snapshot = state.recovery;
  state.recovery = null;
  save(true);
  if (!snapshot || !snapshot.data) return null;
  if (Date.now() - snapshot.ts > maxAge) return null;
  return snapshot.data;
}

export function resetStats() {
  state.sessions = [];
  state.records = blankRecords();
  save(true);
}

export function resetSettings() {
  state.settings = clone(DEFAULT_SETTINGS);
  state.binds = clone(DEFAULT_BINDS);
  state.loadout = [...DEFAULT_LOADOUT];
  state.config = defaults().config;
  save(true);
}

export function resetEverything() {
  Object.assign(state, defaults());
  save(true);
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const clean = sanitize(parsed);
  Object.assign(state, clean);
  save(true);
  return state;
}

export function minutesPlayed() {
  return state.records.totalMs / 60000;
}
