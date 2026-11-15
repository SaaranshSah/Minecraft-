/* ============================================================
   hud.js — hotbar, hearts, hunger, XP, selection animation
   ============================================================ */

import { icon, itemName, itemStack } from './pixelart.js';
import { bindLabel } from './keybinds.js';
import { getState } from './store.js';

const HEART_COUNT = 10;
const HUNGER_COUNT = 10;

function heartsMarkup(count = HEART_COUNT) {
  let out = '';
  for (let i = 0; i < count; i++) out += icon('heart');
  return out;
}

function hungerMarkup(count = HUNGER_COUNT) {
  let out = '';
  for (let i = 0; i < count; i++) out += icon('hunger');
  return out;
}

export class Hud {
  constructor(refs) {
    this.el = refs;
    this.selected = 0;
    this.target = null;
    this.geo = [];
    this.slotEls = [];
    this.keyEls = [];
    this.loadout = getState().loadout.slice();
    this._pv = 0;
  }

  mount() {
    const el = this.el;
    if (!el || !el.hotbar) return;

    el.hearts.innerHTML = heartsMarkup();
    el.hunger.innerHTML = hungerMarkup();
    el.hotbar.innerHTML = '';

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.slot = String(i);
      slot.setAttribute('role', 'button');
      slot.setAttribute('tabindex', '-1');
      slot.setAttribute('aria-label', `Hotbar slot ${i + 1}`);
      slot.innerHTML = `
        <span class="item"></span>
        <span class="slot-count"></span>`;
      el.hotbar.appendChild(slot);
      this.slotEls.push(slot);
    }

    if (el.keyRow) {
      el.keyRow.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const chip = document.createElement('span');
        chip.className = 'keychip';
        chip.dataset.slot = String(i);
        el.keyRow.appendChild(chip);
        this.keyEls.push(chip);
      }
    }

    this.refreshItems();
    this.refreshKeys();
    this.select(this.selected, { animate: false });
    this.layout();

    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.layout());
      this._ro.observe(el.hotbar);
    }
    window.addEventListener('resize', () => this.layout());
  }

  /** Rebuild item icons/counts from the saved loadout. */
  refreshItems() {
    const state = getState();
    this.loadout = state.loadout.slice();
    this.slotEls.forEach((slotEl, i) => {
      const itemId = this.loadout[i];
      const itemEl = slotEl.querySelector('.item');
      const countEl = slotEl.querySelector('.slot-count');
      itemEl.innerHTML = itemId ? icon(itemId) : '';
      const stack = itemId ? itemStack(itemId) : null;
      countEl.textContent = stack ? String(stack) : '';
      slotEl.classList.toggle('is-empty', !itemId);
      slotEl.title = itemId ? `${itemName(itemId)} — slot ${i + 1}` : `Slot ${i + 1}`;
    });
    if (this.el.viewmodel) {
      const id = this.loadout[this.selected];
      this.el.viewmodel.innerHTML = id ? icon(id) : '';
    }
    this.layout();
  }

  /** Rebuild the key labels under the hotbar. */
  refreshKeys() {
    const binds = getState().binds.slots;
    this.keyEls.forEach((chip, i) => {
      const label = bindLabel(binds[i], true);
      chip.textContent = label;
      chip.title = `Slot ${i + 1}: ${bindLabel(binds[i])}`;
      chip.classList.toggle('is-long', label.length > 3);
      chip.classList.toggle('is-selected', i === this.selected);
    });
  }

  /** Cache slot geometry so selecting never triggers layout thrash. */
  layout() {
    if (!this.el.hotbar || !this.el.selFrame) return;
    const wrap = this.el.hotbar.parentElement;
    if (!wrap) return;
    const base = wrap.getBoundingClientRect();
    this.geo = this.slotEls.map((slot) => {
      const r = slot.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    });
    this._paintFrame(false);
  }

  _paintFrame(animate = true) {
    const g = this.geo[this.selected];
    if (!g || !this.el.selFrame) return;
    const frame = this.el.selFrame;
    if (!animate) {
      const prev = frame.style.transition;
      frame.style.transition = 'none';
      this._applyFrame(g);
      // force style flush then restore the transition
      void frame.offsetWidth;
      frame.style.transition = prev;
    } else {
      this._applyFrame(g);
    }
    this._paintMarker();
  }

  _applyFrame(g) {
    const frame = this.el.selFrame;
    frame.style.width = `${g.w}px`;
    frame.style.height = `${g.h}px`;
    frame.style.transform = `translate3d(${g.x}px, ${g.y}px, 0)`;
  }

  _paintMarker() {
    const marker = this.el.targetMarker;
    if (!marker) return;
    if (this.target === null || !this.geo[this.target]) {
      marker.classList.remove('is-on');
      return;
    }
    const g = this.geo[this.target];
    marker.style.width = `${g.w}px`;
    marker.style.height = `${g.h}px`;
    marker.style.transform = `translate3d(${g.x}px, ${g.y}px, 0)`;
    marker.classList.add('is-on');
  }

  select(slot, { animate = true } = {}) {
    if (slot < 0 || slot > 8) return;
    const changed = slot !== this.selected;
    this.selected = slot;
    this.slotEls.forEach((el, i) => el.classList.toggle('is-selected', i === slot));
    this.keyEls.forEach((el, i) => el.classList.toggle('is-selected', i === slot));
    this._paintFrame(animate);

    if (animate && changed) {
      const itemEl = this.slotEls[slot] && this.slotEls[slot].querySelector('.item');
      if (itemEl) {
        itemEl.classList.remove('is-switching');
        void itemEl.offsetWidth;
        itemEl.classList.add('is-switching');
        clearTimeout(itemEl._animTimer);
        itemEl._animTimer = setTimeout(() => itemEl.classList.remove('is-switching'), 240);
      }
    }

    if (this.el.viewmodel && (changed || !this.el.viewmodel.childElementCount)) {
      const vm = this.el.viewmodel;
      vm.innerHTML = icon(this.loadout[slot]);
      if (animate && changed) {
        vm.classList.remove('is-swap');
        void vm.offsetWidth;
        vm.classList.add('is-swap');
      }
    }
  }

  setTarget(slot) {
    this.target = slot;
    this.slotEls.forEach((el, i) => el.classList.toggle('is-target', i === slot));
    this.keyEls.forEach((el, i) => el.classList.toggle('is-target', i === slot));
    this._paintMarker();
  }

  flashSlot(slot) {
    const el = this.slotEls[slot];
    if (!el) return;
    el.classList.remove('is-wrong');
    void el.offsetWidth;
    el.classList.add('is-wrong');
    clearTimeout(el._wrongTimer);
    el._wrongTimer = setTimeout(() => el.classList.remove('is-wrong'), 360);
  }

  setXP(level, progress, { levelUp = false } = {}) {
    const lv = this.el.xpLevel;
    const fill = this.el.xpFill;
    if (lv && lv.textContent !== String(level)) {
      lv.textContent = String(level);
      if (levelUp) {
        lv.classList.remove('is-up');
        void lv.offsetWidth;
        lv.classList.add('is-up');
        setTimeout(() => lv.classList.remove('is-up'), 600);
      }
    }
    if (fill) fill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  }

  pulseHearts() {
    const el = this.el.hearts;
    if (!el) return;
    el.classList.remove('is-pulse');
    void el.offsetWidth;
    el.classList.add('is-pulse');
    setTimeout(() => el.classList.remove('is-pulse'), 520);
  }

  swing() {
    const vm = this.el.viewmodel;
    if (!vm) return;
    vm.classList.remove('is-swing');
    void vm.offsetWidth;
    vm.classList.add('is-swing');
    setTimeout(() => vm.classList.remove('is-swing'), 320);
  }

  useItemAnim() {
    const vm = this.el.viewmodel;
    if (!vm) return;
    vm.classList.remove('is-use');
    void vm.offsetWidth;
    vm.classList.add('is-use');
    setTimeout(() => vm.classList.remove('is-use'), 380);
  }

  /** Screen-space centre of a slot — used for particle bursts. */
  slotCenter(slot) {
    const wrap = this.el.hotbar && this.el.hotbar.parentElement;
    if (!wrap || !this.geo[slot]) return null;
    const base = wrap.getBoundingClientRect();
    const g = this.geo[slot];
    return { x: base.left + g.x + g.w / 2, y: base.top + g.y + g.h / 2 };
  }
}

