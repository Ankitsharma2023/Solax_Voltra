import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, useApi } from '../../lib/api';
import { fmt } from '../../lib/format';
import { Card, Empty, Segmented } from '../ui';
import { BarChart } from '../Charts';
import { BackIcon, ChevronIcon } from '../Icons';
import EnergyGraph, { Chips } from './EnergyGraph';
import { C } from '../../theme';
import { DatePicker } from '../Pickers';

// Day / Month / Year / All switcher with date arrows (web StatsPanel in src/screens/Stats.jsx).
// Same hues as the Energy Graph so a series keeps its colour across screens.
const BAR_SERIES = [
  { key: 'pvGeneration', label: 'Solar', color: '#eda100', on: true },
  { key: 'loadConsumption', label: 'Consumption', color: '#6250d6', on: true },
  { key: 'exportEnergy', label: 'Exported', color: '#008300', on: false },
  { key: 'importEnergy', label: 'Imported', color: '#2a78d6', on: false },
  { key: 'batteryCharged', label: 'Charged', color: '#1baf7a', on: false },
  { key: 'batteryDischarged', label: 'Discharged', color: '#eb6834', on: false },
];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const today = () => new Date().toISOString().slice(0, 10);

// Move a YYYY-MM-DD date by one day / month / year, never past today.
export function shiftDate(date, period, dir) {
  const d = new Date(date + 'T00:00:00Z');
  if (period === 'day' || period === 'daily') d.setUTCDate(d.getUTCDate() + dir);
  if (period === 'month' || period === 'monthly') d.setUTCMonth(d.getUTCMonth() + dir);
  if (period === 'year' || period === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + dir);
  const next = d.toISOString().slice(0, 10);
  return next <= today() ? next : date;
}

// ‹ label › (web .date-nav).
// `date` + `onPick` (day views): tapping the date opens a calendar.
export function DateNav({ label, onPrev, onNext, canNext, date, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.dateNav}>
      <Pressable onPress={onPrev} hitSlop={10} accessibilityLabel="Previous" style={s.navBtn}><BackIcon size={22} color={C.ink} /></Pressable>
      <Pressable onPress={() => onPick && setOpen(true)} disabled={!onPick} hitSlop={6}>
        <Text style={[s.dateLabel, onPick && { textDecorationLine: 'underline', textDecorationStyle: 'dotted' }]}>{label}</Text>
      </Pressable>
      {onPick && <DatePicker visible={open} value={date} onPick={onPick} onClose={() => setOpen(false)} />}
      <Pressable onPress={onNext} disabled={!canNext} hitSlop={10} accessibilityLabel="Next" style={[s.navBtn, !canNext && { opacity: 0.3 }]}><ChevronIcon size={22} color={C.ink} /></Pressable>
    </View>
  );
}

export default function StatsPanel({ plant }) {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(today());
  const label = period === 'day' ? date : period === 'month' ? `${MONTHS[+date.slice(5, 7) - 1]} ${date.slice(0, 4)}`
    : period === 'year' ? date.slice(0, 4) : 'Lifetime';
  const next = shiftDate(date, period, 1);

  return (
    <>
      <Segmented options={[['day', 'Day'], ['month', 'Month'], ['year', 'Year'], ['total', 'All']]} value={period}
        onChange={(p) => { setPeriod(p); setDate(today()); }} />
      {period !== 'total' && (
        <DateNav label={label} onPrev={() => setDate(shiftDate(date, period, -1))} onNext={() => setDate(next)} canNext={next !== date}
          date={date} onPick={period === 'day' ? setDate : undefined} />
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
      <Card title="Power">
        {day.loading && !day.data ? <Empty>Loading…</Empty> : day.error && !day.data ? <Empty error>{day.error.message}</Empty> : <EnergyGraph points={day.data?.points} />}
      </Card>
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
        const sum = (k) => (r.plantEnergyStatDataList ?? []).reduce((a, d) => a + Math.abs(d[k] || 0), 0);
        return Object.fromEntries([['label', String(y)], ...BAR_SERIES.map((x) => [x.key, sum(x.key)])]);
      }));
    })().then((r) => alive && setRows(r)).catch((e) => alive && setError(e));
    return () => { alive = false; };
  }, [plant, period, date]);

  const totals = rows && Object.fromEntries(BAR_SERIES.map((x) => [x.key, rows.reduce((a, r) => a + Math.abs(r[x.key] || 0), 0)]));
  const series = BAR_SERIES.filter((x) => on.has(x.key));
  const toggle = (k) => setOn((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <>
      <Summary row={totals} />
      <Card title="Energy">
        <Text style={s.unit}>kWh</Text>
        {error ? <Empty error>{error.message}</Empty> : !rows ? <Empty>Loading…</Empty> : <BarChart rows={rows} series={series} />}
        <Chips items={BAR_SERIES} on={on} onToggle={toggle} />
      </Card>
    </>
  );
}

function Summary({ row }) {
  const v = (k) => (row ? Math.abs(row[k] || 0) : null);
  return (
    <View style={s.summary}>
      {[['pvGeneration', 'Solar'], ['loadConsumption', 'Consumed'], ['importEnergy', 'Imported'],
        ['exportEnergy', 'Exported'], ['batteryCharged', 'Charged'], ['batteryDischarged', 'Discharged']].map(([k, l]) => (
        <View key={k} style={s.sumCell}>
          <Text style={s.sumVal}>{fmt(v(k))}</Text>
          <Text style={s.sumLabel} numberOfLines={1}>{l} (kWh)</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  navBtn: { padding: 6 },
  dateLabel: { fontSize: 16, fontWeight: '600', color: C.ink },
  unit: { fontSize: 11, color: C.muted, marginBottom: 2 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.soft, borderRadius: 16, paddingVertical: 8, marginBottom: 12 },
  sumCell: { width: '33.33%', alignItems: 'center', paddingVertical: 8, gap: 2 },
  sumVal: { fontSize: 17, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  sumLabel: { fontSize: 11, color: C.muted },
});
