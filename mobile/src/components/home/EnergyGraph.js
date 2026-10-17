import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { C } from '../../theme';

// Today's power curve (web src/components/EnergyGraph.jsx). Tap the chart to read the values at that time.
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
const tick = { fontSize: 9, fill: C.muted };

function niceStep(range) {
  const raw = range / 4, mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
}

export default function EnergyGraph({ points }) {
  points = points ?? [];
  const [enabled, setEnabled] = useState(() => new Set(SERIES.filter((s) => s.on).map((s) => s.key)));
  const [hover, setHover] = useState(null);
  const [w, setW] = useState(0);

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

  function pick(px) {
    if (!points.length || !w) return;
    const min = ((((px / w) * W) - PAD.l) / (W - PAD.l - PAD.r)) * 1440;
    let best = points[0];
    for (const p of points) if (Math.abs(minutes(p.time) - min) < Math.abs(minutes(best.time) - min)) best = p;
    setHover(best);
  }

  const toggle = (key) => setEnabled((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const fmtW = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} kW` : `${Math.round(v)} W`);
  const k = w ? w / W : 1;

  return (
    <View>
      <Text style={g.unit}>W</Text>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Pressable onPressIn={(e) => pick(e.nativeEvent.locationX)}>
          <Svg width="100%" height={H * k} viewBox={`0 0 ${W} ${H}`}>
            {ticks.map((t) => (
              <G key={t}>
                <Line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? '#c9ced4' : C.line} strokeWidth={1} />
                <SvgText x={PAD.l - 6} y={yOf(t) + 3} textAnchor="end" {...tick}>{t.toLocaleString()}</SvgText>
              </G>
            ))}
            {[0, 240, 480, 720, 960, 1200].map((m) => (
              <SvgText key={m} x={xOf(m)} y={H - 6} textAnchor="middle" {...tick}>{String(m / 60).padStart(2, '0')}:00</SvgText>
            ))}
            {visible.map((s) => (
              <Path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {hover && (
              <G>
                <Line x1={xOf(minutes(hover.time))} x2={xOf(minutes(hover.time))} y1={PAD.t} y2={H - PAD.b} stroke={C.muted} strokeDasharray="3 3" />
                {visible.map((s) => hover[s.key] != null && (
                  <Circle key={s.key} cx={xOf(minutes(hover.time))} cy={yOf(hover[s.key])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
                ))}
              </G>
            )}
          </Svg>

          {showSoc && (
            <Svg width="100%" height={SOC_H * k} viewBox={`0 0 ${W} ${SOC_H}`}>
              <SvgText x={PAD.l - 6} y={socY(100) + 3} textAnchor="end" {...tick}>100%</SvgText>
              <SvgText x={PAD.l - 6} y={socY(0) + 3} textAnchor="end" {...tick}>0%</SvgText>
              <Line x1={PAD.l} x2={W - PAD.r} y1={socY(0)} y2={socY(0)} stroke={C.line} strokeWidth={1} />
              <Line x1={PAD.l} x2={W - PAD.r} y1={socY(100)} y2={socY(100)} stroke={C.line} strokeWidth={1} />
              <Path d={line('soc', socY)} fill="none" stroke={SOC.color} strokeWidth={2} />
              {hover?.soc != null && <Circle cx={xOf(minutes(hover.time))} cy={socY(hover.soc)} r={4} fill={SOC.color} stroke="#fff" strokeWidth={2} />}
            </Svg>
          )}
        </Pressable>
        {!points.length && <View style={g.emptyWrap} pointerEvents="none"><Text style={g.empty}>No data for today yet</Text></View>}
      </View>

      {hover && (
        <Pressable style={g.tip} onPress={() => setHover(null)}>
          <Text style={g.tipTime}>{hover.time.slice(11, 16)}</Text>
          {[...visible, ...(showSoc ? [SOC] : [])].map((s) => hover[s.key] != null && (
            <View key={s.key} style={g.tipRow}>
              <View style={[g.dot, { backgroundColor: s.color }]} />
              <Text style={g.tipLabel}>{s.label}</Text>
              <Text style={g.tipVal}>{s.key === 'soc' ? `${hover.soc}%` : fmtW(hover[s.key])}</Text>
            </View>
          ))}
        </Pressable>
      )}

      <Chips items={[...SERIES.slice(0, 3), SOC, ...SERIES.slice(3)]} on={enabled} onToggle={toggle} />
      <Text style={g.note}>Battery: + charging / − discharging · Export: + to grid / − from grid</Text>
    </View>
  );
}

// Legend chips that switch a series on/off (web .chips).
export function Chips({ items, on, onToggle }) {
  return (
    <View style={g.chips}>
      {items.map((s) => {
        const active = !on || on.has(s.key);
        const body = (
          <>
            <View style={[g.dot, { backgroundColor: active ? s.color : '#c9ced4' }]} />
            <Text style={[g.chipText, active && { color: C.ink }]}>{s.label}</Text>
          </>
        );
        return onToggle
          ? <Pressable key={s.key} onPress={() => onToggle(s.key)} accessibilityState={{ selected: active }} style={[g.chip, active && g.chipOn]}>{body}</Pressable>
          : <View key={s.key} style={[g.chip, g.chipOn]}>{body}</View>;
      })}
    </View>
  );
}

export const g = StyleSheet.create({
  unit: { fontSize: 11, color: C.muted, marginBottom: 2 },
  emptyWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  empty: { color: C.muted, fontSize: 13 },
  tip: { backgroundColor: C.soft, borderRadius: 10, padding: 10, marginTop: 6, gap: 3 },
  tipTime: { fontWeight: '600', color: C.ink, fontSize: 13 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipLabel: { flex: 1, color: C.muted, fontSize: 13 },
  tipVal: { fontWeight: '700', color: C.ink, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
  chipOn: { backgroundColor: C.soft, borderColor: C.soft },
  chipText: { fontSize: 12, color: C.muted },
  note: { fontSize: 11, color: C.muted, marginTop: 8 },
});
