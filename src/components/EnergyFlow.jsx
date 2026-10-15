import { power } from '../api.js';
import { ChevronIcon } from './Icons.jsx';

// Isometric house: left gable wall, right side wall, visible right roof slope.
const APEX = [125, 115];
const RIDGE = [120, -44];   // along the ridge / wall top
const SLOPE = [58, 95];     // down the roof slope
const roof = (a, b) => [APEX[0] + a * RIDGE[0] + b * SLOPE[0], APEX[1] + a * RIDGE[1] + b * SLOPE[1]];
const leftWall = (a, d) => [70 + a * 110, 165 + a * 40 + d];
const rightWall = (a, d) => [180 + a * 120, 205 - a * 44 + d];
const pts = (...ps) => ps.map((p) => p.join(',')).join(' ');
const quad = (f, a0, a1, b0, b1) => pts(f(a0, b0), f(a1, b0), f(a1, b1), f(a0, b1));

const PATHS = {
  solar: 'M247,141 L254,197',
  battery: 'M262,208 L283,224',
  home: 'M246,213 L214,240 L122,214',
  grid: 'M214,240 L214,293 L60,283',
};

function Flow({ id, active, reverse }) {
  return (
    <g>
      <path d={PATHS[id]} className={active ? 'flow-line on' : 'flow-line'} />
      {active && [0, 0.8, 1.6].map((delay) => (
        <circle key={delay} r="2.6" className="flow-dot">
          <animateMotion dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" path={PATHS[id]}
            keyPoints={reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />
        </circle>
      ))}
    </g>
  );
}

function Label({ style, value, title, extra, onClick }) {
  const [n, u] = power(value);
  return (
    <button className="flow-label" style={style} onClick={onClick} disabled={!onClick}>
      <span className="flow-val">{n}<small>{u}</small></span>
      <span className="flow-title">{title}{onClick && <ChevronIcon size={14} />}</span>
      {extra && <span className="flow-extra">{extra}</span>}
    </button>
  );
}

export default function EnergyFlow({ solar = 0, home = 0, battery = 0, grid = 0, soc, hasBattery, onOpen }) {
  const on = (w) => Math.abs(w) >= 5;
  return (
    <div className="flow">
      <svg viewBox="30 58 330 256" role="img"
        aria-label={`Solar ${Math.round(solar)} W, home ${Math.round(home)} W, battery ${Math.round(battery)} W, grid ${Math.round(grid)} W`}>
        <defs>
          <linearGradient id="wallL" x1="0" x2="1"><stop offset="0" stopColor="#f4f6f8" /><stop offset="1" stopColor="#e9edf1" /></linearGradient>
          <linearGradient id="wallR" x1="0" x2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f3f5f7" /></linearGradient>
          <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#56606c" /><stop offset="1" stopColor="#2f3740" /></linearGradient>
          <linearGradient id="bat" x1="0" x2="1"><stop offset="0" stopColor="#d9f5ef" /><stop offset="1" stopColor="#b5ebe0" /></linearGradient>
        </defs>

        <ellipse cx="190" cy="288" rx="170" ry="32" fill="#f3f5f7" />

        {/* walls */}
        <polygon points="70,165 125,115 180,205 180,295 70,255" fill="url(#wallL)" stroke="#e1e6eb" />
        <polygon points="180,205 300,161 300,251 180,295" fill="url(#wallR)" stroke="#e1e6eb" />

        {/* left wall: window with warm light */}
        <polygon points={quad(leftWall, 0.22, 0.62, 30, 70)} fill="#e8edf2" stroke="#d3dae1" />
        <polygon points={quad(leftWall, 0.24, 0.6, 33, 67)} fill="#fff8e6" />
        <circle cx="114" cy="214" r="5" fill="#ffe7a3" />

        {/* right wall: door, inverter, battery */}
        <polygon points={quad(rightWall, 0.12, 0.3, 38, 90)} fill="#eef1f4" stroke="#d6dce2" />
        <polygon points={quad(rightWall, 0.55, 0.68, 14, 36)} fill="#ffffff" stroke="#c9d1d9" />
        <polygon points={quad(rightWall, 0.585, 0.645, 20, 25)} fill="#2f3740" />
        <g>
          <polygon points={quad(rightWall, 0.8, 0.94, 36, 88)} fill="url(#bat)" stroke="#9fdccf" />
          {[48, 58, 68, 78].map((d) => (
            <polyline key={d} points={pts(rightWall(0.8, d), rightWall(0.94, d))} stroke="#8ed3c4" strokeWidth="1" fill="none" />
          ))}
        </g>

        {/* roof */}
        <polygon points="125,115 245,71 303,166 183,210" fill="#f8f9fa" stroke="#dde3e9" />
        <polyline points="183,210 303,166" stroke="#cfd6dd" strokeWidth="3" fill="none" />
        {[[0.07, 0.46], [0.54, 0.93]].map(([a0, a1]) => (
          <g key={a0}>
            <polygon points={quad(roof, a0, a1, 0.12, 0.84)} fill="url(#panel)" stroke="#1f262d" strokeWidth=".8" />
            {[0.3, 0.48, 0.66].map((b) => <polyline key={b} points={pts(roof(a0, b), roof(a1, b))} stroke="#6b7682" strokeWidth=".6" fill="none" />)}
            {[1 / 3, 2 / 3].map((t) => {
              const a = a0 + (a1 - a0) * t;
              return <polyline key={t} points={pts(roof(a, 0.12), roof(a, 0.84))} stroke="#6b7682" strokeWidth=".6" fill="none" />;
            })}
          </g>
        ))}

        {/* grid pylon */}
        <g stroke="#aab4be" strokeWidth="1.4" fill="none">
          <path d="M48,214 L36,286 M48,214 L60,286 M36,232 H60 M39,248 H57 M40,248 L56,266 M56,248 L40,266 M38,266 H58" />
          <path d="M30,232 H66" />
        </g>

        {/* flows */}
        <Flow id="solar" active={on(solar)} />
        {hasBattery && <Flow id="battery" active={on(battery)} reverse={battery < 0} />}
        <Flow id="home" active={on(home)} />
        <Flow id="grid" active={on(grid)} reverse={grid < 0} />
        <circle cx="214" cy="240" r="3" fill="#fff" stroke="#9fb0bf" strokeWidth="1.5" />
      </svg>

      <Label style={{ left: '3%', top: '18%' }} value={home} title="Home" />
      <Label style={{ right: '2%', top: '2%' }} value={solar} title="Solar" onClick={() => onOpen?.('device')} />
      {hasBattery && (
        <Label style={{ right: '0%', top: '30%' }} value={battery} title="Battery"
          extra={soc != null ? `${Number(soc).toFixed(1)}%` : null} onClick={() => onOpen?.('device')} />
      )}
      <Label style={{ right: '2%', top: '70%' }} value={grid} title="Grid" />
    </div>
  );
}
