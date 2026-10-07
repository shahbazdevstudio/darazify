import { esc, formatPrice } from '../utils.js';

const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n));

const niceMax = (max) => {
  if (max <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};

/** Inline SVG bar chart of daily revenue (no chart library needed). */
export function revenueChart(daily) {
  const W = 720, H = 270, pl = 54, pr = 10, pt = 14, pb = 32;
  const max = niceMax(Math.max(...daily.map((d) => d.revenue), 0));
  const iw = W - pl - pr, ih = H - pt - pb;
  const step = iw / daily.length, bw = Math.min(34, step * 0.58);
  const y = (v) => pt + ih - (v / max) * ih;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const v = max * t;
    return `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="ch-grid"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" class="ch-label">${compact(v)}</text>`;
  }).join('');

  const bars = daily.map((d, i) => {
    const x = pl + i * step + (step - bw) / 2;
    const h = Math.max(d.revenue ? 3 : 0, ih - (y(d.revenue) - pt));
    const day = new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `<g class="ch-bar"><rect x="${x}" y="${pt + ih - h}" width="${bw}" height="${h}" rx="6"><title>${esc(day)}: ${esc(formatPrice(d.revenue))}, ${d.orders} order${d.orders === 1 ? '' : 's'}</title></rect>
      <text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle" class="ch-label">${new Date(d.date).getDate()}</text></g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Revenue for the last 14 days">${grid}${bars}</svg>`;
}

/** Horizontal distribution bars for order statuses. */
export function statusBars(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(counts).map(([s, n]) => `
    <div class="sbar"><div class="sbar__top"><span>${esc(s)}</span><b>${n}</b></div><div class="sbar__track"><i class="sbar--${s.toLowerCase()}" style="width:${(n / total) * 100}%"></i></div></div>`).join('');
}
