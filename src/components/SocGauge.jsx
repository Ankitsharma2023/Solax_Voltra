// 270° arc gauge, open at the bottom (like the SolaX app's battery dial).
export default function SocGauge({ value, size = 120 }) {
  const r = 44, c = 2 * Math.PI * r, arc = c * 0.75;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Battery ${pct.toFixed(1)}%`}>
      <g transform="rotate(135 50 50)">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#eef1f4" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`} />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(arc * pct) / 100} ${c}`} style={{ transition: 'stroke-dasharray .6s' }} />
      </g>
      <text x="50" y="56" textAnchor="middle" className="gauge-num">
        {value == null ? '--' : pct.toFixed(1)}<tspan className="gauge-unit" dx="1">%</tspan>
      </text>
    </svg>
  );
}
