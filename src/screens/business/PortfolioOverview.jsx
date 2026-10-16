import { useEffect, useState } from 'react';
import BarChart from '../../components/BarChart.jsx';
import CountUp from '../../components/CountUp.jsx';
import { api, useApi } from '../../api.js';

// Portfolio home for installers, distributors and Voltra admins, laid out like the iSolarFlow / SolaX
// business app: generation card, plant status ring, live power + capacity, generation statistics.

// kWh → [value, unit, digits], switching to MWh / GWh like the reference app.
export function energy(kwh) {
  const v = Number(kwh) || 0;
  if (v >= 1e6) return [v / 1e6, 'GWh', 3];
  if (v >= 1e3) return [v / 1e3, 'MWh', 3];
  return [v, 'kWh', 2];
}

export function GenerationCard({ s }) {
  const [d, du, dd] = energy(s.dailyYield), [t, tu, td] = energy(s.totalYield);
  return (
    <div className="card gen-card pop-in">
      <div className="gen-nums">
        <div><b><CountUp value={d} digits={dd} /></b><small>{du}</small><span>Daily Generation</span></div>
        <div><b><CountUp value={t} digits={td} /></b><small>{tu}</small><span>Total Power Generation</span></div>
      </div>
      <HouseArt />
    </div>
  );
}

const STATUS = [
  ['normal', 'Normal', '#1baf7a'],
  ['alarm', 'Fault', '#ef5350'],
  ['offline', 'Offline', '#7b8494'],
  ['connecting', 'Connecting', '#f59e0b'],
];

export function StatusCard({ s, onStatus }) {
  const counts = { ...s, connecting: s.connecting ?? Math.max(0, s.plants - s.normal - s.alarm - s.offline) };
  const kw = (s.solarW || 0) / 1000;
  return (
    <div className="card status-card pop-in" style={{ animationDelay: '60ms' }}>
      <div className="status-top">
        <button className="ring-wrap" onClick={() => onStatus?.('All')} aria-label={`${s.plants} plants`}>
          <StatusRing counts={counts} total={s.plants} />
          <span className="muted">Total</span>
        </button>
        <ul className="status-legend">
          {STATUS.map(([k, label, c]) => (
            <li key={k}><button onClick={() => onStatus?.(label)}>
              <span className="sq" style={{ background: c }} />{label}<b><CountUp value={counts[k]} digits={0} /></b>
            </button></li>
          ))}
        </ul>
      </div>
      <div className="status-tiles">
        <div><b><CountUp value={kw} digits={3} /> kW</b><span>Real Time Power</span></div>
        <div><b><CountUp value={s.capacityKwp} digits={2} /> kWp</b><span>Installed Capacity</span></div>
      </div>
    </div>
  );
}

