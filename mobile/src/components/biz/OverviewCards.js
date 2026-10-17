import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { api, useApi } from '../../lib/api';
import { BarChart } from '../Charts';
import CountUp from '../CountUp';
import { PopIn } from '../me/common';
import { energy } from './portfolio';
import { C, card } from '../../theme';

// Portfolio home cards (web: src/screens/business/PortfolioOverview.jsx): generation card, plant status
// ring, live power + capacity, generation statistics, environmental benefits.

export function GenerationCard({ s }) {
  const [d, du, dd] = energy(s.dailyYield), [t, tu, td] = energy(s.totalYield);
  return (
    <PopIn style={[card, st.gen]}>
      <View style={st.genNums}>
        <View>
          <Text><CountUp value={d} digits={dd} style={st.genVal} /><Text style={st.genUnit}>  {du}</Text></Text>
          <Text style={st.genLabel}>Daily Generation</Text>
        </View>
        <View>
          <Text><CountUp value={t} digits={td} style={st.genVal} /><Text style={st.genUnit}>  {tu}</Text></Text>
          <Text style={st.genLabel}>Total Power Generation</Text>
        </View>
      </View>
      <HouseArt />
    </PopIn>
  );
}

export const STATUS = [
  ['normal', 'Normal', '#1baf7a'],
  ['alarm', 'Fault', '#ef5350'],
  ['offline', 'Offline', '#7b8494'],
  ['connecting', 'Connecting', '#f59e0b'],
];

export function StatusCard({ s, onStatus }) {
  const counts = { ...s, connecting: s.connecting ?? Math.max(0, s.plants - s.normal - s.alarm - s.offline) };
  const kw = (s.solarW || 0) / 1000;
  return (
    <PopIn delay={60} style={card}>
      <View style={st.statusTop}>
        <Pressable style={st.ringWrap} onPress={() => onStatus?.('All')} accessibilityLabel={`${s.plants} plants`}>
          <StatusRing counts={counts} total={s.plants} />
          <Text style={st.muted}>Total</Text>
        </Pressable>
        <View style={st.legend}>
          {STATUS.map(([k, label, c]) => (
            <Pressable key={k} style={({ pressed }) => [st.legendRow, pressed && { opacity: 0.6 }]} onPress={() => onStatus?.(label)}>
              <View style={[st.sq, { backgroundColor: c }]} />
              <Text style={st.legendLabel}>{label}</Text>
              <CountUp value={counts[k]} digits={0} style={st.legendVal} />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={st.statusTiles}>
        <View style={st.statusTile}>
          <Text><CountUp value={kw} digits={3} style={st.tileVal} /><Text style={st.tileVal}> kW</Text></Text>
          <Text style={st.muted}>Real Time Power</Text>
        </View>
        <View style={st.statusTile}>
          <Text><CountUp value={s.capacityKwp} digits={2} style={st.tileVal} /><Text style={st.tileVal}> kWp</Text></Text>
          <Text style={st.muted}>Installed Capacity</Text>
        </View>
      </View>
    </PopIn>
  );
}

// 0 → 1 over `ms` after `delay` (eased), for the ring arcs drawing in.
function useProgress(ms = 900, deps = []) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const start = Date.now();
    let raf;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      setP(1 - (1 - t) ** 3);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return p;
}

// Donut split by plant status; the arcs draw in one after another.
function StatusRing({ counts, total }) {
  const R = 52, CIRC = 2 * Math.PI * R, GAP = total > 1 ? 4 : 0;
  const STAGGER = 120, DRAW = 900;
  const elapsed = useProgress(DRAW + STAGGER * 3, [total, counts.normal, counts.alarm, counts.offline]) * (DRAW + STAGGER * 3);
  let at = 0;
  const arcs = STATUS.map(([k, , c]) => {
    const len = total ? (counts[k] / total) * CIRC : 0;
    const arc = len > 0 && { k, c, len: Math.max(0, len - GAP), off: at };
    at += len;
    return arc;
  }).filter(Boolean);
  return (
    <View style={st.ring}>
      <Svg width={112} height={112} viewBox="0 0 128 128">
        <Circle cx={64} cy={64} r={R} fill="none" stroke="#eef0f3" strokeWidth={9} />
        <G transform="rotate(-90 64 64)">
          {arcs.map((a, i) => {
            const t = Math.max(0, Math.min(1, (elapsed - i * STAGGER) / DRAW));
            const shown = a.len * (1 - (1 - t) ** 2);
            return shown > 0.5 && (
              <Circle key={a.k} cx={64} cy={64} r={R} fill="none" stroke={a.c} strokeWidth={9} strokeLinecap="round"
                strokeDasharray={`${shown} ${CIRC}`} strokeDashoffset={-a.off} />
            );
          })}
        </G>
      </Svg>
      <View style={st.ringNum} pointerEvents="none"><CountUp value={total} digits={0} style={st.ringVal} /></View>
    </View>
  );
}

// ---------- Generation Statistics: Daily / Month / Year / Total ----------
const PERIODS = ['Daily', 'Month', 'Year', 'Total'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SERIES = [{ key: 'kwh', label: 'Generation', color: C.accent }];
// Generation = inverter output (SolaX "yield", what Daily/Total Generation above show).
const gen = (r) => r.inverterACOutputEnergy || r.pvGeneration || 0;
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 10); };

function shift(date, period, n) {
  const [y, m, d] = date.split('-').map(Number);
  if (period === 'Daily') return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  if (period === 'Month') return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
  return `${y + n}-01-01`;
}
const shownDate = (date, period) => (period === 'Daily' ? date.split('-').reverse().join('-')
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
    <PopIn delay={120} style={card}>
      <Text style={st.cardTitle}>Generation Statistics</Text>
      <UnderlineTabs options={PERIODS} value={period} onChange={setPeriod} />
      {period !== 'Total' && (
        <View style={st.dateNav}>
          <Pressable style={st.dateBtn} onPress={() => setDate(shift(date, period, -1))} accessibilityLabel="Previous" hitSlop={6}><Text style={st.dateArrow}>‹</Text></Pressable>
          <Text style={st.dateText}>{shownDate(date, period)}</Text>
          <Pressable style={[st.dateBtn, atNow && { opacity: 0.35 }]} disabled={atNow} onPress={() => setDate(shift(date, period, 1))} accessibilityLabel="Next" hitSlop={6}><Text style={st.dateArrow}>›</Text></Pressable>
        </View>
      )}
      <View style={st.genSum}>
        <Text style={st.muted}>Generation</Text>
        <Text style={st.genSumVal}>{rows ? v.toFixed(dg) : '--'} <Text style={st.muted}>{u}</Text></Text>
      </View>
      <Text style={[st.small, { marginBottom: 4 }]}>kWh</Text>
      {res.error && period !== 'Total' ? <Text style={st.err}>{res.error.message}</Text>
        : !rows || (res.loading && period !== 'Total') ? <View style={st.skeleton} />
        : <BarChart rows={rows} series={SERIES} />}
    </PopIn>
  );
}

