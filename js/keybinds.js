/* ============================================================
   keybinds.js — binding labels, input hub, capture mode
   ============================================================ */

const KEY_LABELS = {
  Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', Tab: 'TAB', Backspace: 'BACK', CapsLock: 'CAPS',
  ShiftLeft: 'L SHIFT', ShiftRight: 'R SHIFT', ControlLeft: 'L CTRL', ControlRight: 'R CTRL',
  AltLeft: 'L ALT', AltRight: 'R ALT', MetaLeft: 'WIN', MetaRight: 'WIN',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
  Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN',
  NumpadAdd: 'NUM +', NumpadSubtract: 'NUM -', NumpadMultiply: 'NUM *', NumpadDivide: 'NUM /',
  NumpadDecimal: 'NUM .', NumpadEnter: 'NUM ENTER',
};

const MOUSE_LABELS = {
  MouseLeft: 'LEFT CLICK',
  MouseRight: 'RIGHT CLICK',
  Mouse4: 'MOUSE 4',
  Mouse5: 'MOUSE 5',
  WheelUp: 'WHEEL UP',
  WheelDown: 'WHEEL DOWN',
};

const MOUSE_COMPACT = {
  MouseLeft: 'LMB',
  MouseRight: 'RMB',
  Mouse4: 'M4',
  Mouse5: 'M5',
  WheelUp: 'WH↑',
  WheelDown: 'WH↓',
};

export const SUPPORTED_MOUSE_BUTTONS = { 0: 'MouseLeft', 2: 'MouseRight', 3: 'Mouse4', 4: 'Mouse5' };

/** Human readable label for a binding id. */
export function bindLabel(bindId, compact = false) {
  if (!bindId) return compact ? '—' : 'Unassigned';
  if (MOUSE_LABELS[bindId]) return compact ? MOUSE_COMPACT[bindId] : MOUSE_LABELS[bindId];
  if (KEY_LABELS[bindId]) return KEY_LABELS[bindId];
  if (/^Digit\d$/.test(bindId)) return bindId.slice(5);
  if (/^Numpad\d$/.test(bindId)) return compact ? `N${bindId.slice(6)}` : `NUM ${bindId.slice(6)}`;
  if (/^Key[A-Z]$/.test(bindId)) return bindId.slice(3);
  if (/^F\d{1,2}$/.test(bindId)) return bindId;
  return bindId.replace(/^(Key|Digit)/, '').toUpperCase();
}

export function isMouseBind(bindId) {
  return typeof bindId === 'string' && bindId.startsWith('Mouse');
}

export function isWheelBind(bindId) {
  return bindId === 'WheelUp' || bindId === 'WheelDown';
}

/** Physical key event -> binding id, or null when unsupported. */
export function bindFromKeyEvent(ev) {
  if (!ev || !ev.code) return null;
  if (ev.code === 'Escape') return { id: null, cancel: true };
  // bare modifier presses cannot be bound
  if (/^(Shift|Control|Alt|Meta)/.test(ev.code) || ev.code === 'OSLeft' || ev.code === 'OSRight') return null;
  return { id: ev.code };
}

/** Mouse button -> binding id, with the "only two extra buttons" rule. */
export function bindFromMouseButton(button) {
  const id = SUPPORTED_MOUSE_BUTTONS[button];
  if (id) return { id };
  if (button === 1) return { error: 'Middle mouse is not supported. Use Mouse 4 or Mouse 5 for extra buttons.' };
  return { error: 'Only Mouse 4 and Mouse 5 are supported (maximum two extra mouse buttons).' };
}

// keyboard input is only suppressed inside real form fields and overlays
const KEY_IGNORE_TARGETS = 'input, select, textarea, [contenteditable="true"], .modal, .arena-overlay';
// mouse input additionally ignores clickable UI so buttons never double as hotbar keys
const MOUSE_IGNORE_TARGETS = `${KEY_IGNORE_TARGETS}, button, a, .hotbar`;

export class InputHub {
  constructor() {
    this.onGameBind = null;
    this.onCaptureResult = null;
    this.capture = null;
    this.captureStartedAt = 0;
    this.escapeGuardUntil = 0;
    this.lastWheelAt = 0;
    this.wheelGuardEl = null;
    this.enabled = true;
    this.blockShortcuts = true;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    window.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('keyup', this._onKeyUp, true);
    window.addEventListener('mousedown', this._onMouseDown, true);
    window.addEventListener('wheel', this._onWheel, { capture: true, passive: false });
    window.addEventListener('contextmenu', this._onContextMenu, true);
  }

  setWheelGuard(el) {
    this.wheelGuardEl = el;
  }

