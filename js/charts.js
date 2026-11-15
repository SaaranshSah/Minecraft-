/* ============================================================
   charts.js — dependency-free SVG charts
   ============================================================ */

let uid = 0;

const empty = (text) => `<div class="empty-state">${text}</div>`;

function scaleLinear(domainMin, domainMax, rangeMin, rangeMax) {
  const d = domainMax - domainMin || 1;
  return (v) => rangeMin + ((v - domainMin) / d) * (rangeMax - rangeMin);
}

function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function axisLabels(values, count = 4) {
  return Array.from({ length: count + 1 }, (_, i) => values[0] + ((values[1] - values[0]) * i) / count);
}

/**
 * Line/area chart.
 * @param {HTMLElement} container
 * @param {{v:number,label:string}[]} series
 */
export function lineChart(container, series, opts = {}) {
  if (!container) return;
  const points = (series || []).filter((p) => p && Number.isFinite(p.v));
  if (!points.length) {
    container.innerHTML = empty(opts.emptyText || 'No sessions recorded yet. Finish a drill to see the trend.');
    return;
  }

  const W = 520;
  const H = opts.height || 180;
  const pad = { l: 42, r: 14, t: 18, b: 26 };
  const color = opts.color || '#7bd94a';
  const yMin = opts.min !== undefined ? opts.min : 0;
  const yMax = opts.max !== undefined ? opts.max : Math.max(niceMax(Math.max(...points.map((p) => p.v))), 1);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const x = (i) => pad.l + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = scaleLinear(yMin, yMax, pad.t + innerH, pad.t);
  const id = `grad-${++uid}`;

  const linePts = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
  const areaPts = `${linePts} L${x(points.length - 1).toFixed(2)},${pad.t + innerH} L${x(0).toFixed(2)},${pad.t + innerH} Z`;

  const gridVals = axisLabels([yMin, yMax], 4);
  const grid = gridVals
    .map((v) => {
      const gy = y(v);
      const label = opts.yFormat ? opts.yFormat(v) : Math.round(v);
      return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}" stroke="rgba(255,255,255,.07)" stroke-dasharray="3 5"/>
        <text x="${pad.l - 8}" y="${gy + 3.5}" fill="#64778a" font-size="9" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
    })
    .join('');

  const avg = points.reduce((a, p) => a + p.v, 0) / points.length;
  const avgY = y(avg);

  const dots = points
    .map((p, i) => {
      const px = x(i);
      const py = y(p.v);
      return `<g class="pt">
        <circle cx="${px}" cy="${py}" r="8" fill="transparent"><title>${p.label}: ${opts.tipFormat ? opts.tipFormat(p.v) : p.v.toFixed(1)}</title></circle>
        <circle cx="${px}" cy="${py}" r="3" fill="#0b1116" stroke="${color}" stroke-width="2"/>
      </g>`;
    })
    .join('');

  const step = Math.max(1, Math.ceil(points.length / 5));
  const xLabels = points
    .map((p, i) => (i % step === 0 || i === points.length - 1
      ? `<text x="${x(i)}" y="${H - 8}" fill="#64778a" font-size="9" text-anchor="middle" font-family="ui-monospace,monospace">${p.label}</text>`
      : ''))
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${opts.aria || 'chart'}">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".34"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}
    <line x1="${pad.l}" x2="${W - pad.r}" y1="${avgY}" y2="${avgY}" stroke="${color}" stroke-opacity=".34" stroke-dasharray="4 6"/>
    <path d="${areaPts}" fill="url(#${id})"/>
    <path d="${linePts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"
      style="filter: drop-shadow(0 0 8px ${color}66)"/>
    ${dots}
    ${xLabels}
  </svg>`;
}

/** Bar chart. */
export function barChart(container, series, opts = {}) {
  if (!container) return;
  const points = (series || []).filter((p) => p && Number.isFinite(p.v));
  if (!points.length) {
    container.innerHTML = empty(opts.emptyText || 'Nothing recorded yet.');
    return;
  }
  const W = 520;
  const H = opts.height || 180;
  const pad = { l: 42, r: 14, t: 20, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = opts.max !== undefined ? opts.max : niceMax(Math.max(...points.map((p) => p.v)) * 1.12);
  const min = opts.min !== undefined ? opts.min : 0;
  const color = opts.color || '#ffc542';
  const id = `bgrad-${++uid}`;

  const slot = innerW / points.length;
  const barW = Math.max(6, Math.min(34, slot * 0.55));
  const y = scaleLinear(min, max, pad.t + innerH, pad.t);

  const grid = axisLabels([min, max], 4)
    .map((v) => {
      const gy = y(v);
      const label = opts.yFormat ? opts.yFormat(v) : Math.round(v);
      return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}" stroke="rgba(255,255,255,.07)" stroke-dasharray="3 5"/>
        <text x="${pad.l - 8}" y="${gy + 3.5}" fill="#64778a" font-size="9" text-anchor="end" font-family="ui-monospace,monospace">${label}</text>`;
    })
    .join('');

  const bars = points
    .map((p, i) => {
      const cx = pad.l + slot * i + slot / 2;
      const bh = Math.max(2, pad.t + innerH - y(p.v));
      return `<g>
        <rect x="${cx - barW / 2}" y="${pad.t + innerH - bh}" width="${barW}" height="${bh}" rx="2" fill="url(#${id})">
          <title>${p.label}: ${opts.tipFormat ? opts.tipFormat(p.v) : p.v}</title>
        </rect>
        <rect x="${cx - barW / 2}" y="${pad.t + innerH - bh}" width="${barW}" height="2" rx="1" fill="${color}"/>
      </g>`;
    })
    .join('');

  const step = Math.max(1, Math.ceil(points.length / 6));
  const xLabels = points
    .map((p, i) => (i % step === 0 || i === points.length - 1
      ? `<text x="${pad.l + slot * i + slot / 2}" y="${H - 8}" fill="#64778a" font-size="9" text-anchor="middle" font-family="ui-monospace,monospace">${p.label}</text>`
      : ''))
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${opts.aria || 'chart'}">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".95"/>
        <stop offset="100%" stop-color="${color}" stop-opacity=".22"/>
      </linearGradient>
    </defs>
    ${grid}${bars}${xLabels}
  </svg>`;
}
