/* ============================================================
   utils.js — formatting helpers
   ============================================================ */

export const fmt = {
  int(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  },
  pct(v, digits = 1) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    return `${v.toFixed(digits)}%`;
  },
  ms(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    return `${Math.round(v)} ms`;
  },
  msShort(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    return `${Math.round(v)}`;
  },
  dur(ms) {
    if (!ms || !Number.isFinite(ms)) return '0s';
    const total = Math.round(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  },
  clock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },
  date(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return `Today ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  },
  ago(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  },
  escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};
