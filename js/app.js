/* ============================================================
   app.js — application controller
   ============================================================ */

import {
  ACTION_DEFS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MODE_LABELS,
  MODE_META,
  SLOT_COUNT,
} from './data.js';
import { InputHub, bindLabel } from './keybinds.js';
import { Hud, renderPreviewHud } from './hud.js';
import { Trainer } from './engine.js';
import { ParticleField } from './particles.js';
import { audio } from './audio.js';
import { buildSpriteSheet, icon as pxIcon, ITEMS, ITEM_IDS, itemName } from './pixelart.js';
import { fmt } from './utils.js';
import { lineChart, barChart } from './charts.js';
import * as store from './store.js';

/* ============================================================
   boot
   ============================================================ */

buildSpriteSheet();
const state = store.load();

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const el = {
  nav: $('#mainnav'),
  quickSfx: $('#quickSfx'),
  quickFx: $('#quickFx'),
  views: $$('.view'),

  hsSessions: $('#hsSessions'),
  hsAccuracy: $('#hsAccuracy'),
  hsReaction: $('#hsReaction'),
  hsSwitches: $('#hsSwitches'),
  previewHud: $('#previewHud'),
  previewKeys: $('#previewKeys'),
  previewViewModel: $('#previewViewModel'),
  recordGrid: $('#recordGrid'),
  historyWrap: $('#historyWrap'),
  heroQuickStart: $('#heroQuickStart'),

  arenaRoot: $('#arenaRoot'),
  sceneHills: $('#sceneHills'),
  arenaModeName: $('#arenaModeName'),
  arenaSub: $('#arenaSub'),
  arenaChips: $('#arenaChips'),
  btnPause: $('#btnPause'),
  btnEnd: $('#btnEnd'),
  cueLayer: $('#cueLayer'),
  cueLabel: $('#cueLabel'),
  cuePrompt: $('#cuePrompt'),
  cueHint: $('#cueHint'),
  cueWindow: $('#cueWindow'),
  cueWindowFill: $('#cueWindowFill'),
  crosshair: $('#crosshair'),
  hitmarker: $('#hitmarker'),
  arenaSide: $('#arenaSide'),
  hudInner: $('#hudInner'),
  xpLevel: $('#xpLevel'),
  xpFill: $('#xpFill'),
  hearts: $('#hearts'),
  hunger: $('#hunger'),
  hotbar: $('#hotbar'),
  selFrame: $('#selFrame'),
  targetMarker: $('#targetMarker'),
  keyRow: $('#keyRow'),
  viewmodel: $('#viewmodel'),
  streakPop: $('#streakPop'),
  fxCanvas: $('#fxCanvas'),
  arenaHintBar: $('#arenaHintBar'),
  arenaOverlay: $('#arenaOverlay'),

  statStrip: $('#statStrip'),
  chartAccuracy: $('#chartAccuracy'),
  chartReaction: $('#chartReaction'),
  chartVolume: $('#chartVolume'),
  diffList: $('#diffList'),
  historyWrapFull: $('#historyWrapFull'),

  bindGrid: $('#bindGrid'),
  bindReset: $('#bindReset'),
  bindWarning: $('#bindWarning'),
  actionBinds: $('#actionBinds'),
  toggleList: $('#toggleList'),
  volumeRange: $('#volumeRange'),
  volumeOut: $('#volumeOut'),
  hudScaleRange: $('#hudScaleRange'),
  hudScaleOut: $('#hudScaleOut'),
  themeSegmented: $('#themeSegmented'),
  settingsPreview: $('#settingsPreview'),
  loadout: $('#loadout'),
  itemPicker: $('#itemPicker'),
  resetLoadout: $('#resetLoadout'),
  importFile: $('#importFile'),

  toastStack: $('#toastStack'),
  modalLayer: $('#modalLayer'),
  modalEyebrow: $('#modalEyebrow'),
  modalTitle: $('#modalTitle'),
  modalBody: $('#modalBody'),
  modalFoot: $('#modalFoot'),
};

const hud = new Hud({
  hotbar: el.hotbar,
  selFrame: el.selFrame,
  targetMarker: el.targetMarker,
  hearts: el.hearts,
  hunger: el.hunger,
  xpFill: el.xpFill,
  xpLevel: el.xpLevel,
  keyRow: el.keyRow,
  viewmodel: el.viewmodel,
  hudInner: el.hudInner,
});
hud.mount();

const hub = new InputHub();
hub.setWheelGuard(el.arenaRoot);

const field = new ParticleField(el.fxCanvas);

/* build the arena skyline once */
(function buildHills() {
  if (!el.sceneHills) return;
  const heights = [26, 44, 34, 58, 40, 62, 30, 48, 24, 52, 36, 46, 28, 60, 33, 42, 22, 50, 30];
  el.sceneHills.innerHTML = heights.map((h) => `<i style="height:${h}%"></i>`).join('');
})();

/* ============================================================
   session state
   ============================================================ */

let trainer = null;
let sessionMode = null;
let sessionConfig = null;
let sessionFinished = false;
let countdownActive = false;
let countdownTimers = [];
let overlayState = null;
let lastConfig = null;
let setupState = null;
let chipEls = {};
let sideEls = {};
let paintLast = 0;
let missFlashTimer = 0;
let loadoutSlot = 0;
let suppressSummary = false;
let lastRecoveryAt = 0;

/* ============================================================
   toasts + modal
   ============================================================ */

const TOAST_PATHS = {
  ok: 'M4 12.5l5 5L20 6.5',
  warn: 'M12 3l9 16H3zM12 9v4.5M12 16.5h.01',
  err: 'M6 6l12 12M18 6L6 18',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v.01M12 11v5',
};

function toast(message, type = 'info', ttl = 3400) {
  if (!el.toastStack) return;
  const kind = type === 'error' ? 'err' : type === 'success' ? 'ok' : type;
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.innerHTML = `<svg viewBox="0 0 24 24" class="t-icon uicon" aria-hidden="true"><path d="${TOAST_PATHS[kind] || TOAST_PATHS.info}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><div>${fmt.escape(message)}</div>`;
  el.toastStack.appendChild(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 260);
  }, ttl);
}

function openModal({ eyebrow = 'Confirm', title = '', body = '', actions = [] }) {
  el.modalEyebrow.textContent = eyebrow;
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = body;
  el.modalFoot.innerHTML = '';
  actions.forEach((action) => {
    const btn = document.createElement('button');
    btn.className = `btn ${action.style || 'btn-ghost'}`;
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      const keepOpen = action.onClick ? action.onClick() : false;
      if (!keepOpen) closeModal();
    });
    el.modalFoot.appendChild(btn);
  });
  el.modalLayer.hidden = false;
}

function closeModal() {
  el.modalLayer.hidden = true;
}

/* ============================================================
   settings application
   ============================================================ */

function applySettings() {
  const s = state.settings;
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.classList.toggle('no-anim', !s.animations);
  document.documentElement.style.setProperty('--hud-scale', String(s.hudScale));
  document.body.classList.toggle('hide-keys', !s.keyLabels);
  audio.setEnabled(s.sfx);
  audio.setVolume(s.volume);
  field.setEnabled(s.particles && s.animations);
  hub.blockShortcuts = s.blockShortcuts;
  if (el.quickSfx) el.quickSfx.setAttribute('aria-pressed', String(s.sfx));
  if (el.quickFx) el.quickFx.setAttribute('aria-pressed', String(s.animations));
  hud.layout();
}

function setSettingAndApply(key, value) {
  store.setSetting(key, value);
  applySettings();
  audio.ui();
}

/* ============================================================
   dashboard
   ============================================================ */

function recordCard({ icon, accent, label, value, unit }) {
  return `<div class="record">
    <span class="r-label"><svg viewBox="0 0 16 16" class="r-icon ${accent}" aria-hidden="true"><use href="#px-${icon}"></use></svg>${label}</span>
    <div class="r-value">${value}${unit ? `<small>${unit}</small>` : ''}</div>
  </div>`;
}

function renderDashboard() {
  const stats = store.overallStats();
  const rec = state.records;

  if (el.hsSessions) el.hsSessions.textContent = fmt.int(stats.sessions);
  if (el.hsAccuracy) el.hsAccuracy.textContent = stats.accuracy === null ? '—' : fmt.pct(stats.accuracy, 0);
  if (el.hsReaction) el.hsReaction.textContent = rec.fastestReaction ? `${Math.round(rec.fastestReaction)}ms` : '—';
  if (el.hsSwitches) el.hsSwitches.textContent = fmt.int(stats.switches);

  if (el.recordGrid) {
    el.recordGrid.innerHTML = [
      recordCard({ icon: 'pearl', accent: 'gold', label: 'Fastest switch', value: rec.fastestReaction ? Math.round(rec.fastestReaction) : '—', unit: rec.fastestReaction ? 'ms' : '' }),
      recordCard({ icon: 'apple', accent: 'up', label: 'Best accuracy', value: rec.bestAccuracy !== null ? rec.bestAccuracy.toFixed(1) : '—', unit: rec.bestAccuracy !== null ? '%' : '' }),
      recordCard({ icon: 'sword', accent: 'cyan', label: 'Fastest avg RT', value: rec.bestAvgReaction ? Math.round(rec.bestAvgReaction) : '—', unit: rec.bestAvgReaction ? 'ms' : '' }),
      recordCard({ icon: 'carrot', accent: 'red', label: 'Longest streak', value: rec.bestStreak || '—' }),
      recordCard({ icon: 'diamond', accent: 'gold', label: 'Fastest sequence', value: rec.fastestRound ? fmt.dur(rec.fastestRound) : '—' }),
      recordCard({ icon: 'book', accent: 'up', label: 'Time practised', value: fmt.dur(rec.totalMs) }),
    ].join('');
  }

  renderHistory(el.historyWrap, state.sessions.slice(0, 6));

  renderPreviewHud(el.previewHud, 0.92);
  if (el.previewViewModel) el.previewViewModel.innerHTML = pxIcon(state.loadout[0]);
  if (el.previewKeys) {
    el.previewKeys.innerHTML = state.binds.slots
      .map((b, i) => `<span title="Slot ${i + 1}">${fmt.escape(bindLabel(b, true))}</span>`)
      .join('');
  }

  syncControls();
}