// Tabs with a teal underline that slides to the chosen one (web .underline-tabs).
function UnderlineTabs({ options, value, onChange }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(options.indexOf(value))).current;
  useEffect(() => {
    Animated.timing(x, { toValue: options.indexOf(value), duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [value, options, x]);
  const slot = w / options.length;
  return (
    <View style={st.uTabs} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {options.map((o) => (
        <Pressable key={o} style={st.uTab} onPress={() => onChange(o)} accessibilityRole="tab" accessibilityState={{ selected: o === value }}>
          <Text style={[st.uTabText, o === value && st.uTabOn]}>{o}</Text>
        </Pressable>
      ))}
      {w > 0 && (
        <Animated.View style={[st.uBar, { width: slot * 0.56, left: slot * 0.22, transform: [{ translateX: Animated.multiply(x, slot) }] }]} />
      )}
    </View>
  );
}

// ---------- Environmental Benefits (all plants) ----------
export function Benefits({ totalKwh }) {
  const co2 = ((Number(totalKwh) || 0) * 0.997) / 1000;
  return (
    <PopIn delay={160} style={card}>
      <Text style={[st.cardTitle, { marginBottom: 12 }]}>Environmental Benefits · all plants</Text>
      <View style={st.benefits}>
        <Benefit bg="#fff3ec" value={co2} unit="t" label="CO₂ Saved" art="☁" />
        <Benefit bg="#eaf8f1" value={(co2 * 1000) / 18.3} digits={1} unit="Trees" label="Equivalent Planted" art="🌲" />
        <Benefit bg="#eef4fb" value={((Number(totalKwh) || 0) * 0.4) / 1000} unit="t" label="Standard Coal Saved" art="⛰" />
      </View>
    </PopIn>
  );
}
function Benefit({ bg, value, digits = 2, unit, label, art }) {
  return (
    <View style={[st.benefit, { backgroundColor: bg }]}>
      <Text><CountUp value={value} digits={digits} style={st.benefitVal} /><Text style={st.small}> {unit}</Text></Text>
      <Text style={st.small}>{label}</Text>
      <Text style={st.benefitArt}>{art}</Text>
    </View>
  );
}

// ---------- green isometric house with rooftop solar, battery and inverter ----------
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

function HouseArt() {
  const dash = useRef(new Animated.Value(0)).current;
  const led = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(dash, { toValue: -14, duration: 1200, easing: Easing.linear, useNativeDriver: false }));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(led, { toValue: 0.35, duration: 800, useNativeDriver: false }),
      Animated.timing(led, { toValue: 1, duration: 800, useNativeDriver: false }),
    ]));
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [dash, led]);
  return (
    <Svg width={140} height={114} viewBox="0 0 160 130">
      <Defs>
        <LinearGradient id="haWall" x1="0" x2="1" y1="0" y2="0"><Stop offset="0" stopColor="#e9f7f1" /><Stop offset="1" stopColor="#ffffff" /></LinearGradient>
        <LinearGradient id="haSide" x1="0" x2="1" y1="0" y2="0"><Stop offset="0" stopColor="#c9eedd" /><Stop offset="1" stopColor="#a8e2c8" /></LinearGradient>
        <LinearGradient id="haPv" x1="0" x2="1" y1="0" y2="1"><Stop offset="0" stopColor="#3c4a5c" /><Stop offset="1" stopColor="#1e2733" /></LinearGradient>
      </Defs>
      <Path d="M8 98 L80 60 L152 98 L80 128 Z" fill="#dff5ea" />
      <Path d="M8 98 L80 128 L80 126 L10 97Z" fill="#bfe8d4" />
      <APath d="M30 99 L60 112 L96 96 L126 88" fill="none" stroke="#1baf7a" strokeWidth={1.4} strokeDasharray="3 4" strokeDashoffset={dash} />
      <Path d="M44 62 L44 98 L84 116 L84 80 Z" fill="url(#haWall)" stroke="#b7e3cd" strokeWidth={0.6} />
      <Path d="M84 80 L84 116 L124 98 L124 62 Z" fill="url(#haSide)" stroke="#9fd9bf" strokeWidth={0.6} />
      <Path d="M40 64 L64 30 L104 48 L84 82 Z" fill="#f3fbf7" stroke="#b7e3cd" strokeWidth={0.6} />
      <Path d="M84 82 L104 48 L128 64 L124 66 Z" fill="#d4f1e3" />
      <G>
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
          <Path key={`${r}${c}`} transform={`translate(${c * 12.4 - r * 6.2} ${c * 5.6 + r * 9.6})`}
            d="M58 37 L69 42 L64 50.5 L53 45.5 Z" fill="url(#haPv)" stroke="#7fd9b7" strokeWidth={0.5} />
        )))}
      </G>
      <Path d="M58 104 L58 92 L66 95.6 L66 107.6 Z" fill="#6bcfa3" />
      <Path d="M98 96 L98 84 L106 80.4 L106 92.4Z" fill="#e8f6ef" stroke="#9fd9bf" strokeWidth={0.6} />
      <Path d="M110 90 L110 76 L117 72.8 L117 86.8Z" fill="#c9eedd" stroke="#9fd9bf" strokeWidth={0.6} />
      <ACircle cx={113.5} cy={78} r={1.3} fill="#1baf7a" opacity={led} />
      <G stroke="#9fd9bf" strokeWidth={1.2} fill="none"><Path d="M20 96 V64 M14 70 H26 M15 76 H25" /></G>
      <Circle cx={140} cy={94} r={5} fill="#a8e2c8" />
      <Circle cx={30} cy={108} r={4} fill="#bfe8d4" />
    </Svg>
  );
}

