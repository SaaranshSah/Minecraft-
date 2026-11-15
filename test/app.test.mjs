import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:4173/', pretendToBeVisual: true });

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.Element = window.Element;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.localStorage = window.localStorage;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.ResizeObserver = globalThis.ResizeObserver;
window.scrollTo = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {},
    fillRect() {}, beginPath() {}, closePath() {}, fill() {},
    set fillStyle(v) {}, set globalAlpha(v) {}, set strokeStyle(v) {},
  };
};
window.AudioContext = undefined;
window.webkitAudioContext = undefined;

const errors = [];
window.addEventListener('error', (e) => errors.push(e.message || String(e.error)));
const origError = console.error;
console.error = (...args) => { errors.push(args.map(String).join(' ')); origError(...args); };
const origWarn = console.warn;
console.warn = (...args) => { errors.push('WARN ' + args.map(String).join(' ')); origWarn(...args); };

await import(`${root}/js/app.js`);
const app = window.__slotcraft;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (selector) => {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`missing element ${selector}`);
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return node;
};
const key = (code, extra = {}) => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code, key: code.replace('Digit', ''), bubbles: true, cancelable: true, ...extra }));
};

const results = [];
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};

/* ---------- boot ---------- */
check('dashboard has records', document.querySelectorAll('#recordGrid .record').length === 6);
check('hotbar has 9 slots', document.querySelectorAll('#hotbar .slot').length === 9);
check('hearts = 10', document.querySelectorAll('#hearts svg').length === 10);
check('hunger = 10', document.querySelectorAll('#hunger svg').length === 10);
check('key row rendered', document.querySelectorAll('#keyRow .keychip').length === 9);
check('sprite sheet built', document.querySelectorAll('#px-sprites symbol').length > 10);

/* ---------- open training setup ---------- */
app.openSetup('training');
await sleep(20);
check('setup overlay visible', !document.getElementById('arenaOverlay').hidden);
check('difficulty cards = 5', document.querySelectorAll('[data-difficulty]').length === 5);
click('[data-difficulty="hard"]');
await sleep(10);
check('difficulty selectable', app.state.config.difficulty === 'hard' || document.querySelector('[data-difficulty="hard"]').classList.contains('is-on'));

click('[data-setup="start"]');
await sleep(2000); // countdown
const trainer = app.trainer;
check('trainer running after countdown', trainer && trainer.running, trainer ? `paused=${trainer.paused}` : 'no trainer');
check('hard base window applied', trainer && trainer.baseWindow === 1050, trainer ? String(trainer.baseWindow) : '');
check('sequence generated', trainer && trainer.sequence.length >= 4, trainer ? String(trainer.sequence.length) : '');

/* hit the first target */
const target = trainer.target;
const targetKey = app.state.binds.slots[target.slot];
const beforeCorrect = trainer.correct;
key(targetKey);
await sleep(30);
check('correct hit registered', trainer.correct === beforeCorrect + 1, `correct=${trainer.correct} key=${targetKey}`);
check('reaction recorded', trainer.reactionCount === 1);
check('hotbar selected target', document.querySelectorAll('#hotbar .slot.is-selected').length === 1);

/* wrong key */
await sleep(trainer.gapForLevel() + 60);
const t2 = trainer.target;
if (t2) {
  const wrongSlot = (t2.slot + 1) % 9;
  key(app.state.binds.slots[wrongSlot]);
  await sleep(20);
  check('wrong switch counted', trainer.incorrect >= 1, `incorrect=${trainer.incorrect}`);
} else {
  check('second target issued', false, 'no target after gap');
}

/* wheel cycles slots */
const before = document.querySelector('#hotbar .slot.is-selected').dataset.slot;
window.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
await sleep(30);
const after = document.querySelector('#hotbar .slot.is-selected').dataset.slot;
check('wheel cycles hotbar', before !== after, `${before} -> ${after}`);

/* pause / resume via engine */
trainer.pause();
check('pause reported', trainer.paused === true);
const remaining = trainer.windowRemaining();
await sleep(280);
check('window frozen while paused', Math.abs((trainer.windowRemaining() ?? 0) - (remaining ?? 0)) < 1, `${remaining} vs ${trainer.windowRemaining()}`);
trainer.resume();
check('resumed', trainer.paused === false);

/* 10-heart mode: no timers */
app.endSession({ silent: true });
await sleep(50);
app.openSetup('tenhearts');
await sleep(20);
click('[data-setup="start"]');
await sleep(1900);
const heartTrainer = app.trainer;
check('10-heart trainer running', heartTrainer && heartTrainer.running);
check('10-heart no countdown window', heartTrainer.noTimer === true);
check('10-heart base window infinite', heartTrainer.baseWindow === Infinity);
check('10-heart UI shows no timer', document.querySelector('[data-chip="time"] b').textContent === '∞');
let target3 = heartTrainer.target;
for (let i = 0; i < 30 && !target3; i++) {
  await sleep(60);
  target3 = heartTrainer.target;
}
check('10-heart target spawned', !!target3, target3 ? String(target3.slot) : 'none');
if (target3) {
  key(app.state.binds.slots[target3.slot]);
  await sleep(20);
  check('10-heart hit counted', heartTrainer.correct === 1);
}
app.endSession();
await sleep(60);
check('summary overlay after end', document.querySelector('#arenaOverlay').innerHTML.includes('Session complete'));
check('session pushed to store', app.state.sessions.length >= 2, String(app.state.sessions.length));