/* ------------------------------------------------------------
   Static HUD previews (dashboard hero, settings panel)
   ------------------------------------------------------------ */

export function previewHudMarkup(loadout, scale = 1) {
  const slot = 30 * scale;
  const iconSize = slot * 0.74;
  const slots = loadout
    .map((id, i) => {
      const stack = itemStack(id);
      return `<div class="slot ${i === 0 ? 'is-selected' : ''}" title="${itemName(id)}">
        <span class="item">${icon(id)}</span>
        ${stack ? `<span class="slot-count">${stack}</span>` : ''}
      </div>`;
    })
    .join('');
  return `<div class="hud-inner" style="--slot:${slot}px;--icon:${iconSize}px;--slot-gap:2px;--hud-scale:${0.72 * scale}">
    <div class="xp-shell">
      <div class="xp-level">7</div>
      <div class="xp-track"><div class="xp-fill" style="width:42%"></div><div class="xp-ticks"></div></div>
    </div>
    <div class="bar-row"><div class="hearts">${heartsMarkup()}</div><div class="hunger">${hungerMarkup()}</div></div>
    <div class="hotbar-wrap">
      <div class="hotbar">${slots}</div>
      <div class="sel-frame" style="width:${slot}px;height:${slot}px;transform:translate3d(3px,3px,0)"></div>
    </div>
  </div>`;
}

export function renderPreviewHud(container, scale = 1) {
  if (!container) return;
  container.innerHTML = previewHudMarkup(getState().loadout, scale);
}

/** Tiny hearts-only strip for compact previews. */
export function miniBarsMarkup() {
  return `<div class="bar-row" style="--hud-scale:.8"><div class="hearts">${heartsMarkup()}</div><div class="hunger">${hungerMarkup()}</div></div>`;
}
