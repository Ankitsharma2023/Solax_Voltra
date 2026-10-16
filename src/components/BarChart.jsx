import { useState } from 'react';

// Grouped bar chart (kWh). `series`: [{ key, label, color }], `rows`: [{ label, [key]: number }]
export default function BarChart({ rows, series, unit = 'kWh' }) {
  const [hover, setHover] = useState(null);
  const W = 340, H = 200, PAD = { l: 36, r: 6, t: 10, b: 24 };
  const max = Math.max(0, ...rows.flatMap((r) => series.map((s) => Math.abs(r[s.key] || 0)))) || 1;
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step || 1;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const plotW = W - PAD.l - PAD.r, slot = plotW / Math.max(rows.length, 1);
  const gap = 2, bw = Math.max(2, Math.min(14, (series.length === 1 ? slot * 0.62 : slot - 6) / series.length - gap));
  const y = (v) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const labelEvery = Math.ceil(rows.length / 8);

  return (
    <div className="graph-plot" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg" role="img" aria-label={`Energy chart in ${unit}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis-zero' : 'grid-line'} />
            <text x={PAD.l - 5} y={y(t) + 3} textAnchor="end" className="tick">{+t.toFixed(2)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x0 = PAD.l + i * slot + (slot - series.length * (bw + gap)) / 2;
          return (
            <g key={r.label} onPointerEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill={hover === i ? '#f3f5f7' : 'transparent'} />
              {series.map((s, j) => {
                const v = Math.abs(r[s.key] || 0), h = y(0) - y(v);
                return h > 0 && (
                  <path key={s.key} d={roundTop(x0 + j * (bw + gap), y(v), bw, h)} fill={s.color} className="bar-grow" />
                );
              })}
              {i % labelEvery === 0 && <text x={PAD.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="tick">{r.short ?? r.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover != null && rows[hover] && (
        <div className="tooltip" style={{ left: `${Math.min(62, Math.max(2, ((PAD.l + hover * slot) / W) * 100 - 15))}%` }}>
          <div className="tooltip-time">{rows[hover].label}</div>
          {series.map((s) => (
            <div key={s.key} className="tooltip-row"><span className="dot" style={{ background: s.color }} />{s.label}
              <b>{Math.abs(rows[hover][s.key] || 0).toFixed(2)} {unit}</b></div>
          ))}
        </div>
      )}
      {!rows.length && <div className="graph-empty">No data for this period</div>}
    </div>
  );
}

function niceStep(max) {
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
}

// Bar with 3px rounded top, square at the baseline.
function roundTop(x, y, w, h) {
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