function pillClass(mode) {
  return { freestyle: 'free', training: 'train', tenhearts: 'heart', custom: 'custom' }[mode] || '';
}

function modeLabel(session) {
  const base = MODE_LABELS[session.mode] || session.mode;
  if (session.difficulty && DIFFICULTIES[session.difficulty]) {
    return `${base} · ${DIFFICULTIES[session.difficulty].name}`;
  }
  return base;
}

function renderHistory(container, sessions) {
  if (!container) return;
  if (!sessions || !sessions.length) {
    container.innerHTML = `<div class="empty-state">No sessions yet — start a drill and your runs will appear here.</div>`;
    return;
  }
  const rows = sessions
    .map((s) => {
      const acc = s.accuracy === null || s.accuracy === undefined
        ? '<span style="color:var(--dim)">unjudged</span>'
        : `<span class="acc-bar"><span class="acc-track"><span class="acc-fill" style="width:${Math.max(0, Math.min(100, s.accuracy))}%"></span></span>${fmt.pct(s.accuracy, 0)}</span>`;
      return `<tr>
        <td class="strong">${fmt.date(s.ts)}</td>
        <td><span class="pill-mode ${pillClass(s.mode)}">${fmt.escape(modeLabel(s))}</span></td>
        <td>${acc}</td>
        <td class="num">${fmt.int(s.switches)}</td>
        <td class="num">${s.avgReaction ? fmt.ms(s.avgReaction) : '—'}</td>
        <td class="num">${fmt.dur(s.durationMs)}</td>
      </tr>`;
    })
    .join('');
  container.innerHTML = `<table class="history">
    <thead><tr><th>When</th><th>Mode</th><th>Accuracy</th><th>Switches</th><th>Avg RT</th><th>Time</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

/* ============================================================
   statistics
   ============================================================ */

const shortDate = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

function renderStats() {
  const s = store.overallStats();
  const rec = state.records;

  if (el.statStrip) {
    const tiles = [
      { label: 'Total switches', value: fmt.int(s.switches), sub: plural(s.sessions, 'session'), cls: '' },
      { label: 'Overall accuracy', value: s.accuracy === null ? '—' : fmt.pct(s.accuracy, 1), sub: `${fmt.int(s.correct)} correct · ${fmt.int(s.incorrect)} missed`, cls: 'gold' },
      { label: 'Average reaction', value: s.avgReaction ? fmt.ms(s.avgReaction) : '—', sub: `${fmt.int(s.judged)} judged`, cls: 'cyan' },
      { label: 'Time practised', value: fmt.dur(s.totalMs), sub: 'across all modes', cls: '' },
      { label: 'Longest streak', value: fmt.int(rec.bestStreak), sub: 'consecutive clean hits', cls: 'red' },
      { label: 'Best average', value: rec.bestAvgReaction ? fmt.ms(rec.bestAvgReaction) : '—', sub: 'minimum 15 targets', cls: 'gold' },
    ];
    el.statStrip.innerHTML = tiles
      .map((t) => `<div class="stat-tile ${t.cls}">
        <div class="st-label">${t.label}</div>
        <div class="st-value">${t.value}</div>
        <div class="st-sub">${t.sub}</div>
      </div>`)
      .join('');
  }

  const judged = state.sessions.filter((x) => x.accuracy !== null).slice(0, 20).reverse();
  lineChart(el.chartAccuracy, judged.map((x) => ({ v: x.accuracy, label: shortDate(x.ts) })), {
    min: 0, max: 100, color: '#7bd94a', tipFormat: (v) => fmt.pct(v, 0),
    yFormat: (v) => `${Math.round(v)}%`, aria: 'Accuracy over recent sessions',
    emptyText: 'Accuracy trend appears after your first judged session.',
  });

  const reactions = state.sessions.filter((x) => x.avgReaction).slice(0, 16).reverse();
  barChart(el.chartReaction, reactions.map((x) => ({ v: x.avgReaction, label: shortDate(x.ts) })), {
    color: '#ffc542', tipFormat: (v) => fmt.ms(v), yFormat: (v) => Math.round(v),
    aria: 'Average reaction time per session',
    emptyText: 'Reaction times are recorded once a target is hit.',
  });

  const volumes = state.sessions.slice(0, 16).reverse();
  barChart(el.chartVolume, volumes.map((x) => ({ v: x.switches, label: shortDate(x.ts) })), {
    color: '#4ae3d4', aria: 'Switches per session', yFormat: (v) => Math.round(v),
    emptyText: 'Switch volume appears after your first session.',
  });

  if (el.diffList) {
    const rows = DIFFICULTY_ORDER.map((id) => {
      const d = DIFFICULTIES[id];
      const list = state.sessions.filter((x) => x.difficulty === id && x.accuracy !== null);
      const best = list.reduce((acc, x) => Math.max(acc, x.accuracy), 0);
      const has = list.length > 0;
      const color = ['#7bd94a', '#a9e05a', '#ffc542', '#ff9a3c', '#ff5f4f'][DIFFICULTY_ORDER.indexOf(id)];
      return `<div class="diff-row">
        <span class="d-name">${d.name}</span>
        <span class="d-track"><span class="d-fill" style="width:${has ? best : 0}%;background:${color}"></span></span>
        <span class="d-val">${has ? fmt.pct(best, 0) : '—'}</span>
      </div>`;
    }).join('');
    const customCount = state.sessions.filter((x) => x.mode === 'custom').length;
    el.diffList.innerHTML = rows + `<div class="diff-empty">Custom drills: ${plural(customCount, 'session')} recorded</div>`;
  }

  renderHistory(el.historyWrapFull, state.sessions);
}

/* ============================================================
   settings view
   ============================================================ */

const TOGGLES = [
  { key: 'sfx', label: 'Sound effects', desc: 'Switch ticks, hit chimes and error buzz' },
  { key: 'animations', label: 'Animations', desc: 'Selection slide, item pops and screen transitions' },
  { key: 'particles', label: 'Particles', desc: 'Pixel bursts on hits and round clears' },
  { key: 'keyLabels', label: 'Key labels', desc: 'Show assigned keys beneath the hotbar' },
  { key: 'blockShortcuts', label: 'Block browser shortcuts', desc: 'Stop bound keys from scrolling or triggering browser actions' },
];

function renderSettings() {
  renderBindSettings();
  renderToggles();
  renderRanges();
  renderTheme();
  renderLoadout();
  renderPreviewHud(el.settingsPreview, 0.82);
  syncControls();
}

function renderToggles() {
  if (!el.toggleList) return;
  el.toggleList.innerHTML = TOGGLES.map((t) => `
    <label class="toggle-row">
      <span class="tl-text">${t.label}<small>${t.desc}</small></span>
      <input type="checkbox" data-toggle="${t.key}" ${state.settings[t.key] ? 'checked' : ''} />
      <span class="switch" aria-hidden="true"></span>
    </label>`).join('');
}

function renderRanges() {
  if (el.volumeRange) {
    el.volumeRange.value = String(Math.round(state.settings.volume * 100));
    if (el.volumeOut) el.volumeOut.textContent = `${Math.round(state.settings.volume * 100)}%`;
  }
  if (el.hudScaleRange) {
    el.hudScaleRange.value = String(Math.round(state.settings.hudScale * 100));
    if (el.hudScaleOut) el.hudScaleOut.textContent = `${Math.round(state.settings.hudScale * 100)}%`;
  }
}

function renderTheme() {
  if (!el.themeSegmented) return;
  $$('button[data-theme-value]', el.themeSegmented).forEach((btn) => {
    btn.classList.toggle('is-on', btn.dataset.themeValue === state.settings.theme);
  });
}

function renderBindSettings() {
  renderBindGrid();
  renderActionBinds();
  renderDuplicates();
}

function renderBindGrid() {
  if (!el.bindGrid) return;
  el.bindGrid.innerHTML = state.binds.slots.map((bind, slot) => `
    <button class="bind-slot" data-bind-slot="${slot}" type="button" title="Click to rebind slot ${slot + 1}">
      <span class="bind-icon">${pxIcon(state.loadout[slot])}</span>
      <span class="bind-meta">
        <span class="bind-slot-label">Slot ${slot + 1}</span>
        <span class="bind-item-name">${esc(itemName(state.loadout[slot]))}</span>
      </span>
      <span class="bind-chip">${fmt.escape(bindLabel(bind))}</span>
    </button>`).join('');
}

function renderActionBinds() {
  if (!el.actionBinds) return;
  el.actionBinds.innerHTML = ACTION_DEFS.map((def) => {
    const bind = state.binds.actions[def.id];
    return `<div class="bind-row" data-bind-action-row="${def.id}">
      <span class="br-label">${def.label}<small>${def.desc}</small></span>
      <button class="br-bind" data-bind-action="${def.id}" type="button">${bind ? fmt.escape(bindLabel(bind)) : 'Unassigned'}</button>
      <button class="br-unbind" data-unbind-action="${def.id}" type="button" title="Unbind" aria-label="Unbind ${def.label}">✕</button>
    </div>`;
  }).join('');
}

function renderDuplicates() {
  const dups = store.findDuplicates();
  if (!el.bindWarning) return;
  if (!dups.length) {
    el.bindWarning.hidden = true;
    el.bindWarning.innerHTML = '';
    return;
  }
  el.bindWarning.hidden = false;
  el.bindWarning.innerHTML = `<strong>Duplicate keybinds detected</strong>${dups
    .map((d) => `<div>${fmt.escape(bindLabel(d.bind))} is assigned to ${d.owners.length} controls — reassign one of them.</div>`)
    .join('')}`;
}

function beginCapture(kind, key, targetEl) {
  if (!targetEl) return;
  if (hub.capture) hub.cancelCapture();
  targetEl.classList.add('is-capturing');
  const chip = targetEl.querySelector('.bind-chip, .br-bind');
  const previous = chip ? chip.textContent : '';
  if (chip) chip.textContent = 'PRESS…';

  hub.startCapture((result) => {
    targetEl.classList.remove('is-capturing');
    if (result.cancelled) {
      if (chip) chip.textContent = previous;
      return;
    }
    if (result.error) {
      toast(result.error, 'error', 4200);
      renderBindSettings();
      return;
    }
    if (kind === 'slot') assignSlotBind(key, result.id);
    else assignActionBind(key, result.id);
    renderBindSettings();
  });
}

function assignSlotBind(slot, bindId) {
  const owner = state.binds.slots.indexOf(bindId);
  if (owner === slot) {
    toast(`Slot ${slot + 1} already uses ${bindLabel(bindId)}.`, 'info', 2000);
    return;
  }
  const actionOwner = ACTION_DEFS.find((d) => state.binds.actions[d.id] === bindId);
  if (actionOwner) {
    // slots must always keep a binding, actions are optional: the slot wins
    state.binds.actions[actionOwner.id] = null;
    state.binds.slots[slot] = bindId;
    store.save();
    audio.ui();
    toast(`${bindLabel(bindId)} moved to Slot ${slot + 1} and unbound from “${actionOwner.label}”.`, 'warn', 4200);
    afterBindsChanged();
    return;
  }
  if (owner >= 0) {
    const previous = state.binds.slots[slot];
    state.binds.slots[slot] = bindId;
    state.binds.slots[owner] = previous;
    store.save();
    audio.ui();
    toast(`Duplicate prevented — ${bindLabel(bindId)} swapped with Slot ${owner + 1}.`, 'warn', 3800);
  } else {
    state.binds.slots[slot] = bindId;
    store.save();
    audio.ui();
    toast(`Slot ${slot + 1} → ${bindLabel(bindId)}`, 'ok', 1800);
  }
  afterBindsChanged();
}

function assignActionBind(actionId, bindId) {
  const slotOwner = state.binds.slots.indexOf(bindId);
  if (slotOwner >= 0) {
    toast(`${bindLabel(bindId)} is already used by Slot ${slotOwner + 1}. Change that slot first.`, 'error', 4600);
    return;
  }
  const other = ACTION_DEFS.find((d) => d.id !== actionId && state.binds.actions[d.id] === bindId);
  if (other) {
    const previous = state.binds.actions[actionId] || null;
    state.binds.actions[actionId] = bindId;
    state.binds.actions[other.id] = previous;
    store.save();
    audio.ui();
    toast(`Duplicate prevented — swapped with “${other.label}”.`, 'warn', 3800);
  } else {
    state.binds.actions[actionId] = bindId;
    store.save();
    audio.ui();
    toast(`Action bound to ${bindLabel(bindId)}`, 'ok', 1800);
  }
  afterBindsChanged();
}

function afterBindsChanged() {
  hud.refreshKeys();
  renderBindGrid();
  renderActionBinds();
  renderDuplicates();
  if (el.arenaHintBar) renderArenaHints();
  if (el.previewKeys) {
    el.previewKeys.innerHTML = state.binds.slots.map((b, i) => `<span title="Slot ${i + 1}">${fmt.escape(bindLabel(b, true))}</span>`).join('');
  }
}

function renderLoadout() {
  if (!el.loadout) return;
  el.loadout.innerHTML = state.loadout.map((id, i) => `
    <div class="slot-pick ${i === loadoutSlot ? 'is-active' : ''}" data-loadout-slot="${i}" title="${itemName(id)} — slot ${i + 1}">
      <span class="lp-index">${i + 1}</span>
      ${pxIcon(id)}
    </div>`).join('');
  if (el.itemPicker) {
    el.itemPicker.innerHTML = `<div class="item-picker-hint">Slot ${loadoutSlot + 1} selected — choose an item to load into it.</div>` +
      ITEM_IDS.map((id) => `<button class="item-chip ${state.loadout[loadoutSlot] === id ? 'is-on' : ''}" data-item="${id}" type="button">
        <span class="ic">${pxIcon(id)}</span>${ITEMS[id].name}
      </button>`).join('');
  }
}

function syncControls() {
  if (el.volumeRange) {
    el.volumeRange.value = String(Math.round(state.settings.volume * 100));
    if (el.volumeOut) el.volumeOut.textContent = `${Math.round(state.settings.volume * 100)}%`;
  }
  if (el.hudScaleRange) {
    el.hudScaleRange.value = String(Math.round(state.settings.hudScale * 100));
    if (el.hudScaleOut) el.hudScaleOut.textContent = `${Math.round(state.settings.hudScale * 100)}%`;
  }
  renderTheme();
  renderToggles();
}

/* ============================================================
   navigation
   ============================================================ */

function navigateInternal(view) {
  const target = `view-${view}`;
  el.views.forEach((section) => section.classList.toggle('is-visible', section.id === target));
  $$('.navlink').forEach((btn) => {
    const match = view === 'arena'
      ? btn.dataset.view === sessionMode
      : btn.dataset.view === view;
    btn.classList.toggle('is-active', !!match);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'arena') {
    requestAnimationFrame(() => {
      hud.layout();
      field.resize();
    });
  }
}

function guardSession(next) {
  if (!trainer || !trainer.running) {
    next();
    return;
  }
  if (trainer.paused) {
    endSession({ silent: true });
    next();
    return;
  }
  openModal({
    eyebrow: 'Session active',
    title: 'Leave this session?',
    body: '<p>Your current run will be saved to your statistics before you leave.</p>',
    actions: [
      { label: 'Keep practising', style: 'btn-primary' },
      {
        label: 'End & save',
        style: 'btn-danger',
        onClick: () => {
          endSession({ silent: true });
          next();
        },
      },
    ],
  });
}

function navigate(view) {
  if (view === 'arena') {
    navigateInternal('arena');
    return;
  }
  guardSession(() => navigateInternal(view));
  if (view === 'dashboard') renderDashboard();
  if (view === 'stats') renderStats();
  if (view === 'settings') renderSettings();
}

function openSetup(mode) {
  guardSession(() => enterSetup(mode));
}

function enterSetup(mode) {
  cancelCountdown();
  if (trainer && trainer.running) trainer.finish();
  trainer = null;
  sessionMode = mode;
  sessionConfig = null;
  sessionFinished = false;

  if (mode === 'training') {
    setupState = { mode, difficulty: state.config.difficulty || 'normal' };
  } else if (mode === 'freestyle') {
    setupState = { mode, freestyle: { ...state.config.freestyle } };
  } else if (mode === 'tenhearts') {
    setupState = { mode, tenhearts: { ...state.config.tenhearts } };
  } else {
    setupState = { mode, custom: { ...state.config.custom, slots: [...state.config.custom.slots] } };
  }

  navigateInternal('arena');
  renderArenaChrome(mode, setupState);
  hud.setXP(1, 0);
  hud.setTarget(null);
  hud.select(0, { animate: false });
  overlayState = 'setup';
  renderSetupOverlay();
}

/* ============================================================
   setup overlay
   ============================================================ */

const esc = (v) => fmt.escape(String(v));
const plural = (n, word) => `${fmt.int(n)} ${word}${Number(n) === 1 ? '' : 's'}`;

function rangeRow({ label, hint, key, value, min, max, step, unit = 'ms', scope = 'custom' }) {
  return `<div class="opt-row">
    <span class="or-text">${label}${hint ? `<small>${hint}</small>` : ''}</span>
    <div class="range-inline">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}"
        data-setup-range="${key}" data-scope="${scope}" aria-label="${label}" />
      <output data-range-out="${key}">${value}${unit}</output>
    </div>
  </div>`;
}

function checkRow({ label, hint, key, checked, scope = 'custom' }) {
  return `<div class="opt-row">
    <span class="or-text">${label}${hint ? `<small>${hint}</small>` : ''}</span>
    <label class="toggle-row" style="padding:0;border:0;gap:0">
      <input type="checkbox" data-setup-check="${key}" data-scope="${scope}" ${checked ? 'checked' : ''} />
      <span class="switch" aria-hidden="true"></span>
    </label>
  </div>`;
}

function difficultyCards() {
  return `<div class="setup-grid">${DIFFICULTY_ORDER.map((id) => {
    const d = DIFFICULTIES[id];
    const on = setupState.difficulty === id ? 'is-on' : '';
    const bars = Array.from({ length: 5 }, (_, i) => `<i class="${i < d.bars ? 'on' : ''}"></i>`).join('');
    return `<button class="setup-card ${on}" data-difficulty="${id}" type="button">
      <div class="sc-top"><h4>${d.name}</h4><span class="sc-badge">${d.window} ms</span></div>
      <p>${d.blurb}</p>
      <div class="sc-bars">${bars}</div>
    </button>`;
  }).join('')}</div>
  <div class="overlay-note">
    <svg viewBox="0 0 24 24" class="uicon"><path d="M12 3l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 9v4.5M12 16.5h.01" stroke="currentColor" stroke-width="1.7"/></svg>
    <span>Difficulty ramps live: every cleared round shrinks the reaction window and lengthens the sequence. Miss-heavy rounds step back down.</span>
  </div>`;
}

function freestyleBody() {
  const f = setupState.freestyle;
  return `<div class="opt-list">
    ${checkRow({ label: 'Random switching challenges', hint: 'A target slot appears at random — hit it before it expires', key: 'challenge', checked: f.challenge, scope: 'freestyle' })}
    ${rangeRow({ label: 'Target interval', hint: 'Delay between challenges', key: 'rate', value: f.rate, min: 600, max: 4000, step: 50, scope: 'freestyle' })}
    ${rangeRow({ label: 'Target lifetime', hint: 'How long each target stays up', key: 'lifetime', value: f.lifetime, min: 800, max: 4000, step: 50, scope: 'freestyle' })}
  </div>
  <div class="overlay-note">
    <svg viewBox="0 0 24 24" class="uicon"><path d="M4 12a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 12l4-3" stroke="currentColor" stroke-width="1.8"/></svg>
    <span>Freestyle never forces a sequence: every slot is live and you can switch as fast as you like for as long as you like. Accuracy only counts judged targets. Hotbar items and keybinds live in Settings.</span>
  </div>`;
}

function tenheartsBody() {
  const t = setupState.tenhearts;
  return `<div class="setup-grid">
    <div class="setup-card is-on" style="cursor:default"><div class="sc-top"><h4>10 hearts</h4><span class="sc-badge">static</span></div><p>Exactly ten hearts on screen, all full. No damage and no regeneration.</p></div>
    <div class="setup-card is-on" style="cursor:default"><div class="sc-top"><h4>No timer</h4><span class="sc-badge">∞</span></div><p>No countdown and no time limit. Press “End session” whenever you are done.</p></div>
    <div class="setup-card is-on" style="cursor:default"><div class="sc-top"><h4>No hunger</h4><span class="sc-badge">full</span></div><p>The hunger bar never depletes — it is pure hotbar drilling.</p></div>
    <div class="setup-card is-on" style="cursor:default"><div class="sc-top"><h4>Endless</h4><span class="sc-badge">manual</span></div><p>Practice until you choose to stop. Your session is saved when you end it.</p></div>
  </div>
  <div class="opt-list" style="margin-top:10px">
    ${checkRow({ label: 'Show random targets', hint: 'Targets stay until you hit them — no countdown at all', key: 'challenge', checked: t.challenge !== false, scope: 'tenhearts' })}
    ${rangeRow({ label: 'Target interval', hint: 'Pause between targets', key: 'rate', value: t.rate, min: 600, max: 4000, step: 50, scope: 'tenhearts' })}
  </div>`;
}

function customBody() {
  const c = setupState.custom;
  const isSequence = c.mode !== 'freestyle';
  return `<div class="opt-list">
    <div class="opt-row">
      <span class="or-text">Drill type<small>${isSequence ? 'Chase the highlighted slot in order' : 'Free switching with optional targets'}</small></span>
      <div class="segmented">
        <button data-drill="sequence" class="${isSequence ? 'is-on' : ''}" type="button">Sequence</button>
        <button data-drill="freestyle" class="${!isSequence ? 'is-on' : ''}" type="button">Freestyle</button>
      </div>
    </div>
    ${isSequence ? rangeRow({ label: 'Reaction window', hint: 'Time allowed per target', key: 'window', value: c.window, min: 300, max: 4000, step: 50 }) : rangeRow({ label: 'Target lifetime', hint: 'How long each target stays up', key: 'lifetime', value: c.lifetime, min: 600, max: 4000, step: 50 })}
    ${isSequence ? rangeRow({ label: 'Sequence length', hint: 'Targets per round', key: 'length', value: c.length, min: 1, max: 10, step: 1, unit: '' }) : ''}
    ${isSequence ? rangeRow({ label: 'Gap between targets', hint: 'Breathing room after each hit', key: 'gap', value: c.gap, min: 0, max: 900, step: 20 }) : rangeRow({ label: 'Target interval', hint: 'Delay before the next target', key: 'rate', value: c.rate, min: 400, max: 4000, step: 50 })}
    <div class="opt-row">
      <span class="or-text">Jump pattern<small>How far the next target can be</small></span>
      <select data-setup-select="pool">
        <option value="near" ${c.pool === 'near' ? 'selected' : ''}>Adjacent slots</option>
        <option value="mixed" ${c.pool === 'mixed' ? 'selected' : ''}>Mixed distances</option>
        <option value="random" ${c.pool === 'random' ? 'selected' : ''}>Fully random</option>
      </select>
    </div>
    ${checkRow({ label: 'Progressive ramping', hint: 'Windows shrink and sequences grow as you clear rounds', key: 'ramp', checked: c.ramp })}
    ${!isSequence ? checkRow({ label: 'Random targets', hint: 'Throw in judged targets while you practise', key: 'challenge', checked: c.challenge !== false }) : ''}
  </div>
  <div class="field-block">
    <span class="field-label">Active slots — ${c.slots.length} of 9 selected (minimum 2)</span>
    <div class="slot-filter">
      ${Array.from({ length: SLOT_COUNT }, (_, i) => `<button type="button" data-filter-slot="${i}" class="${c.slots.includes(i) ? 'is-on' : ''}" title="Slot ${i + 1}: ${esc(bindLabel(state.binds.slots[i]))}">${i + 1}</button>`).join('')}
    </div>
  </div>`;
}

function setupBody() {
  if (setupState.mode === 'training') return difficultyCards();
  if (setupState.mode === 'freestyle') return freestyleBody();
  if (setupState.mode === 'tenhearts') return tenheartsBody();
  return customBody();
}

function setupDescription() {
  const m = setupState.mode;
  if (m === 'training') return 'Five tiers, live progression. Pick the tier that matches your current muscle memory.';
  if (m === 'freestyle') return 'Nine slots, no sequence, no limits. Warm up or chase random targets.';
  if (m === 'tenhearts') return 'A Minecraft-style endurance drill with exactly ten hearts and no timer at all.';
  return 'Build the drill you actually want: choose slots, windows, sequence length and ramping.';
}

function renderSetupOverlay() {
  overlayState = 'setup';
  const meta = MODE_META[setupState.mode];
  const html = `<div class="overlay-card">
    <div class="overlay-head">
      <div>
        <span class="overlay-eyebrow">${meta.label}</span>
        <h3>${setupState.mode === 'training' ? 'Choose difficulty' : 'Configure session'}</h3>
        <p class="oh-sub">${setupDescription()}</p>
      </div>
      <span class="mode-chip">${setupState.mode === 'tenhearts' ? 'No timer' : 'Setup'}</span>
    </div>
    <div class="overlay-body">${setupBody()}</div>
    <div class="overlay-foot">
      <button class="btn btn-ghost" data-setup="cancel" type="button">Back to dashboard</button>
      <button class="btn btn-primary" data-setup="start" type="button">Start session</button>
    </div>
  </div>`;
  showOverlay(html);
  renderArenaChrome(setupState.mode, setupState);
  cueIdle('start');
}

function showOverlay(html) {
  el.arenaOverlay.innerHTML = html;
  el.arenaOverlay.hidden = false;
  document.body.classList.add('overlay-open');
  el.arenaOverlay.scrollTop = 0;
}

function hideOverlay() {
  el.arenaOverlay.hidden = true;
  el.arenaOverlay.innerHTML = '';
  document.body.classList.remove('overlay-open');
  overlayState = null;
}

function onSetupInput(event) {
  if (overlayState !== 'setup' || !setupState) return;
  const input = event.target;
  if (input.matches('[data-setup-range]')) {
    const key = input.dataset.setupRange;
    const scope = input.dataset.scope;
    const value = Number(input.value);
    const bucket = scope === 'custom' ? setupState.custom : setupState[scope];
    if (!bucket) return;
    bucket[key] = value;
    const out = el.arenaOverlay.querySelector(`[data-range-out="${key}"]`);
    if (out) out.textContent = `${value}${key === 'length' ? '' : 'ms'}`;
  }
  if (input.matches('[data-setup-select]')) {
    setupState.custom[input.dataset.setupSelect] = input.value;
  }
}

function onSetupChange(event) {
  if (overlayState !== 'setup' || !setupState) return;
  const input = event.target;
  if (input.matches('[data-setup-check]')) {
    const key = input.dataset.setupCheck;
    const scope = input.dataset.scope;
    const bucket = scope === 'custom' ? setupState.custom : setupState[scope];
    if (bucket) bucket[key] = input.checked;
    if (scope === 'freestyle' && key === 'challenge') renderArenaChrome('freestyle', setupState);
  }
}

function onSetupClick(event) {
  if (overlayState !== 'setup' || !setupState) return;
  const t = event.target;

  if (t.closest('[data-setup="cancel"]')) {
    hideOverlay();
    trainer = null;
    navigateInternal('dashboard');
    renderDashboard();
    return;
  }
  if (t.closest('[data-setup="start"]')) {
    startFromSetup();
    return;
  }
  const diff = t.closest('[data-difficulty]');
  if (diff) {
    setupState.difficulty = diff.dataset.difficulty;
    renderSetupOverlay();
    return;
  }
  const drill = t.closest('[data-drill]');
  if (drill) {
    setupState.custom.mode = drill.dataset.drill;
    renderSetupOverlay();
    return;
  }
  const filter = t.closest('[data-filter-slot]');
  if (filter) {
    const slot = Number(filter.dataset.filterSlot);
    const slots = new Set(setupState.custom.slots);
    if (slots.has(slot)) {
      if (slots.size <= 2) {
        toast('Keep at least two active slots.', 'warn', 2600);
        return;
      }
      slots.delete(slot);
    } else {
      slots.add(slot);
    }
    setupState.custom.slots = [...slots].sort((a, b) => a - b);
    renderSetupOverlay();
  }
}

function startFromSetup() {
  if (!setupState) return;
  const mode = setupState.mode;
  const cfg = { mode };

  if (mode === 'training') {
    cfg.difficulty = setupState.difficulty;
    state.config.difficulty = setupState.difficulty;
  } else if (mode === 'freestyle') {
    cfg.freestyle = { ...setupState.freestyle };
    state.config.freestyle = { ...setupState.freestyle };
  } else if (mode === 'tenhearts') {
    cfg.tenhearts = { ...setupState.tenhearts };
    state.config.tenhearts = { ...setupState.tenhearts };
  } else {
    cfg.custom = { ...setupState.custom, slots: [...setupState.custom.slots] };
    state.config.custom = { ...setupState.custom, slots: [...setupState.custom.slots] };
  }
  store.save();
  startSession(mode, cfg);
}

/* ============================================================
   arena chrome
   ============================================================ */

function renderArenaChrome(mode, cfg = {}) {
  const meta = MODE_META[mode] || MODE_META.freestyle;
  if (el.arenaModeName) el.arenaModeName.textContent = meta.label;
  if (el.arenaSub) {
    let sub = meta.sub;
    if (mode === 'training' && cfg.difficulty) {
      sub = `${DIFFICULTIES[cfg.difficulty].name} · ${DIFFICULTIES[cfg.difficulty].window} ms base window`;
    }
    el.arenaSub.textContent = sub;
  }

  if (el.arenaChips) {
    const noTimer = mode === 'tenhearts';
    el.arenaChips.innerHTML = [
      noTimer
        ? `<span class="chip" data-chip="time">Timer <b>∞</b></span>`
        : `<span class="chip is-live" data-chip="time">Time <b>00:00</b></span>`,
      `<span class="chip" data-chip="switches">Switches <b>0</b></span>`,
      `<span class="chip" data-chip="acc">Accuracy <b>—</b></span>`,
      `<span class="chip" data-chip="rt">Avg RT <b>—</b></span>`,
      `<span class="chip is-warn" data-chip="streak">Streak <b>0</b></span>`,
    ].join('');
    chipEls = {
      time: el.arenaChips.querySelector('[data-chip="time"] b'),
      switches: el.arenaChips.querySelector('[data-chip="switches"] b'),
      acc: el.arenaChips.querySelector('[data-chip="acc"] b'),
      rt: el.arenaChips.querySelector('[data-chip="rt"] b'),
      streak: el.arenaChips.querySelector('[data-chip="streak"] b'),
      timeChip: el.arenaChips.querySelector('[data-chip="time"]'),
      accChip: el.arenaChips.querySelector('[data-chip="acc"]'),
    };
  }

  if (el.arenaSide) {
    const showRounds = mode === 'training' || mode === 'custom';
    el.arenaSide.innerHTML = `
      <div class="side-acc">
        <div class="sa-head"><span>Accuracy</span><b data-side="acc">—</b></div>
        <div class="sa-track"><div class="sa-fill" data-side-fill></div></div>
      </div>
      <div class="side-divider"></div>
      <div class="side-row"><span class="sr-label">Switches</span><b class="sr-val" data-side="switches">0</b></div>
      <div class="side-row"><span class="sr-label">Correct</span><b class="sr-val good" data-side="correct">0</b></div>
      <div class="side-row"><span class="sr-label">Missed</span><b class="sr-val bad" data-side="incorrect">0</b></div>
      <div class="side-row"><span class="sr-label">Avg reaction</span><b class="sr-val" data-side="avg">—</b></div>
      <div class="side-row"><span class="sr-label">Fastest</span><b class="sr-val gold" data-side="fastest">—</b></div>
      <div class="side-row"><span class="sr-label">Best streak</span><b class="sr-val" data-side="best">0</b></div>
      <div class="side-row"><span class="sr-label">Level</span><b class="sr-val" data-side="level">1</b></div>
      ${showRounds ? `<div class="side-row"><span class="sr-label">Rounds</span><b class="sr-val" data-side="rounds">0</b></div>` : ''}
    `;
    sideEls = {
      acc: el.arenaSide.querySelector('[data-side="acc"]'),
      accFill: el.arenaSide.querySelector('[data-side-fill]'),
      switches: el.arenaSide.querySelector('[data-side="switches"]'),
      correct: el.arenaSide.querySelector('[data-side="correct"]'),
      incorrect: el.arenaSide.querySelector('[data-side="incorrect"]'),
      avg: el.arenaSide.querySelector('[data-side="avg"]'),
      fastest: el.arenaSide.querySelector('[data-side="fastest"]'),
      best: el.arenaSide.querySelector('[data-side="best"]'),
      level: el.arenaSide.querySelector('[data-side="level"]'),
      rounds: el.arenaSide.querySelector('[data-side="rounds"]'),
    };
  }

  renderArenaHints();
  el.arenaRoot.classList.remove('is-live');
  paintSession({
    elapsed: 0, switches: 0, accuracy: null, avgReaction: null, streak: 0, bestStreak: 0,
    level: 1, xp: 0, rounds: 0, correct: 0, incorrect: 0, fastestReaction: null,
    windowRemaining: null, windowMs: null, noTimer: mode === 'tenhearts',
  }, true);
}

function renderArenaHints() {
  if (!el.arenaHintBar) return;
  const s1 = bindLabel(state.binds.slots[0], true);
  const s9 = bindLabel(state.binds.slots[8], true);
  const prev = bindLabel(state.binds.actions.prev, true);
  const next = bindLabel(state.binds.actions.next, true);
  el.arenaHintBar.innerHTML = `
    <div class="hb-row"><kbd>${esc(s1)}</kbd><kbd>${esc(s9)}</kbd> hotbar slots</div>
    <div class="hb-row"><kbd>${esc(prev)}</kbd><kbd>${esc(next)}</kbd> cycle slots</div>
    <div class="hb-row"><kbd>ESC</kbd> pause · end session</div>`;
}

/* ============================================================
   cue text
   ============================================================ */

function cueSet({ label, prompt, hint }) {
  el.cueLabel.innerHTML = label;
  el.cuePrompt.innerHTML = prompt;
  el.cueHint.innerHTML = hint;
  el.cueLayer.classList.remove('is-idle');
}

function cueIdle(kind = 'free') {
  const mode = trainer ? trainer.config.mode : sessionMode;
  const challengeOn = trainer ? trainer.challenge : !!(setupState && (setupState.freestyle?.challenge || setupState.tenhearts?.challenge || setupState.custom?.challenge));

  const map = {
    start: {
      label: mode === 'tenhearts' ? '10-HEART MODE' : 'GET READY',
      prompt: mode === 'tenhearts' ? 'No timer' : 'Ready up',
      hint: 'Press Start session to begin',
    },
    free: {
      label: mode === 'tenhearts' ? '10-HEART MODE' : 'FREESTYLE',
      prompt: 'Switch freely',
      hint: mode === 'tenhearts'
        ? 'Ten hearts · no timer · end when you want'
        : challengeOn ? 'A random target will appear…' : 'All nine slots · no rules · unlimited',
    },
    ready: {
      label: 'TARGET',
      prompt: '…',
      hint: 'Next target incoming',
    },
    missed: {
      label: 'MISSED',
      prompt: '—',
      hint: 'Next target incoming',
    },
    round: {
      label: 'ROUND CLEAR',
      prompt: 'Nice',
      hint: 'New sequence loading',
    },
  };
  const c = map[kind] || map.free;
  cueSet(c);
  el.cueLayer.classList.add('is-idle');
  el.cueWindow.hidden = true;
}

/* ============================================================
   session lifecycle
   ============================================================ */

function startSession(mode, cfg) {
  cancelCountdown();
  if (trainer && trainer.running) trainer.finish();
  hideOverlay();
  sessionFinished = false;
  sessionMode = mode;
  sessionConfig = { ...cfg };
  lastConfig = { mode, cfg: { ...cfg } };

  trainer = new Trainer({
    mode,
    difficulty: cfg.difficulty || state.config.difficulty,
    custom: cfg.custom || state.config.custom,
    freestyle: cfg.freestyle || state.config.freestyle,
    tenhearts: cfg.tenhearts || state.config.tenhearts,
  }, sessionCallbacks());

  renderArenaChrome(mode, cfg);
  hud.setTarget(null);
  hud.setXP(1, 0);
  hud.select(0, { animate: false });
  el.arenaRoot.classList.remove('is-live');
  requestAnimationFrame(() => field.resize());

  startCountdown(() => {
    if (!trainer) return;
    el.arenaRoot.classList.add('is-live');
    trainer.start();
    audio.start();
  });
}

function startCountdown(done) {
  countdownActive = true;
  const steps = ['3', '2', '1', 'GO'];
  let i = 0;
  const step = () => {
    if (!countdownActive) return;
    if (i >= steps.length) {
      countdownActive = false;
      done();
      return;
    }
    const value = steps[i];
    cueSet({
      label: 'GET READY',
      prompt: `<span class="cue-keycap is-gold">${value}</span>`,
      hint: 'Keys are live',
    });
    el.cueWindow.hidden = true;
    audio.cue();
    i += 1;
    countdownTimers.push(setTimeout(step, 380));
  };
  step();
}

function cancelCountdown() {
  countdownActive = false;
  countdownTimers.forEach(clearTimeout);
  countdownTimers = [];
}

function sessionCallbacks() {
  return {
    onStart(snap) {
      paintSession(snap, true);
      if (!snap.target) cueIdle('free');
    },
    onCue(info) {
      showCueForTarget(info.slot, info.index, info.length, info.windowMs);
      hud.setTarget(info.slot);
      audio.cue();
    },
    onSwitch() {},
    onHit(info) {
      el.cueLayer.classList.remove('is-miss');
      el.cueLayer.classList.add('is-hit');
      setTimeout(() => el.cueLayer.classList.remove('is-hit'), 190);
      flashHitmarker();
      burstAtSlot(info.slot, 'success');
      audio.success(info.streak);
      if (info.streak > 0 && info.streak % 5 === 0) showStreak(`${info.streak} STREAK`);
      hud.setTarget(null);
      const seq = trainer && trainer.usesSequence;
      if (!seq) cueIdle('free');
    },
    onWrong(info) {
      hud.flashSlot(info.slot);
      flashMissScreen();
      audio.error();
      el.cueLayer.classList.add('is-miss');
      setTimeout(() => el.cueLayer.classList.remove('is-miss'), 320);
      const c = hud.slotCenter(info.slot);
      if (c) {
        const r = el.fxCanvas.getBoundingClientRect();
        field.wrong(c.x - r.left, c.y - r.top);
      }
    },
    onMiss(info) {
      audio.miss();
      flashMissScreen();
      hud.setTarget(null);
      if (info.target !== undefined && info.target !== null) hud.flashSlot(info.target);
      cueIdle('missed');
    },
    onRound(info) {
      audio.roundClear();
      field.celebrate();
      field.rain();
      showStreak(`ROUND ${info.round} CLEAR`);
      cueIdle('round');
    },
    onLevel() {
      audio.levelUp();
      hud.pulseHearts();
    },
    onCombo(info) {
      showStreak(`${info.streak} STREAK`);
      hud.pulseHearts();
    },
    onTick(snap) {
      paintSession(snap);
    },
    onFinish(summary) {
      finishSession(summary);
    },
    onPause() {},
    onResume() {},
  };
}

function showCueForTarget(slot, index, length, windowMs) {
  const keyLabel = bindLabel(state.binds.slots[slot]);
  const long = keyLabel.length > 5 ? 'is-small' : '';
  const diff = sessionConfig && sessionConfig.difficulty
    ? `<span class="cue-diff">${DIFFICULTIES[sessionConfig.difficulty].name}</span>`
    : '';
  const label = trainer && trainer.usesSequence
    ? `TARGET ${Math.min(index + 1, length || 1)}/${length || 1}${diff}`
    : `TARGET${diff}`;
  cueSet({
    label,
    prompt: `<span class="cue-keycap ${long}">${esc(keyLabel)}</span>${pxIcon(state.loadout[slot], 'cue-item')}<span class="cue-slot">SLOT ${slot + 1}</span>`,
    hint: Number.isFinite(windowMs) ? `Hit it within ${Math.round(windowMs)} ms` : 'No timer — take your time',
  });
  el.cueWindow.hidden = !Number.isFinite(windowMs);
  el.cueWindow.classList.remove('is-urgent');
  if (Number.isFinite(windowMs)) el.cueWindowFill.style.transform = 'scaleX(1)';
}

function flashHitmarker() {
  el.hitmarker.classList.remove('is-on');
  void el.hitmarker.offsetWidth;
  el.hitmarker.classList.add('is-on');
}

function flashMissScreen() {
  el.arenaRoot.classList.remove('is-miss');
  void el.arenaRoot.offsetWidth;
  el.arenaRoot.classList.add('is-miss');
  clearTimeout(missFlashTimer);
  missFlashTimer = setTimeout(() => el.arenaRoot.classList.remove('is-miss'), 430);
}

function showStreak(text) {
  if (!el.streakPop) return;
  el.streakPop.textContent = text;
  el.streakPop.classList.remove('is-on');
  void el.streakPop.offsetWidth;
  el.streakPop.classList.add('is-on');
  clearTimeout(el.streakPop._t);
  el.streakPop._t = setTimeout(() => el.streakPop.classList.remove('is-on'), 900);
}

function burstAtSlot(slot, kind) {
  const c = hud.slotCenter(slot);
  if (!c) return;
  const r = el.fxCanvas.getBoundingClientRect();
  const x = c.x - r.left;
  const y = c.y - r.top;
  if (kind === 'success') field.success(x, y);
  else field.wrong(x, y);
}

/* ---------------- painting ---------------- */

function setVal(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function paintSession(snap, force = false) {
  if (!snap) return;
  const now = performance.now();
  const numbersDue = force || now - paintLast > 90;

  // window bar every frame (cheap transform only)
  if (snap.windowRemaining !== null && Number.isFinite(snap.windowRemaining) && Number.isFinite(snap.windowMs) && snap.windowMs > 0) {
    const ratio = Math.max(0, Math.min(1, snap.windowRemaining / snap.windowMs));
    el.cueWindowFill.style.transform = `scaleX(${ratio.toFixed(3)})`;
    el.cueWindow.classList.toggle('is-urgent', ratio < 0.32);
  }

  if (!numbersDue) return;
  paintLast = now;

  if (trainer && trainer.running && now - lastRecoveryAt > 4000) {
    lastRecoveryAt = now;
    if (trainer.switches > 0) store.saveRecovery(trainer.summary());
  }

  setVal(chipEls.switches, fmt.int(snap.switches));
  setVal(chipEls.acc, snap.accuracy === null ? '—' : fmt.pct(snap.accuracy, 0));
  setVal(chipEls.rt, snap.avgReaction ? fmt.ms(snap.avgReaction) : '—');
  setVal(chipEls.streak, fmt.int(snap.streak));
  if (chipEls.time) setVal(chipEls.time, snap.noTimer ? '∞' : fmt.clock(snap.elapsed));
  if (chipEls.accChip) {
    chipEls.accChip.classList.toggle('is-bad', snap.accuracy !== null && snap.accuracy < 70);
    chipEls.accChip.classList.toggle('is-live', snap.accuracy !== null && snap.accuracy >= 90);
  }

  setVal(sideEls.switches, fmt.int(snap.switches));
  setVal(sideEls.correct, fmt.int(snap.correct));
  setVal(sideEls.incorrect, fmt.int(snap.incorrect));
  setVal(sideEls.avg, snap.avgReaction ? fmt.ms(snap.avgReaction) : '—');
  setVal(sideEls.fastest, snap.fastestReaction ? fmt.ms(snap.fastestReaction) : '—');
  setVal(sideEls.best, fmt.int(snap.bestStreak));
  setVal(sideEls.level, String(snap.level));
  if (sideEls.rounds) setVal(sideEls.rounds, fmt.int(snap.rounds));
  setVal(sideEls.acc, snap.accuracy === null ? '—' : fmt.pct(snap.accuracy, 0));
  if (sideEls.accFill) {
    const pct = snap.accuracy === null ? 0 : Math.max(0, Math.min(100, snap.accuracy));
    sideEls.accFill.style.width = `${pct}%`;
    sideEls.accFill.classList.toggle('low', snap.accuracy !== null && snap.accuracy < 70);
    sideEls.accFill.classList.toggle('mid', snap.accuracy !== null && snap.accuracy >= 70 && snap.accuracy < 90);
  }

  hud.setXP(snap.level, snap.xp);
}

/* ---------------- pause / end / summary ---------------- */

function pauseSession() {
  if (!trainer || !trainer.running || trainer.paused) return;
  trainer.pause();
  overlayState = 'pause';
  showOverlay(`<div class="overlay-card">
    <div class="overlay-head">
      <div>
        <span class="overlay-eyebrow">Paused</span>
        <h3>${MODE_META[sessionMode].label}</h3>
        <p class="oh-sub">Take your time — the reaction window is frozen exactly where you left it.</p>
      </div>
    </div>
    <div class="overlay-body">
      <div class="sum-grid">
        <div class="sum-cell"><div class="sl">Switches</div><div class="sv">${fmt.int(trainer.switches)}</div></div>
        <div class="sum-cell"><div class="sl">Accuracy</div><div class="sv">${trainer.accuracy() === null ? '—' : fmt.pct(trainer.accuracy(), 0)}</div></div>
        <div class="sum-cell"><div class="sl">Session</div><div class="sv">${trainer.config.mode === 'tenhearts' ? 'no timer' : fmt.clock(trainer.elapsed())}</div></div>
      </div>
    </div>
    <div class="overlay-foot">
      <button class="btn btn-danger" data-overlay="end" type="button">End session</button>
      <button class="btn btn-primary" data-overlay="resume" type="button">Resume</button>
    </div>
  </div>`);
}

function resumeSession() {
  if (!trainer || !trainer.running) return;
  hideOverlay();
  trainer.resume();
  audio.start();
}

function endSession({ silent = false } = {}) {
  if (countdownActive) {
    cancelCountdown();
    const mode = sessionMode || 'freestyle';
    trainer = null;
    if (!silent) enterSetup(mode);
    return;
  }
  if (!trainer) {
    if (!silent) navigateInternal('dashboard');
    return;
  }
  if (!trainer.running) {
    hideOverlay();
    if (!silent) navigateInternal('dashboard');
    return;
  }
  suppressSummary = silent;
  const summary = trainer.finish();
  suppressSummary = false;
  if (!summary) {
    hideOverlay();
    if (!silent) navigateInternal('dashboard');
  }
}

function finishSession(summary) {
  if (sessionFinished) return;
  sessionFinished = true;
  cancelCountdown();
  store.clearRecovery();
  el.arenaRoot.classList.remove('is-live');
  hud.setTarget(null);
  const { entry, beaten } = store.pushSession(summary);
  renderDashboard();
  renderStats();
  if (suppressSummary) {
    hideOverlay();
    return;
  }
  audio.finish();
  showSummary(summary, beaten);
}

const sumCell = (label, value, unit = '') =>
  `<div class="sum-cell"><div class="sl">${label}</div><div class="sv">${value}${unit ? `<small>${unit}</small>` : ''}</div></div>`;

function showSummary(summary, beaten) {
  overlayState = 'summary';
  const meta = MODE_META[summary.mode];
  const diffName = summary.difficulty ? DIFFICULTIES[summary.difficulty].name : null;
  const avg = summary.avgReaction;
  const acc = summary.accuracy;
  const headline = summary.switches === 0
    ? 'No switches recorded — every key press in a live session counts.'
    : `${fmt.int(summary.switches)} switches · ${fmt.dur(summary.durationMs)} · ${summary.usesSequence ? `${summary.rounds} round${summary.rounds === 1 ? '' : 's'} cleared` : 'freestyle run'}`;

  showOverlay(`<div class="overlay-card">
    <div class="overlay-head">
      <div>
        <span class="overlay-eyebrow">Session complete</span>
        <h3>${meta.label}${diffName ? ` · ${diffName}` : ''}</h3>
        <p class="oh-sub">${headline}</p>
      </div>
      ${beaten.length ? `<span class="summary-badge">${beaten.length} record${beaten.length === 1 ? '' : 's'}!</span>` : `<span class="summary-badge">Saved</span>`}
    </div>
    <div class="overlay-body">
      <div class="sum-hl">
        ${pxIcon(acc !== null && acc >= 90 ? 'diamond' : acc !== null && acc >= 70 ? 'apple' : 'cobble')}
        <div>
          <strong>${acc === null ? 'Unjudged session' : acc >= 90 ? 'Laser accurate' : acc >= 70 ? 'Solid accuracy' : 'Room to sharpen'}</strong>
          <span>${acc === null ? 'Enable targets or a sequence to score accuracy.' : `You judged ${fmt.int(summary.correct + summary.incorrect)} targets with ${fmt.pct(acc, 1)} accuracy.`}</span>
        </div>
      </div>
      <div class="sum-grid">
        ${sumCell('Accuracy', acc === null ? '—' : acc.toFixed(1), acc === null ? '' : '%')}
        ${sumCell('Avg reaction', avg ? Math.round(avg) : '—', avg ? 'ms' : '')}
        ${sumCell('Fastest switch', summary.fastestReaction ? Math.round(summary.fastestReaction) : '—', summary.fastestReaction ? 'ms' : '')}
        ${sumCell('Correct', fmt.int(summary.correct))}
        ${sumCell('Missed', fmt.int(summary.incorrect))}
        ${sumCell('Best streak', fmt.int(summary.bestStreak))}
        ${sumCell('Rounds', fmt.int(summary.rounds))}
        ${sumCell('Fastest sequence', summary.fastestRound ? fmt.dur(summary.fastestRound) : '—')}
        ${sumCell('Level', fmt.int(summary.level))}
        ${sumCell('Time', summary.mode === 'tenhearts' ? '∞' : fmt.clock(summary.durationMs))}
      </div>
      ${beaten.length ? `<div class="pr-flags">${beaten.map((b) => `<span class="pr-flag">${b}</span>`).join('')}</div>` : ''}
    </div>
    <div class="overlay-foot">
      <button class="btn btn-ghost" data-overlay="dashboard" type="button">Dashboard</button>
      <button class="btn btn-ghost" data-overlay="again" type="button">Play again</button>
      <button class="btn btn-primary" data-overlay="setup" type="button">New drill</button>
    </div>
  </div>`);
}

/* ============================================================
   input handling
   ============================================================ */

function slotForBind(bindId) {
  return state.binds.slots.indexOf(bindId);
}

function actionForBind(bindId) {
  return Object.keys(state.binds.actions).find((key) => state.binds.actions[key] === bindId) || null;
}

hub.onGameBind = (bindId) => {
  const slot = slotForBind(bindId);
  if (slot >= 0) {
    pressSlot(slot);
    return true;
  }
  const action = actionForBind(bindId);
  if (action) {
    pressAction(action);
    return true;
  }
  return false;
};

function pressSlot(slot) {
  if (slot < 0 || slot >= SLOT_COUNT) return;
  hud.select(slot);
  const live = trainer && trainer.running && !trainer.paused;
  const result = live ? trainer.pressSlot(slot) : 'neutral';
  if (result !== 'wrong') audio.switchSlot(live ? 1 : 0.4);
  if (result === 'hit') hud.pulseHearts();
}

function pressAction(action) {
  if (action === 'prev' || action === 'next') {
    const next = (hud.selected + (action === 'next' ? 1 : -1) + SLOT_COUNT) % SLOT_COUNT;
    pressSlot(next);
    return;
  }
  const live = trainer && trainer.running && !trainer.paused;
  if (!live) return;

  if (action === 'attack') {
    hud.swing();
    audio.click();
    return;
  }
  if (action === 'use') {
    hud.useItemAnim();
    audio.click();
    return;
  }
  if (action === 'drop') {
    const c = hud.slotCenter(hud.selected);
    if (c) {
      const r = el.fxCanvas.getBoundingClientRect();
      field.burst(c.x - r.left, c.y - r.top, { count: 8, colors: ['#c2c2c2', '#8f8f8f', '#ffd94a'], speed: 160, life: 0.5 });
    }
    audio.click();
    return;
  }
  if (action === 'inventory') {
    el.hotbar.classList.remove('is-flash');
    void el.hotbar.offsetWidth;
    el.hotbar.classList.add('is-flash');
    setTimeout(() => el.hotbar.classList.remove('is-flash'), 380);
    audio.click();
    return;
  }
  if (action === 'swap') {
    hud.useItemAnim();
    audio.click();
    return;
  }
  if (action === 'reset') {
    trainer.pressAction('reset');
  }
}

/* ============================================================
   events
   ============================================================ */

/* nav + cards */
$$('.navlink').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (['freestyle', 'training', 'tenhearts', 'custom'].includes(view)) openSetup(view);
    else navigate(view);
  });
});

$$('.mode-card').forEach((card) => {
  const activate = () => {
    const mode = card.dataset.mode;
    if (['stats', 'settings'].includes(mode)) navigate(mode);
    else openSetup(mode);
  };
  card.addEventListener('click', activate);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  });
});

$$('[data-view]').forEach((node) => {
  if (node.classList.contains('navlink')) return;
  node.addEventListener('click', (e) => {
    const view = node.dataset.view;
    if (!view) return;
    if (e) e.preventDefault();
    if (['freestyle', 'training', 'tenhearts', 'custom'].includes(view)) openSetup(view);
    else navigate(view);
  });
});

if (el.heroQuickStart) {
  el.heroQuickStart.addEventListener('click', () => openSetup('training'));
}

/* quick toggles */
el.quickSfx && el.quickSfx.addEventListener('click', () => {
  setSettingAndApply('sfx', !state.settings.sfx);
  toast(`Sound effects ${state.settings.sfx ? 'on' : 'off'}`, 'info', 1800);
});
el.quickFx && el.quickFx.addEventListener('click', () => {
  setSettingAndApply('animations', !state.settings.animations);
  toast(`Animations ${state.settings.animations ? 'on' : 'off'}`, 'info', 1800);
});

/* arena buttons */
el.btnPause && el.btnPause.addEventListener('click', () => {
  if (!trainer) {
    toast('Start a session first.', 'info', 1800);
    return;
  }
  if (trainer.paused) resumeSession();
  else if (trainer.running) pauseSession();
});
el.btnEnd && el.btnEnd.addEventListener('click', () => endSession());

el.hotbar && el.hotbar.addEventListener('click', (e) => {
  const slotEl = e.target.closest('.slot');
  if (!slotEl) return;
  pressSlot(Number(slotEl.dataset.slot));
});

/* overlay actions */
el.arenaOverlay && el.arenaOverlay.addEventListener('click', (e) => {
  if (overlayState === 'setup') {
    onSetupClick(e);
    return;
  }
  const btn = e.target.closest('[data-overlay]');
  if (!btn) return;
  const action = btn.dataset.overlay;
  if (action === 'resume') resumeSession();
  if (action === 'end') endSession();
  if (action === 'dashboard') {
    hideOverlay();
    trainer = null;
    navigateInternal('dashboard');
    renderDashboard();
  }
  if (action === 'again') {
    const cfg = sessionConfig || (lastConfig ? lastConfig.cfg : null);
    if (cfg) startSession(sessionMode, cfg);
  }
  if (action === 'setup') {
    const mode = sessionMode;
    trainer = null;
    hideOverlay();
    enterSetup(mode);
  }
});
el.arenaOverlay && el.arenaOverlay.addEventListener('input', onSetupInput);
el.arenaOverlay && el.arenaOverlay.addEventListener('change', onSetupChange);

/* modal */
el.modalLayer && el.modalLayer.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-modal]')) closeModal();
});

/* settings: binds */
el.bindGrid && el.bindGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-bind-slot]');
  if (!btn) return;
  beginCapture('slot', Number(btn.dataset.bindSlot), btn);
});
el.actionBinds && el.actionBinds.addEventListener('click', (e) => {
  const bindBtn = e.target.closest('[data-bind-action]');
  if (bindBtn) {
    beginCapture('action', bindBtn.dataset.bindAction, bindBtn.closest('.bind-row'));
    return;
  }
  const unbtn = e.target.closest('[data-unbind-action]');
  if (unbtn) {
    const id = unbtn.dataset.unbindAction;
    state.binds.actions[id] = null;
    store.save();
    afterBindsChanged();
    toast('Binding cleared.', 'info', 1800);
  }
});
el.bindReset && el.bindReset.addEventListener('click', () => {
  if (hub.capture) hub.cancelCapture();
  store.resetBinds();
  afterBindsChanged();
  hud.refreshKeys();
  toast('Keybinds reset to defaults.', 'ok', 2400);
});

/* settings: toggles + ranges */
el.toggleList && el.toggleList.addEventListener('change', (e) => {
  const input = e.target.closest('[data-toggle]');
  if (!input) return;
  setSettingAndApply(input.dataset.toggle, input.checked);
});
el.volumeRange && el.volumeRange.addEventListener('input', () => {
  const v = Number(el.volumeRange.value) / 100;
  state.settings.volume = v;
  store.save();
  audio.setVolume(v);
  if (el.volumeOut) el.volumeOut.textContent = `${Math.round(v * 100)}%`;
});
el.volumeRange && el.volumeRange.addEventListener('change', () => audio.click());
el.hudScaleRange && el.hudScaleRange.addEventListener('input', () => {
  const v = Number(el.hudScaleRange.value) / 100;
  state.settings.hudScale = v;
  store.save();
  document.documentElement.style.setProperty('--hud-scale', String(v));
  if (el.hudScaleOut) el.hudScaleOut.textContent = `${Math.round(v * 100)}%`;
  hud.layout();
});
el.themeSegmented && el.themeSegmented.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-theme-value]');
  if (!btn) return;
  setSettingAndApply('theme', btn.dataset.themeValue);
  renderTheme();
});

/* settings: loadout */
el.loadout && el.loadout.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-loadout-slot]');
  if (!pick) return;
  loadoutSlot = Number(pick.dataset.loadoutSlot);
  renderLoadout();
  if (el.settingsPreview) renderPreviewHud(el.settingsPreview, 0.82);
});
el.itemPicker && el.itemPicker.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-item]');
  if (!chip) return;
  store.setLoadoutItem(loadoutSlot, chip.dataset.item);
  hud.refreshItems();
  renderLoadout();
  renderBindGrid();
  renderPreviewHud(el.previewHud, 0.92);
  if (el.settingsPreview) renderPreviewHud(el.settingsPreview, 0.82);
  if (el.previewViewModel) el.previewViewModel.innerHTML = pxIcon(state.loadout[0]);
  toast(`Slot ${loadoutSlot + 1} → ${itemName(chip.dataset.item)}`, 'ok', 1600);
  audio.ui();
});
el.resetLoadout && el.resetLoadout.addEventListener('click', () => {
  store.resetLoadout();
  hud.refreshItems();
  renderLoadout();
  renderBindGrid();
  renderPreviewHud(el.previewHud, 0.92);
  if (el.settingsPreview) renderPreviewHud(el.settingsPreview, 0.82);
  toast('Default loadout restored.', 'ok', 2000);
});

/* settings: data */
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

$('#exportStats') && $('#exportStats').addEventListener('click', () => {
  download('slotcraft-data.json', store.exportJSON());
  toast('Data exported.', 'ok', 2000);
});
$('#exportStats2') && $('#exportStats2').addEventListener('click', () => {
  download('slotcraft-data.json', store.exportJSON());
  toast('Data exported.', 'ok', 2000);
});
$('#exportAll') && $('#exportAll').addEventListener('click', () => {
  download('slotcraft-data.json', store.exportJSON());
  toast('All data exported.', 'ok', 2200);
});
$('#importAll') && $('#importAll').addEventListener('click', () => el.importFile && el.importFile.click());
el.importFile && el.importFile.addEventListener('change', () => {
  const file = el.importFile.files && el.importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      store.importJSON(String(reader.result));
      applySettings();
      hud.refreshItems();
      hud.refreshKeys();
      renderDashboard();
      renderStats();
      renderSettings();
      toast('Data imported successfully.', 'ok', 3000);
    } catch (err) {
      toast('That file could not be imported — invalid JSON.', 'error', 4000);
    }
  };
  reader.readAsText(file);
  el.importFile.value = '';
});

/* stats reset */
function askResetStats() {
  openModal({
    eyebrow: 'Destructive',
    title: 'Reset statistics?',
    body: '<p>All session history and personal records will be deleted. Keybinds, settings and hotbar items stay untouched.</p>',
    actions: [
      { label: 'Cancel' },
      {
        label: 'Reset statistics',
        style: 'btn-danger',
        onClick: () => {
          store.resetStats();
          renderDashboard();
          renderStats();
          toast('Statistics reset.', 'ok', 2400);
        },
      },
    ],
  });
}
$('#resetStatsBtn') && $('#resetStatsBtn').addEventListener('click', askResetStats);
$('#resetStatsBtn2') && $('#resetStatsBtn2').addEventListener('click', askResetStats);

$('#resetSettingsBtn') && $('#resetSettingsBtn').addEventListener('click', () => {
  openModal({
    eyebrow: 'Settings',
    title: 'Reset settings?',
    body: '<p>Keybinds, sound, animations, HUD scale, theme and hotbar items return to defaults. Statistics are kept.</p>',
    actions: [
      { label: 'Cancel' },
      {
        label: 'Reset settings',
        style: 'btn-danger',
        onClick: () => {
          store.resetSettings();
          applySettings();
          hud.refreshItems();
          hud.refreshKeys();
          renderSettings();
          renderDashboard();
          toast('Settings restored to defaults.', 'ok', 2400);
        },
      },
    ],
  });
});

$('#wipeAll') && $('#wipeAll').addEventListener('click', () => {
  openModal({
    eyebrow: 'Destructive',
    title: 'Reset everything?',
    body: '<p>This deletes every session, record, keybind and preference stored by SLOTCRAFT in this browser. It cannot be undone.</p>',
    actions: [
      { label: 'Cancel' },
      {
        label: 'Delete everything',
        style: 'btn-danger',
        onClick: () => {
          store.resetEverything();
          applySettings();
          hud.refreshItems();
          hud.refreshKeys();
          renderDashboard();
          renderStats();
          renderSettings();
          toast('All local data cleared.', 'ok', 2600);
        },
      },
    ],
  });
});

/* keyboard: escape */
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (hub.capture || (hub.escapeGuardUntil && hub.escapeGuardUntil > performance.now())) return;
  if (!el.modalLayer.hidden) {
    closeModal();
    return;
  }
  if (countdownActive) {
    cancelCountdown();
    enterSetup(sessionMode || 'freestyle');
    return;
  }
  if (overlayState === 'summary') {
    hideOverlay();
    trainer = null;
    navigateInternal('dashboard');
    renderDashboard();
    return;
  }
  if (overlayState === 'setup') {
    hideOverlay();
    navigateInternal('dashboard');
    return;
  }
  if (!trainer || !trainer.running) return;
  if (trainer.paused) resumeSession();
  else pauseSession();
}, true);

/* enter starts the setup session */
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (overlayState !== 'setup') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
  e.preventDefault();
  startFromSetup();
});

window.addEventListener('beforeunload', () => {
  if (trainer && trainer.running && trainer.switches > 0) store.saveRecovery(trainer.summary());
  else store.save(true);
});
window.addEventListener('pagehide', () => {
  if (trainer && trainer.running && trainer.switches > 0) store.saveRecovery(trainer.summary());
  else store.save(true);
});

/* keep HUD geometry fresh */
window.addEventListener('resize', () => hud.layout());
window.addEventListener('orientationchange', () => hud.layout());

/* ============================================================
   init
   ============================================================ */

applySettings();

const recovered = store.takeRecovery();
if (recovered && recovered.switches > 0) {
  store.pushSession(recovered);
  setTimeout(() => {
    toast(`Recovered an interrupted ${MODE_LABELS[recovered.mode] || ''} session — ${fmt.int(recovered.switches)} switches saved.`.replace('  ', ' '), 'ok', 6200);
  }, 900);
}

renderDashboard();
renderStats();
renderSettings();
renderArenaChrome('freestyle', {});
cueIdle('start');
navigateInternal('dashboard');

if (!state.config.seenIntro && !state.sessions.length) {
  state.config.seenIntro = true;
  store.save();
  setTimeout(() => {
    toast('Welcome to SLOTCRAFT — press Quick Start to drill your hotbar.', 'info', 5000);
  }, 700);
}

/* expose a small debug surface for QA */
window.__slotcraft = {
  get state() { return state; },
  get trainer() { return trainer; },
  hud,
  hub,
  startSession,
  openSetup,
  endSession,
  pressSlot,
  navigate,
};
