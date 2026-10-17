import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { api, useApi } from '../../lib/api';
import { fmt } from '../../lib/format';
import { BarChart } from '../Charts';
import { BackIcon, ChevronIcon } from '../Icons';
import { Empty, Segmented, s as ui } from '../ui';
import { C } from '../../theme';

// Statistics panel for the inverter page — port of the web StatsPanel (src/screens/Stats.jsx):
// Day / Month / Year / All with date arrows, the energy summary, a power curve (day) or bars.

// Same hues as the Energy Graph so a series keeps its colour across screens.
const BAR_SERIES = [
  { key: 'pvGeneration', label: 'Solar', color: '#eda100', on: true },
  { key: 'loadConsumption', label: 'Consumption', color: '#6250d6', on: true },
  { key: 'exportEnergy', label: 'Exported', color: '#008300', on: false },
  { key: 'importEnergy', label: 'Imported', color: '#2a78d6', on: false },
  { key: 'batteryCharged', label: 'Charged', color: '#1baf7a', on: false },
  { key: 'batteryDischarged', label: 'Discharged', color: '#eb6834', on: false },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const today = () => new Date().toISOString().slice(0, 10);

export default function StatsPanel({ plant }) {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(today());

  const shift = (dir) => {
    const d = new Date(date + 'T00:00:00Z');
    if (period === 'day') d.setUTCDate(d.getUTCDate() + dir);
    if (period === 'month') d.setUTCMonth(d.getUTCMonth() + dir);
    if (period === 'year') d.setUTCFullYear(d.getUTCFullYear() + dir);
    const next = d.toISOString().slice(0, 10);
    if (next <= today()) setDate(next);
  };
  const label = period === 'day' ? date : period === 'month' ? `${MONTHS[+date.slice(5, 7) - 1]} ${date.slice(0, 4)}`
    : period === 'year' ? date.slice(0, 4) : 'Lifetime';

  return (
    <>
      <Segmented options={[['day', 'Day'], ['month', 'Month'], ['year', 'Year'], ['total', 'All']]} value={period}
        onChange={(p) => { setPeriod(p); setDate(today()); }} />
      {period !== 'total' && (
        <View style={st.dateNav}>
          <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel="Previous"><BackIcon size={22} /></Pressable>
          <Text style={st.dateText}>{label}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel="Next" disabled={date >= today()} style={date >= today() && { opacity: 0.3 }}><ChevronIcon size={22} /></Pressable>
        </View>
      )}
      {period === 'day' ? <DayView plant={plant} date={date} /> : <BarsView plant={plant} period={period} date={date} />}
    </>
  );
}

function DayView({ plant, date }) {
  const day = useApi(`/api/plants/${plant.plantId}/day?date=${date}`);
  const month = useApi(`/api/plants/${plant.plantId}/stats?dateType=2&date=${date.slice(0, 7)}`);
  const row = month.data?.plantEnergyStatDataList?.find((d) => d.date === date);
  return (
    <>
      <Summary row={row} />
      <Text style={[ui.cardTitle, st.title]}>Power</Text>
      {day.error && !day.data ? <Empty error>{day.error.message}</Empty>
        : day.loading && !day.data ? <Empty>Loading…</Empty> : <PowerGraph points={day.data?.points ?? []} />}
    </>
  );
}

function BarsView({ plant, period, date }) {
  const [on, setOn] = useState(() => new Set(BAR_SERIES.filter((x) => x.on).map((x) => x.key)));
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setRows(null); setError(null);
    (async () => {
      const id = plant.plantId;
      if (period === 'month' || period === 'year') {
        const r = await api(`/api/plants/${id}/stats?dateType=${period === 'month' ? 2 : 1}&date=${period === 'month' ? date.slice(0, 7) : date.slice(0, 4)}`);
        const byDate = new Map((r.plantEnergyStatDataList ?? []).map((d) => [d.date, d]));
        // Every day of the month / every month of the year, zero where SolaX has no data.
        const keys = period === 'month'
          ? Array.from({ length: new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7), 0)).getUTCDate() }, (_, i) => `${date.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`)
          : Array.from({ length: 12 }, (_, i) => `${date.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`);
        return keys.map((k) => ({
          ...(byDate.get(k) || {}), date: k, label: k, short: period === 'month' ? String(+k.slice(8)) : MONTHS[+k.slice(5, 7) - 1],
        }));
      }
      // Total: one bar per year since the plant was created.
      const first = +(plant.createTime || today()).slice(0, 4), last = new Date().getFullYear();
      return Promise.all(Array.from({ length: last - first + 1 }, (_, i) => first + i).map(async (y) => {
        const r = await api(`/api/plants/${id}/stats?dateType=1&date=${y}`);
        const total = (k) => (r.plantEnergyStatDataList ?? []).reduce((a, d) => a + Math.abs(d[k] || 0), 0);
        return Object.fromEntries([['label', String(y)], ...BAR_SERIES.map((x) => [x.key, total(x.key)])]);
      }));
    })().then((r) => alive && setRows(r)).catch((e) => alive && setError(e));
    return () => { alive = false; };
  }, [plant, period, date]);

  const totals = rows && Object.fromEntries(BAR_SERIES.map((x) => [x.key, rows.reduce((a, r) => a + Math.abs(r[x.key] || 0), 0)]));
  const series = BAR_SERIES.filter((x) => on.has(x.key));
  const toggle = (k) => setOn((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <>
      <Summary row={totals} />
      <Text style={[ui.cardTitle, st.title]}>Energy</Text>
      <Text style={ui.small}>kWh</Text>
      {error ? <Empty error>{error.message}</Empty> : !rows ? <Empty>Loading…</Empty> : <BarChart rows={rows} series={series} />}
      <Chips items={BAR_SERIES} on={on} toggle={toggle} />
    </>
  );
}