  /** Begin listening for the next input (rebinding UI). */
  startCapture(resultHandler) {
    this.capture = true;
    this.captureStartedAt = performance.now();
    this.onCaptureResult = resultHandler;
  }

  cancelCapture() {
    this.capture = null;
    this.onCaptureResult = null;
  }

  _finishCapture(result) {
    const handler = this.onCaptureResult;
    this.cancelCapture();
    this.escapeGuardUntil = performance.now() + 120;
    if (handler) handler(result);
  }

  _shouldIgnoreKey(ev) {
    const t = ev.target;
    if (!t || !(t instanceof Element)) return false;
    return !!t.closest(KEY_IGNORE_TARGETS);
  }

  _shouldIgnoreMouse(ev) {
    const t = ev.target;
    if (!t || !(t instanceof Element)) return false;
    return !!t.closest(MOUSE_IGNORE_TARGETS);
  }

  _onKeyDown(ev) {
    if (this.capture) {
      if (ev.code === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        this._finishCapture({ cancelled: true });
        return;
      }
      if (ev.repeat) return;
      const mapped = bindFromKeyEvent(ev);
      if (mapped && mapped.cancel) {
        ev.preventDefault();
        ev.stopPropagation();
        this._finishCapture({ cancelled: true });
        return;
      }
      if (!mapped || !mapped.id) {
        // modifier-only: keep waiting rather than swallowing the press
        const isModifier = /^(Shift|Control|Alt|Meta|OS)/.test(ev.code);
        if (isModifier) return;
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      this._finishCapture({ ok: true, id: mapped.id });
      return;
    }

    if (!this.enabled) return;
    if (this._shouldIgnoreKey(ev)) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return; // leave browser/system shortcuts alone
    if (ev.repeat) {
      // keep focus where it is, but never repeat a hotbar switch
      if (this.blockShortcuts && ev.code !== 'Tab') return;
      return;
    }
    const mapped = bindFromKeyEvent(ev);
    if (!mapped || !mapped.id) return;
    if (!this.onGameBind) return;
    const handled = this.onGameBind(mapped.id, ev);
    if (handled === true && this.blockShortcuts) ev.preventDefault();
  }

  _onKeyUp(ev) {
    if (this.capture && ev.code === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  _onMouseDown(ev) {
    if (this.capture) {
      // ignore the click that opened capture mode
      if (performance.now() - this.captureStartedAt < 220) {
        ev.preventDefault();
        return;
      }
      const mapped = bindFromMouseButton(ev.button);
      ev.preventDefault();
      ev.stopPropagation();
      if (mapped.error) this._finishCapture({ error: mapped.error });
      else this._finishCapture({ ok: true, id: mapped.id });
      return;
    }

    if (!this.enabled) return;
    if (this._shouldIgnoreMouse(ev)) return;
    const mapped = bindFromMouseButton(ev.button);
    if (!mapped || !mapped.id) return;
    if (!this.onGameBind) return;
    if (this.onGameBind(mapped.id, ev) === true) {
      ev.preventDefault();
      if (ev.button === 2) ev.stopPropagation();
    }
  }

  _onWheel(ev) {
    if (this.capture) {
      ev.preventDefault();
      if (performance.now() - this.captureStartedAt < 220) return;
      const id = ev.deltaY < 0 ? 'WheelUp' : ev.deltaY > 0 ? 'WheelDown' : null;
      if (id) this._finishCapture({ ok: true, id });
      return;
    }

    const target = ev.target instanceof Element ? ev.target : null;
    // stop the page from scrolling while the arena owns the wheel
    if (target && this.wheelGuardEl && this.wheelGuardEl.contains(target) && !document.body.classList.contains('overlay-open')) {
      ev.preventDefault();
    }
    if (!this.enabled) return;
    if (this._shouldIgnoreMouse(ev)) return;
    if (Math.abs(ev.deltaY) < 1) return;
    const now = performance.now();
    if (now - this.lastWheelAt < 38) return;
    this.lastWheelAt = now;
    const id = ev.deltaY < 0 ? 'WheelUp' : 'WheelDown';
    if (this.onGameBind) this.onGameBind(id, ev);
  }

  _onContextMenu(ev) {
    if (this.capture) {
      ev.preventDefault();
      return;
    }
    if (ev.target instanceof Element && this.wheelGuardEl && this.wheelGuardEl.contains(ev.target)) ev.preventDefault();
  }
}

/** Free-form capture used by the rebinding UI: returns a bind id or an error. */
export function describeCaptureConflict(bindId) {
  return `${bindLabel(bindId)} is already used by another control.`;
}