/* ---------- keybinding UI ---------- */
app.navigate('settings');
await sleep(40);
check('bind grid rendered', document.querySelectorAll('[data-bind-slot]').length === 9);
const firstBind = document.querySelector('[data-bind-slot="0"]');
click('[data-bind-slot="0"]');
await sleep(400); // capture guard for mouse, key is immediate
key('KeyQ');
await sleep(40);
check('slot 1 rebound to Q', app.state.binds.slots[0] === 'KeyQ', app.state.binds.slots.join(','));
check('conflicting action auto-unbound', app.state.binds.actions.drop === null, String(app.state.binds.actions.drop));

/* duplicate warning: bind slot 2 to Q (used by slot 1) -> swap */
click('[data-bind-slot="1"]');
await sleep(300);
key('KeyQ');
await sleep(50);
check('duplicate prevented by swap', new Set(app.state.binds.slots).size === 9, app.state.binds.slots.join(','));
check('swap kept every slot bound', app.state.binds.slots[0] === 'Digit2' && app.state.binds.slots[1] === 'KeyQ', app.state.binds.slots.join(','));

/* mouse 4 binding */
click('[data-bind-slot="2"]');
await sleep(300);
document.querySelector('#bindGrid').dispatchEvent(new window.MouseEvent('mousedown', { button: 3, bubbles: true, cancelable: true }));
await sleep(50);
check('mouse 4 bindable', app.state.binds.slots[2] === 'Mouse4', app.state.binds.slots[2]);

/* middle mouse rejected */
click('[data-bind-slot="3"]');
await sleep(300);
document.querySelector('#bindGrid').dispatchEvent(new window.MouseEvent('mousedown', { button: 1, bubbles: true, cancelable: true }));
await sleep(50);
check('middle mouse rejected', app.state.binds.slots[3] === 'Digit4', app.state.binds.slots[3]);
check('rejection toast shown', document.querySelector('.toast.err') !== null);

/* extra mouse button 6 rejected */
click('[data-bind-slot="4"]');
await sleep(300);
document.querySelector('#bindGrid').dispatchEvent(new window.MouseEvent('mousedown', { button: 6, bubbles: true, cancelable: true }));
await sleep(50);
check('mouse 6 rejected', app.state.binds.slots[4] === 'Digit5', app.state.binds.slots[4]);

/* reset binds */
click('#bindReset');
await sleep(30);
check('binds reset to defaults', app.state.binds.slots.join(',') === 'Digit1,Digit2,Digit3,Digit4,Digit5,Digit6,Digit7,Digit8,Digit9');
check('key labels refreshed', document.querySelector('#keyRow .keychip').textContent === '1');

/* settings persistence */
check('localStorage written', !!localStorage.getItem('slotcraft.hotbar-trainer.v1'));

/* settings toggles */
const sfxToggle = document.querySelector('[data-toggle="sfx"]');
sfxToggle.checked = false;
sfxToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
await sleep(10);
check('sfx setting saved', app.state.settings.sfx === false);
sfxToggle.checked = true;
sfxToggle.dispatchEvent(new window.Event('change', { bubbles: true }));

/* loadout editor */
const chip = document.querySelector('[data-loadout-slot="3"]');
chip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(10);
const itemBtn = document.querySelector('[data-item="totem"]') || document.querySelector('[data-item="diamond"]');
itemBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(10);
check('loadout item changed', app.state.loadout[3] === itemBtn.dataset.item, app.state.loadout.join(','));

/* stats view renders charts */
app.navigate('stats');
await sleep(80);
check('accuracy chart svg rendered', !!document.querySelector('#chartAccuracy svg'));
check('history table rendered', document.querySelectorAll('#historyWrapFull table.history tbody tr').length >= 1);
check('stat tiles rendered', document.querySelectorAll('#statStrip .stat-tile').length === 6);

/* custom mode setup */
app.openSetup('custom');
await sleep(30);
check('custom slot filter rendered', document.querySelectorAll('[data-filter-slot]').length === 9);
click('[data-filter-slot="0"]');
await sleep(20);
check('custom slot toggled off', !document.querySelector('[data-filter-slot="0"]').classList.contains('is-on'));
click('[data-drill="freestyle"]');
await sleep(20);
check('custom drill switched', document.querySelector('[data-drill="freestyle"]').classList.contains('is-on'));

/* dashboard numbers */
app.navigate('dashboard');
await sleep(30);
check('dashboard sessions > 0', document.getElementById('hsSessions').textContent !== '0');
check('history populated', document.querySelectorAll('#historyWrap table.history tbody tr').length >= 1);

/* ---------- interrupted-session recovery ---------- */
const store = await import(`${root}/js/store.js`);
const snapshot = {
  mode: 'training', difficulty: 'hard', durationMs: 4200, switches: 9, correct: 7, incorrect: 2,
  avgReaction: 380, fastestReaction: 240, bestStreak: 5, rounds: 1, level: 2, fastestRound: 1600,
};
store.saveRecovery(snapshot);
check('recovery snapshot stored', app.state.recovery && app.state.recovery.data.switches === 9);
check('recovery snapshot persists to localStorage', JSON.parse(localStorage.getItem('slotcraft.hotbar-trainer.v1')).recovery.data.switches === 9);
const recovered = store.takeRecovery();
check('recovery snapshot round trip', recovered && recovered.mode === 'training' && recovered.avgReaction === 380, JSON.stringify(recovered && recovered.switches));
check('recovery snapshot cleared after read', store.takeRecovery() === null && app.state.recovery === null);
const sessionsBeforeRecovery = app.state.sessions.length;
store.saveRecovery(snapshot);
store.pushSession(store.takeRecovery());
check('recovered session added to history', app.state.sessions.length === sessionsBeforeRecovery + 1);

console.log('\nRuntime errors captured:', errors.length);
errors.slice(0, 12).forEach((e) => console.log('  !', e));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