function Summary({ row }) {
  const v = (k) => (row ? Math.abs(row[k] || 0) : null);
  return (
    <View style={st.summary}>
      {[['pvGeneration', 'Solar'], ['loadConsumption', 'Consumed'], ['importEnergy', 'Imported'],
        ['exportEnergy', 'Exported'], ['batteryCharged', 'Charged'], ['batteryDischarged', 'Discharged']].map(([k, l]) => (
        <View key={k} style={st.sumCell}><Text style={st.sumVal}>{fmt(v(k))}</Text><Text style={ui.small}>{l} (kWh)</Text></View>
      ))}
    </View>
  );
}

function Chips({ items, on, toggle }) {
  return (
    <View style={st.chips}>
      {items.map((x) => (
        <Pressable key={x.key} onPress={() => toggle(x.key)} style={[st.chip, on.has(x.key) && st.chipOn]} accessibilityState={{ selected: on.has(x.key) }}>
          <View style={[st.dot, { backgroundColor: on.has(x.key) ? x.color : '#c9ced4' }]} />
          <Text style={st.chipText}>{x.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Day power curve with toggleable series — the web EnergyGraph (src/components/EnergyGraph.jsx).
const SERIES = [
  { key: 'solar', label: 'Solar', color: '#eda100', on: true },
  { key: 'inverter', label: 'Inverter', color: '#2a78d6', on: false },
  { key: 'eps', label: 'EPS Power', color: '#eb6834', on: false },
  { key: 'battery', label: 'Battery Charging', color: '#1baf7a', on: true },
  { key: 'consumption', label: 'Consumption', color: '#6250d6', on: true },
  { key: 'grid', label: 'Export', color: '#008300', on: true },
];
const SOC = { key: 'soc', label: 'Battery SOC', color: '#5b6573' };
const W = 340, H = 220, PAD = { l: 44, r: 10, t: 12, b: 26 }, SOC_H = 64;
const minutes = (t) => { const [h, m] = t.slice(11, 16).split(':').map(Number); return h * 60 + m; };
const xOf = (min) => PAD.l + (min / 1440) * (W - PAD.l - PAD.r);
const fmtW = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} kW` : `${Math.round(v)} W`);
function niceStep(range) {
  const raw = range / 4, mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) || raw;
}

function PowerGraph({ points }) {
  const [on, setOn] = useState(() => new Set(SERIES.filter((x) => x.on).map((x) => x.key)));
  const [hover, setHover] = useState(null);
  const [w, setW] = useState(0);
  const visible = SERIES.filter((x) => on.has(x.key));
  const showSoc = on.has('soc');

  const vals = points.flatMap((p) => visible.map((x) => p[x.key]).filter((v) => v != null));
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  if (hi - lo < 100) hi = lo + 1000;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const yOf = (v) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const socY = (v) => 6 + ((100 - v) / 100) * (SOC_H - 20);
  const line = (key, y = yOf) => points.filter((p) => p[key] != null)
    .map((p, i) => `${i ? 'L' : 'M'}${xOf(minutes(p.time)).toFixed(1)},${y(p[key]).toFixed(1)}`).join('');

  const pick = (px) => {
    if (!points.length || !w) return;
    const min = ((((px / w) * W) - PAD.l) / (W - PAD.l - PAD.r)) * 1440;
    setHover(points.reduce((a, p) => (Math.abs(minutes(p.time) - min) < Math.abs(minutes(a.time) - min) ? p : a), points[0]));
  };
  const toggle = (k) => setOn((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <View>
      <Text style={ui.small}>W</Text>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Pressable onPressIn={(e) => pick(e.nativeEvent.locationX)}>
          <Svg width="100%" height={w ? (w * H) / W : H} viewBox={`0 0 ${W} ${H}`}>
            {ticks.map((t) => (
              <G key={t}>
                <Line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? '#c9ced4' : C.line} strokeWidth={1} />
                <SvgText x={PAD.l - 6} y={yOf(t) + 3} textAnchor="end" fontSize={9} fill={C.muted}>{t.toLocaleString()}</SvgText>
              </G>
            ))}
            {[0, 240, 480, 720, 960, 1200].map((m) => <SvgText key={m} x={xOf(m)} y={H - 6} textAnchor="middle" fontSize={9} fill={C.muted}>{String(m / 60).padStart(2, '0')}:00</SvgText>)}
            {visible.map((x) => <Path key={x.key} d={line(x.key)} fill="none" stroke={x.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
            {hover && (
              <G>
                <Line x1={xOf(minutes(hover.time))} x2={xOf(minutes(hover.time))} y1={PAD.t} y2={H - PAD.b} stroke={C.muted} strokeDasharray="3 3" />
                {visible.map((x) => hover[x.key] != null && <Circle key={x.key} cx={xOf(minutes(hover.time))} cy={yOf(hover[x.key])} r={4} fill={x.color} stroke="#fff" strokeWidth={2} />)}
              </G>
            )}
          </Svg>
          {showSoc && (
            <Svg width="100%" height={w ? (w * SOC_H) / W : SOC_H} viewBox={`0 0 ${W} ${SOC_H}`}>
              <SvgText x={PAD.l - 6} y={socY(100) + 3} textAnchor="end" fontSize={9} fill={C.muted}>100%</SvgText>
              <SvgText x={PAD.l - 6} y={socY(0) + 3} textAnchor="end" fontSize={9} fill={C.muted}>0%</SvgText>
              <Line x1={PAD.l} x2={W - PAD.r} y1={socY(0)} y2={socY(0)} stroke={C.line} />
              <Line x1={PAD.l} x2={W - PAD.r} y1={socY(100)} y2={socY(100)} stroke={C.line} />
              <Path d={line('soc', socY)} fill="none" stroke={SOC.color} strokeWidth={2} />
              {hover?.soc != null && <Circle cx={xOf(minutes(hover.time))} cy={socY(hover.soc)} r={4} fill={SOC.color} stroke="#fff" strokeWidth={2} />}
            </Svg>
          )}
        </Pressable>
      </View>
      {!points.length && <Text style={st.graphEmpty}>No data for today yet</Text>}
      {hover && (
        <View style={st.tip}>
          <Text style={st.tipTime}>{hover.time.slice(11, 16)}</Text>
          {[...visible, ...(showSoc ? [SOC] : [])].map((x) => hover[x.key] != null && (
            <Text key={x.key} style={ui.muted}><Text style={{ color: x.color }}>● </Text>{x.label}: <Text style={st.tipVal}>{x.key === 'soc' ? `${hover.soc}%` : fmtW(hover[x.key])}</Text></Text>
          ))}
        </View>
      )}
      <Chips items={[...SERIES.slice(0, 3), SOC, ...SERIES.slice(3)]} on={on} toggle={toggle} />
      <Text style={[ui.small, { marginTop: 8 }]}>Battery: + charging / − discharging · Export: + to grid / − from grid</Text>
    </View>
  );
}

const st = StyleSheet.create({
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 },
  dateText: { fontSize: 15, fontWeight: '600', color: C.ink },
  title: { marginTop: 8, marginBottom: 4 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.soft, borderRadius: 14, paddingVertical: 6, marginBottom: 8 },
  sumCell: { width: '33.33%', alignItems: 'center', paddingVertical: 8, gap: 2 },
  sumVal: { fontSize: 16, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
  chipOn: { backgroundColor: C.soft },
  chipText: { fontSize: 12, color: C.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tip: { backgroundColor: C.soft, borderRadius: 10, padding: 10, marginTop: 6, gap: 2 },
  tipTime: { fontWeight: '600', color: C.ink, fontSize: 13 },
  tipVal: { fontWeight: '700', color: C.ink },
  graphEmpty: { textAlign: 'center', color: C.muted, fontSize: 13, marginTop: -120, marginBottom: 100 },
});
