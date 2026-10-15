import { useMemo, useRef, useState } from 'react';

// Fixed series order + colors (validated for colour-blind separation, light surface).
export const SERIES = [
  { key: 'solar', label: 'Solar', color: '#eda100', on: true },
  { key: 'inverter', label: 'Inverter', color: '#2a78d6', on: false },
  { key: 'eps', label: 'EPS Power', color: '#eb6834', on: false },
  { key: 'battery', label: 'Battery Charging', color: '#1baf7a', on: true },
  { key: 'consumption', label: 'Consumption', color: '#6250d6', on: true },
  { key: 'grid', label: 'Export', color: '#008300', on: true },
];
const SOC = { key: 'soc', label: 'Battery SOC', color: '#5b6573' };

const W = 340, H = 220, PAD = { l: 44, r: 10, t: 12, b: 26 };
const SOC_H = 64;
const minutes = (t) => { const [h, m] = t.slice(11, 16).split(':').map(Number); return h * 60 + m; };
const xOf = (min) => PAD.l + (min / 1440) * (W - PAD.l - PAD.r);

function niceStep(range) {
  const raw = range / 4, mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
}

export default function EnergyGraph({ points = [] }) {
  const [enabled, setEnabled] = useState(() => new Set([...SERIES.filter((s) => s.on).map((s) => s.key)]));
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const visible = SERIES.filter((s) => enabled.has(s.key));
  const showSoc = enabled.has('soc');

  const { yMin, yMax, ticks } = useMemo(() => {
    const vals = points.flatMap((p) => visible.map((s) => p[s.key]).filter((v) => v != null));
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    if (hi - lo < 100) hi = lo + 1000;
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const t = []; for (let v = lo; v <= hi + 1e-9; v += step) t.push(v);
    return { yMin: lo, yMax: hi, ticks: t };
  }, [points, visible]);

  const yOf = (v) => PAD.t + ((yMax - v) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const line = (key, y = yOf) => points.filter((p) => p[key] != null)
    .map((p, i) => `${i ? 'L' : 'M'}${xOf(minutes(p.time)).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');
  const socY = (v) => 6 + ((100 - v) / 100) * (SOC_H - 20);

  function onMove(e) {
    if (!points.length) return;
    const box = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const min = ((x - PAD.l) / (W - PAD.l - PAD.r)) * 1440;
    let best = points[0];
    for (const p of points) if (Math.abs(minutes(p.time) - min) < Math.abs(minutes(best.time) - min)) best = p;
    setHover(best);
  }

  const toggle = (key) => setEnabled((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const fmtW = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} kW` : `${Math.round(v)} W`);

  return (
    <div className="graph">
      <div className="graph-unit">W</div>
      <div className="graph-plot" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="graph-svg" role="img" aria-label="Today's power curve">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} className={t === 0 ? 'axis-zero' : 'grid-line'} />
              <text x={PAD.l - 6} y={yOf(t) + 3} textAnchor="end" className="tick">{t.toLocaleString()}</text>
            </g>
          ))}
          {[0, 240, 480, 720, 960, 1200].map((m) => (
            <text key={m} x={xOf(m)} y={H - 6} textAnchor="middle" className="tick">{String(m / 60).padStart(2, '0')}:00</text>
          ))}
          {visible.map((s) => (
            <path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover && (
            <g>
              <line x1={xOf(minutes(hover.time))} x2={xOf(minutes(hover.time))} y1={PAD.t} y2={H - PAD.b} className="crosshair" />
              {visible.map((s) => hover[s.key] != null && (
                <circle key={s.key} cx={xOf(minutes(hover.time))} cy={yOf(hover[s.key])} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>

        {showSoc && (
          <svg viewBox={`0 0 ${W} ${SOC_H}`} className="graph-svg" role="img" aria-label="Battery state of charge today">
            <text x={PAD.l - 6} y={socY(100) + 3} textAnchor="end" className="tick">100%</text>
            <text x={PAD.l - 6} y={socY(0) + 3} textAnchor="end" className="tick">0%</text>
            <line x1={PAD.l} x2={W - PAD.r} y1={socY(0)} y2={socY(0)} className="grid-line" />
            <line x1={PAD.l} x2={W - PAD.r} y1={socY(100)} y2={socY(100)} className="grid-line" />
            <path d={line('soc', socY)} fill="none" stroke={SOC.color} strokeWidth="2" />
            {hover?.soc != null && <circle cx={xOf(minutes(hover.time))} cy={socY(hover.soc)} r="4" fill={SOC.color} stroke="#fff" strokeWidth="2" />}
          </svg>
        )}

        {hover && (
          <div className="tooltip" style={{ left: `${Math.min(70, Math.max(2, (xOf(minutes(hover.time)) / W) * 100 - 15))}%` }}>
            <div className="tooltip-time">{hover.time.slice(11, 16)}</div>
            {[...visible, ...(showSoc ? [SOC] : [])].map((s) => hover[s.key] != null && (
              <div key={s.key} className="tooltip-row">
                <span className="dot" style={{ background: s.color }} />{s.label}
                <b>{s.key === 'soc' ? `${hover.soc}%` : fmtW(hover[s.key])}</b>
              </div>
            ))}
          </div>
        )}
        {!points.length && <div className="graph-empty">No data for today yet</div>}
      </div>

      <div className="chips">
        {[...SERIES.slice(0, 3), SOC, ...SERIES.slice(3)].map((s) => (
          <button key={s.key} className={enabled.has(s.key) ? 'chip on' : 'chip'} onClick={() => toggle(s.key)} aria-pressed={enabled.has(s.key)}>
            <span className="dot" style={{ background: enabled.has(s.key) ? s.color : '#c9ced4' }} />{s.label}
          </button>
        ))}
      </div>
      <p className="graph-note">Battery: + charging / − discharging · Export: + to grid / − from grid</p>
    </div>
  );
}