// Donut split by plant status; the arcs draw in on load.
function StatusRing({ counts, total }) {
  const R = 52, C = 2 * Math.PI * R, GAP = total > 1 ? 4 : 0;
  let at = 0;
  const arcs = STATUS.map(([k, , c]) => {
    const len = total ? (counts[k] / total) * C : 0;
    const arc = len > 0 && { k, c, len: Math.max(0, len - GAP), off: at };
    at += len;
    return arc;
  }).filter(Boolean);
  return (
    <div className="ring">
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle cx="64" cy="64" r={R} fill="none" stroke="#eef0f3" strokeWidth="9" />
        {arcs.map((a, i) => (
          <circle key={a.k} cx="64" cy="64" r={R} fill="none" stroke={a.c} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${a.len} ${C}`} strokeDashoffset={-a.off} transform="rotate(-90 64 64)"
            className="ring-arc" style={{ '--len': a.len, animationDelay: `${i * 120}ms` }} />
        ))}
      </svg>
      <b><CountUp value={total} digits={0} /></b>
    </div>
  );
}

// ---------- Generation Statistics: Daily / Month / Year / Total ----------
const PERIODS = ['Daily', 'Month', 'Year', 'Total'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SERIES = [{ key: 'kwh', label: 'Generation', color: '#14b8a6' }];
// Generation = inverter output (SolaX "yield", what Daily/Total Generation above show).
const gen = (r) => r.inverterACOutputEnergy || r.pvGeneration || 0;
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 10); };

function shift(date, period, n) {
  const [y, m, d] = date.split('-').map(Number);
  if (period === 'Daily') return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  if (period === 'Month') return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
  return `${y + n}-01-01`;
}
const shown = (date, period) => (period === 'Daily' ? date.split('-').reverse().join('-')
  : period === 'Month' ? `${date.slice(5, 7)}-${date.slice(0, 4)}` : date.slice(0, 4));
const key = (date, period) => (period === 'Daily' ? date : period === 'Month' ? date.slice(0, 7) : date.slice(0, 4));

export function GenerationStats() {
  const [period, setPeriod] = useState('Daily');
  const [date, setDate] = useState(today);
  const [total, setTotal] = useState(null);
  const path = period === 'Daily' ? `/api/portfolio/day?date=${date}`
    : period === 'Month' ? `/api/portfolio/stats?dateType=2&date=${date.slice(0, 7)}`
    : period === 'Year' ? `/api/portfolio/stats?dateType=1&date=${date.slice(0, 4)}` : null;
  const res = useApi(path);

  // Total: one bar per year, back to the first year with generation (up to 10 years).
  useEffect(() => {
    if (period !== 'Total' || total) return;
    const y0 = new Date().getFullYear();
    Promise.all(Array.from({ length: 10 }, (_, i) => api(`/api/portfolio/stats?dateType=1&date=${y0 - 9 + i}`)
      .then((r) => ({ label: String(y0 - 9 + i), short: String(y0 - 9 + i), kwh: (r.plantEnergyStatDataList ?? []).reduce((a, x) => a + gen(x), 0) }))
      .catch(() => ({ label: String(y0 - 9 + i), short: String(y0 - 9 + i), kwh: 0 }))))
      .then((rows) => { const first = rows.findIndex((r) => r.kwh > 0); setTotal(first < 0 ? rows.slice(-1) : rows.slice(Math.min(first, rows.length - 1))); });
  }, [period, total]);

  let rows = null;
  if (period === 'Total') rows = total;
  else if (res.data && res.data.date !== undefined) {
    if (period === 'Daily') rows = (res.data.hours ?? []).map((kwh, h) => ({ label: `${String(h).padStart(2, '0')}:00`, short: String(h), kwh }));
    else {
      const by = new Map((res.data.plantEnergyStatDataList ?? []).map((r) => [r.date, gen(r)]));
      const [y, m] = date.split('-').map(Number);
      rows = period === 'Month'
        ? Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => { const k = `${date.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`; return { label: k, short: String(i + 1), kwh: by.get(k) || 0 }; })
        : Array.from({ length: 12 }, (_, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`; return { label: `${MONTHS[i]} ${y}`, short: MONTHS[i], kwh: by.get(k) || 0 }; });
    }
  }
  const sum = rows?.reduce((a, r) => a + r.kwh, 0) ?? 0;
  const [v, u, dg] = energy(sum);
  const atNow = key(date, period) >= key(today(), period);

  return (
    <div className="card pop-in" style={{ animationDelay: '120ms' }}>
      <h3 className="card-title">Generation Statistics</h3>
      <div className="underline-tabs" role="tablist">
        {PERIODS.map((p) => (
          <button key={p} role="tab" aria-selected={period === p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>
      {period !== 'Total' && (
        <div className="date-nav">
          <button aria-label="Previous" onClick={() => setDate(shift(date, period, -1))}>‹</button>
          <b>{shown(date, period)}</b>
          <button aria-label="Next" disabled={atNow} onClick={() => setDate(shift(date, period, 1))}>›</button>
        </div>
      )}
      <div className="gen-sum"><span className="muted">Generation</span><b>{rows ? v.toFixed(dg) : '--'} <small>{u}</small></b></div>
      <div className="graph-unit">kWh</div>
      {res.error && period !== 'Total' ? <div className="empty err">{res.error.message}</div>
        : !rows || (res.loading && period !== 'Total') ? <div className="skeleton" style={{ height: 200 }} />
        : <BarChart rows={rows} series={SERIES} />}
    </div>
  );
}

// Green isometric house with rooftop solar, battery and inverter (stands in for the reference app's render).
function HouseArt() {
  return (
    <svg className="house-art" viewBox="0 0 160 130" aria-hidden="true">
      <defs>
        <linearGradient id="ha-wall" x1="0" x2="1"><stop offset="0" stopColor="#e9f7f1" /><stop offset="1" stopColor="#ffffff" /></linearGradient>
        <linearGradient id="ha-side" x1="0" x2="1"><stop offset="0" stopColor="#c9eedd" /><stop offset="1" stopColor="#a8e2c8" /></linearGradient>
        <linearGradient id="ha-pv" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#3c4a5c" /><stop offset="1" stopColor="#1e2733" /></linearGradient>
      </defs>
      <path d="M8 98 L80 60 L152 98 L80 128 Z" fill="#dff5ea" />
      <path d="M8 98 L80 128 L80 126 L10 97Z" fill="#bfe8d4" />
      <path className="ha-wire" d="M30 99 L60 112 L96 96 L126 88" />
      <path d="M44 62 L44 98 L84 116 L84 80 Z" fill="url(#ha-wall)" stroke="#b7e3cd" strokeWidth=".6" />
      <path d="M84 80 L84 116 L124 98 L124 62 Z" fill="url(#ha-side)" stroke="#9fd9bf" strokeWidth=".6" />
      <path d="M40 64 L64 30 L104 48 L84 82 Z" fill="#f3fbf7" stroke="#b7e3cd" strokeWidth=".6" />
      <path d="M84 82 L104 48 L128 64 L124 66 Z" fill="#d4f1e3" />
      <g className="ha-panels">
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
          <path key={`${r}${c}`} transform={`translate(${c * 12.4 - r * 6.2} ${c * 5.6 + r * 9.6})`}
            d="M58 37 L69 42 L64 50.5 L53 45.5 Z" fill="url(#ha-pv)" stroke="#7fd9b7" strokeWidth=".5" />
        )))}
      </g>
      <path d="M58 104 L58 92 L66 95.6 L66 107.6 Z" fill="#6bcfa3" />
      <path d="M98 96 L98 84 L106 80.4 L106 92.4Z" fill="#e8f6ef" stroke="#9fd9bf" strokeWidth=".6" />
      <path d="M110 90 L110 76 L117 72.8 L117 86.8Z" fill="#c9eedd" stroke="#9fd9bf" strokeWidth=".6" />
      <circle className="ha-led" cx="113.5" cy="78" r="1.3" />
      <g stroke="#9fd9bf" strokeWidth="1.2" fill="none"><path d="M20 96 V64 M14 70 H26 M15 76 H25" /></g>
      <circle cx="140" cy="94" r="5" fill="#a8e2c8" /><circle cx="30" cy="108" r="4" fill="#bfe8d4" />
    </svg>
  );
}