const st = StyleSheet.create({
  muted: { color: C.muted, fontSize: 13 },
  small: { color: C.muted, fontSize: 12 },
  err: { color: C.bad, textAlign: 'center', marginVertical: 40 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  gen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 22 },
  genNums: { gap: 18, flexShrink: 1 },
  genVal: { fontSize: 28, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  genUnit: { fontSize: 15, color: C.muted },
  genLabel: { color: C.muted, fontSize: 14, marginTop: 2 },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringWrap: { alignItems: 'center', gap: 4 },
  ring: { width: 112, height: 112 },
  ringNum: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringVal: { fontSize: 24, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  legend: { flex: 1, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  sq: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 16, color: C.muted },
  legendVal: { fontSize: 17, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  statusTiles: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statusTile: { flex: 1, backgroundColor: '#f1f8f7', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12, gap: 4 },
  tileVal: { fontSize: 17, fontWeight: '600', color: C.ink, fontVariant: ['tabular-nums'] },
  uTabs: { flexDirection: 'row', marginTop: 8, marginBottom: 10 },
  uTab: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 10 },
  uTabText: { fontSize: 16, color: C.muted },
  uTabOn: { color: C.accentDark, fontWeight: '600' },
  uBar: { position: 'absolute', bottom: 0, height: 3, borderRadius: 2, backgroundColor: C.accent },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 6, marginBottom: 10 },
  dateBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  dateArrow: { fontSize: 22, lineHeight: 24, color: C.ink },
  dateText: { fontSize: 17, fontWeight: '600', minWidth: 110, textAlign: 'center', color: C.ink, fontVariant: ['tabular-nums'] },
  genSum: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  genSumVal: { fontSize: 18, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  skeleton: { height: 200, backgroundColor: C.soft, borderRadius: 12 },
  benefits: { flexDirection: 'row', gap: 8 },
  benefit: { flex: 1, borderRadius: 14, padding: 10, minHeight: 100, gap: 4, overflow: 'hidden' },
  benefitVal: { fontSize: 16, fontWeight: '700', color: C.ink },
  benefitArt: { position: 'absolute', right: 6, bottom: 2, fontSize: 22, opacity: 0.35 },
});
