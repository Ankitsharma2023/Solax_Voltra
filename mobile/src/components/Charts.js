import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { C } from '../theme';

// Phone versions of the web app's charts (LineChart in Device.jsx, BarChart.jsx). Tap to read a value.

const W = 340, H = 200;
const tickText = { fontSize: 9, fill: C.muted };

// rows from /history or /day → [{ min, v, t }]
export const toPoints = (rows = [], get) => (rows ?? []).map((r) => {
  const v = get(r);
  if (v == null) return null;
  const t = (r.plantLocalTime || r.time).slice(11, 16);
  const [h, m] = t.split(':').map(Number);
  return { min: h * 60 + m, v, t };
}).filter(Boolean);

// One series over a day (00:00–24:00).
export function LineChart({ pts, label, color = C.accent, fill }) {
  const [hover, setHover] = useState(null);
  const [w, setW] = useState(0);
  const L = 40, R = 8, T = 10, B = 24;
  const lo = Math.min(0, ...pts.map((p) => p.v)), hi = Math.max(1, ...pts.map((p) => p.v));
  const pad = (hi - lo) * 0.1 || 1, top = hi + pad, bot = lo < 0 ? lo - pad : 0;
  const x = (m) => L + (m / 1440) * (W - L - R), y = (v) => T + ((top - v) / (top - bot)) * (H - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.min).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = pts.length ? `${d}L${x(pts.at(-1).min).toFixed(1)},${y(Math.max(bot, 0))}L${x(pts[0].min).toFixed(1)},${y(Math.max(bot, 0))}Z` : '';
  const ticks = Array.from({ length: 5 }, (_, i) => bot + ((top - bot) * i) / 4);
  const pick = (px) => {
    if (!pts.length || !w) return;
    const m = (((px / w) * W - L) / (W - L - R)) * 1440;
    setHover(pts.reduce((a, p) => (Math.abs(p.min - m) < Math.abs(a.min - m) ? p : a), pts[0]));
  };
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Pressable onPressIn={(e) => pick(e.nativeEvent.locationX)} onPressOut={() => setTimeout(() => setHover(null), 2500)}>
        <Svg width="100%" height={w ? (w * H) / W : H} viewBox={`0 0 ${W} ${H}`}>
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} />
              <SvgText x={L - 5} y={y(t) + 3} textAnchor="end" {...tickText}>{Math.abs(t) >= 100 ? Math.round(t) : t.toFixed(1)}</SvgText>
            </G>
          ))}
          {[0, 240, 480, 720, 960, 1200].map((m) => <SvgText key={m} x={x(m)} y={H - 6} textAnchor="middle" {...tickText}>{String(m / 60).padStart(2, '0')}:00</SvgText>)}
          {fill && !!area && <Path d={area} fill={color} opacity={0.12} />}
          {!!d && <Path d={d} fill="none" stroke={color} strokeWidth={2} />}
          {hover && (
            <G>
              <Line x1={x(hover.min)} x2={x(hover.min)} y1={T} y2={H - B} stroke={C.muted} strokeDasharray="3 3" />
              <Circle cx={x(hover.min)} cy={y(hover.v)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
            </G>
          )}
        </Svg>
      </Pressable>
      {hover && <Text style={cs.readout}>{hover.t} · {label}: <Text style={{ fontWeight: '700', color: C.ink }}>{hover.v}</Text></Text>}
      {!pts.length && <Text style={cs.empty}>No data today</Text>}
    </View>
  );
}

// Grouped bars (kWh). series: [{ key, label, color }], rows: [{ label, short, [key]: number }]
export function BarChart({ rows, series, unit = 'kWh' }) {
  const [hover, setHover] = useState(null);
  const [w, setW] = useState(0);
  const PAD = { l: 36, r: 6, t: 10, b: 24 };
  const max = Math.max(0, ...rows.flatMap((r) => series.map((sr) => Math.abs(r[sr.key] || 0)))) || 1;
  const step = niceStep(max), top = Math.ceil(max / step) * step || 1;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const plotW = W - PAD.l - PAD.r, slot = plotW / Math.max(rows.length, 1);
  const gap = 2, bw = Math.max(2, Math.min(14, (series.length === 1 ? slot * 0.62 : slot - 6) / series.length - gap));
  const y = (v) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const every = Math.ceil(rows.length / 8);
  const pick = (px) => { if (!w) return; const i = Math.floor((((px / w) * W) - PAD.l) / slot); if (i >= 0 && i < rows.length) setHover(i); };
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Pressable onPressIn={(e) => pick(e.nativeEvent.locationX)}>
        <Svg width="100%" height={w ? (w * H) / W : H} viewBox={`0 0 ${W} ${H}`}>
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#c9ced4' : C.line} strokeWidth={1} />
              <SvgText x={PAD.l - 5} y={y(t) + 3} textAnchor="end" {...tickText}>{+t.toFixed(2)}</SvgText>
            </G>
          ))}
          {rows.map((r, i) => {
            const x0 = PAD.l + i * slot + (slot - series.length * (bw + gap)) / 2;
            return (
              <G key={r.label}>
                {hover === i && <Rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill={C.soft} />}
                {series.map((sr, j) => {
                  const v = Math.abs(r[sr.key] || 0), h = y(0) - y(v);
                  return h > 0 && <Rect key={sr.key} x={x0 + j * (bw + gap)} y={y(v)} width={bw} height={h} rx={Math.min(3, bw / 2)} fill={sr.color} />;
                })}
                {i % every === 0 && <SvgText x={PAD.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" {...tickText}>{r.short ?? r.label}</SvgText>}
              </G>
            );
          })}
        </Svg>
      </Pressable>
      {hover != null && rows[hover] && (
        <View style={cs.tip}>
          <Text style={cs.tipTime}>{rows[hover].label}</Text>
          {series.map((sr) => (
            <Text key={sr.key} style={cs.tipRow}><Text style={{ color: sr.color }}>● </Text>{sr.label}: <Text style={{ fontWeight: '700', color: C.ink }}>{Math.abs(rows[hover][sr.key] || 0).toFixed(2)} {unit}</Text></Text>
          ))}
        </View>
      )}
      {!rows.length && <Text style={cs.empty}>No data for this period</Text>}
    </View>
  );
}

function niceStep(max) {
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) || raw;
}

const cs = StyleSheet.create({
  readout: { textAlign: 'center', color: C.muted, fontSize: 13, marginTop: 4 },
  empty: { textAlign: 'center', color: C.muted, fontSize: 13, marginTop: -100, marginBottom: 80 },
  tip: { backgroundColor: C.soft, borderRadius: 10, padding: 10, marginTop: 6, gap: 2 },
  tipTime: { fontWeight: '600', color: C.ink, fontSize: 13 },
  tipRow: { color: C.muted, fontSize: 13 },
});
