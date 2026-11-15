import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:4173/', pretendToBeVisual: true });
const { window } = dom;
Object.assign(globalThis, {
  window, document: window.document, Element: window.Element, HTMLElement: window.HTMLElement,
  Node: window.Node, localStorage: window.localStorage,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
});
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.ResizeObserver = globalThis.ResizeObserver;
window.scrollTo = () => {};
window.HTMLCanvasElement.prototype.getContext = function () {
  return { setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {}, set fillStyle(v) {}, set globalAlpha(v) {} };
};
const errors = [];
console.error = (...a) => errors.push(a.map(String).join(' '));
console.warn = (...a) => errors.push('WARN ' + a.map(String).join(' '));

await import(`${root}/js/app.js`);
const app = window.__slotcraft;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (sel) => {
  const n = document.querySelector(sel);
  if (!n) throw new Error('missing ' + sel);
  n.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return n;
};
const key = (code) => window.dispatchEvent(new window.KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
const waitFor = async (fn, timeout = 4000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = fn();
    if (v) return v;
    await sleep(25);
  }
  return null;
};
const results = [];
const check = (name, cond, detail = '') => {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`);
};
const hitTarget = async (keepGoing = 1) => {
  for (let i = 0; i < keepGoing; i++) {
    const t = await waitFor(() => app.trainer && app.trainer.target, 2500);
    if (!t) return false;
    key(app.state.binds.slots[t.slot]);
    await sleep(60);
  }
  return true;
};

/* ================= freestyle without challenges ================= */
app.openSetup('freestyle');
await sleep(20);
click('[data-setup="start"]');
await sleep(1750);
let tr = app.trainer;
check('freestyle running', tr && tr.running);
check('freestyle has no sequence', tr.usesSequence === false);
await sleep(1200);
check('freestyle no target when challenges off', tr.target === null, String(tr.target));
const beforeSwitches = tr.switches;
key(app.state.binds.slots[2]);
key(app.state.binds.slots[6]);
await sleep(50);
check('freestyle counts switches', tr.switches === beforeSwitches + 2, `${beforeSwitches} -> ${tr.switches}`);
check('freestyle accuracy unjudged', tr.accuracy() === null);
check('accuracy chip shows dash', document.querySelector('[data-chip="acc"] b').textContent === '—');
check('freestyle HUD selection follows key', document.querySelector('#hotbar .slot.is-selected').dataset.slot === '6', document.querySelector('#hotbar .slot.is-selected').dataset.slot);

/* pause overlay via escape */
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
await sleep(60);
check('escape pauses', tr.paused === true);
check('pause overlay visible', document.querySelector('#arenaOverlay').textContent.includes('Paused'));
click('[data-overlay="resume"]');
await sleep(60);
check('resume from overlay', tr.paused === false);
app.endSession();
await sleep(80);
check('freestyle summary shown', document.querySelector('#arenaOverlay').textContent.includes('Session complete'));

/* ================= freestyle with random targets ================= */
app.navigate('dashboard');
await sleep(20);
app.openSetup('freestyle');
await sleep(30);
const chk = document.querySelector('[data-setup-check="challenge"]');
chk.checked = true;
chk.dispatchEvent(new window.Event('change', { bubbles: true }));
await sleep(10);
click('[data-setup="start"]');
await sleep(1800);
tr = app.trainer;
check('freestyle challenge enabled', tr.challenge === true);
const t1 = await waitFor(() => tr.target, 2500);
check('random target spawns', !!t1, t1 ? `slot ${t1.slot}` : 'none');
if (t1) {
  key(app.state.binds.slots[t1.slot]);
  await sleep(60);
  check('random target hit counted', tr.correct === 1);
  check('target cleared after hit', tr.target === null);
}
check('cue shows idle freestyle prompt', document.querySelector('#cueLabel').textContent.includes('FREESTYLE'));
app.endSession();
await sleep(80);

/* ================= custom practice: 2 slots, sequence ================= */
app.navigate('dashboard');
await sleep(20);
app.openSetup('custom');
await sleep(30);
for (const i of [2, 3, 4, 5, 6, 7, 8]) {
  click(`[data-filter-slot="${i}"]`);
  await sleep(15);
}
check('slot filter reduced to two', document.querySelectorAll('[data-filter-slot].is-on').length === 2, String(document.querySelectorAll('[data-filter-slot].is-on').length));
click('[data-setup="start"]');
await sleep(1800);
tr = app.trainer;
check('custom active slots honoured', JSON.stringify(tr.activeSlots) === JSON.stringify([0, 1]), JSON.stringify(tr.activeSlots));
check('custom sequence length from base', tr.sequence.length >= 3, String(tr.sequence.length));

/* filtered-out slot is ignored */
const swBefore = tr.switches;
key(app.state.binds.slots[5]);
await sleep(40);
check('filtered slot ignored by engine', tr.switches === swBefore, `${swBefore} -> ${tr.switches}`);

/* clear one full round by hitting every target */
let guard = 0;
while (tr.rounds < 1 && guard < 20) {
  const ok = await hitTarget(1);
  if (!ok) break;
  await sleep(220);
  guard++;
}
check('custom round cleared', tr.rounds >= 1, `rounds=${tr.rounds} level=${tr.level}`);
check('progressive level up', tr.level >= 2, String(tr.level));
check('window shrinks gradually', tr.windowForLevel(3) < tr.windowForLevel(1) && tr.windowForLevel(3) > 800, `${tr.windowForLevel(1)} -> ${tr.windowForLevel(3)}`);
check('sequence grows with level', tr.lengthForLevel(7) > tr.lengthForLevel(1), `${tr.lengthForLevel(1)} -> ${tr.lengthForLevel(7)}`);
check('fastest round recorded', Number.isFinite(tr.fastestRound), String(tr.fastestRound));

key(app.state.binds.slots[0]);
await sleep(30);
const sessionsBefore = app.state.sessions.length;
const summary = tr.finish ? null : null;
click('#btnEnd');
await sleep(120);
check('custom summary visible', document.querySelector('#arenaOverlay').textContent.includes('Session complete'));
check('custom session saved', app.state.sessions.length === sessionsBefore + 1, `${sessionsBefore} -> ${app.state.sessions.length}`);
check('summary includes fastest sequence', document.querySelector('#arenaOverlay').textContent.includes('Fastest sequence'));
check('fastest sequence record stored', app.state.records.fastestRound !== null, String(app.state.records.fastestRound));
check('records totals updated', app.state.records.totalSwitches > 0, String(app.state.records.totalSwitches));

/* ================= 10 hearts: no timer, no damage ================= */
app.openSetup('tenhearts');
await sleep(30);
click('[data-setup="start"]');
await sleep(1800);
tr = app.trainer;
check('10-heart running', tr.running);
check('exactly 10 hearts in HUD', document.querySelectorAll('#hearts svg').length === 10);
check('10 hunger icons full', document.querySelectorAll('#hunger svg').length === 10);
const hpBefore = document.querySelectorAll('#hearts svg').length;
for (const slot of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
  key(app.state.binds.slots[slot]);
  await sleep(12);
}
check('no hearts lost on mistakes', document.querySelectorAll('#hearts svg').length === hpBefore);
check('no timer chip value', document.querySelector('[data-chip="time"] b').textContent === '∞');
check('target never expires (infinite window)', tr.target === null || tr.target.window === Infinity);
check('engine exposes no health system', tr.hp === undefined && tr.hearts === undefined);
/* session survives a long idle without ending */
await sleep(1200);
check('10-heart session still running after idle', tr.running === true);
click('#btnEnd');
await sleep(100);
check('10-heart summary', document.querySelector('#arenaOverlay').textContent.includes('Session complete'));

/* ================= persistence ================= */
const raw = JSON.parse(localStorage.getItem('slotcraft.hotbar-trainer.v1'));
check('sessions persisted', raw.sessions.length >= 3, String(raw.sessions.length));
check('binds persisted', raw.binds.slots.length === 9);
check('records persisted', typeof raw.records.totalSwitches === 'number');
check('settings persisted', raw.settings && typeof raw.settings.volume === 'number');
check('loadout persisted', raw.loadout.length === 9);

/* ================= stats view after sessions ================= */
app.navigate('stats');
await sleep(60);
check('accuracy chart has path', !!document.querySelector('#chartAccuracy svg path'));
check('reaction chart rendered', !!document.querySelector('#chartReaction svg'));
check('diff list rendered', document.querySelectorAll('#diffList .diff-row').length === 5);
check('history rows', document.querySelectorAll('#historyWrapFull tbody tr').length >= 3, String(document.querySelectorAll('#historyWrapFull tbody tr').length));

console.log('\nRuntime errors captured:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  !', e));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
