import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useApi } from '../lib/api';
import { fmt, modelName } from '../lib/format';
import { useSession } from '../lib/session';
import { Card, Empty, Page, Segmented } from '../components/ui';
import { DateNav, MONTHS, shiftDate, today } from '../components/home/StatsPanel';
import { C } from '../theme';

// Reports, as in SolaX (web src/screens/Reports.jsx): Plant report · Device report · Statistical report (all with CSV export).
// The phone shares the CSV (mail, Drive, WhatsApp, …) instead of downloading a file.

function shareCsv(filename, cols, rows, cell) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.map((c) => esc(c[1])).join(','), ...rows.map((r) => cols.map((c) => esc(cell(c, r))).join(','))];
  Share.share({ title: filename, message: lines.join('\n') }).catch(() => {});
}

function Table({ res, cols, rows, cell, empty = 'No data for this period', footer }) {
  const width = (c) => (c[0] === 'plantName' ? 140 : c[0] === 'date' ? 96 : 84);
  const row = ({ r, head, bold, i }, key) => (
    <View key={key} style={[t.row, i % 2 === 1 && { backgroundColor: C.soft }, head && t.head]}>
      {cols.map((c) => (
        <Text key={c[0]} style={[t.cell, { width: width(c) }, (head || bold) && t.bold]} numberOfLines={head ? 2 : 1}>
          {head ? c[1] : String(cell(c, r))}
        </Text>
      ))}
    </View>
  );
  return (
    <Card style={{ paddingHorizontal: 0, paddingVertical: 8 }}>
      {res.error ? <Empty error>{res.error.message}</Empty>
        : !res.data ? <Empty>Loading…</Empty>
        : !rows.length ? <Empty>{empty}</Empty>
        : (
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 10 }}>
            <View>
              {row({ head: true }, 'head')}
              {rows.map((r, i) => row({ r, i }, i))}
              {footer && row({ r: footer, bold: true }, 'foot')}
            </View>
          </ScrollView>
        )}
    </Card>
  );
}

// Date arrows for the report period (web: a date / month / year input).
function PeriodPicker({ type, date, setDate }) {
  const label = type === 'daily' ? date : type === 'monthly' ? `${MONTHS[+date.slice(5, 7) - 1]} ${date.slice(0, 4)}` : date.slice(0, 4);
  const next = shiftDate(date, type, 1);
  return <DateNav label={label} onPrev={() => setDate(shiftDate(date, type, -1))} onNext={() => setDate(next)} canNext={next !== date}
    date={date} onPick={type === 'daily' ? setDate : undefined} />;
}

function Foot({ note, disabled, onExport }) {
  return (
    <View style={t.foot}>
      <Text style={t.note}>{note}</Text>
      <Pressable onPress={onExport} disabled={disabled} hitSlop={8}>
        <Text style={[t.export, disabled && { opacity: 0.4 }]}>Export CSV</Text>
      </Pressable>
    </View>
  );
}

export default function Reports() {
  const { plant } = useSession();
  const { initial } = useLocalSearchParams(); // Me → Statistical Report opens on that report
  const [kind, setKind] = useState(initial || (plant ? 'plant' : 'statistical'));
  const kinds = plant ? [['plant', 'Plant'], ['device', 'Device'], ['statistical', 'Statistical']] : [['statistical', 'Statistical']];
  return (
    <Page title="Reports" subtitle={plant?.plantName ?? 'All your plants'}>
      {kinds.length > 1 && <Segmented options={kinds} value={kind} onChange={setKind} />}
      {kind === 'plant' && <PlantReport plant={plant} />}
      {kind === 'device' && <DeviceReport plant={plant} />}
      {kind === 'statistical' && <StatisticalReport />}
    </Page>
  );
}

// ---------- Plant report ----------

const DAILY_COLS = [
  ['time', 'Time', (v) => v.slice(11, 16)], ['solar', 'Solar (W)'], ['battery', 'Battery (W)'],
  ['grid', 'Grid (W)'], ['consumption', 'Home (W)'], ['soc', 'SOC (%)'],
];
const ENERGY_COLS = [
  ['date', 'Date'], ['pvGeneration', 'Solar'], ['loadConsumption', 'Consumed'], ['importEnergy', 'Imported'],
  ['exportEnergy', 'Exported'], ['batteryCharged', 'Charged'], ['batteryDischarged', 'Discharged'],
];

function PlantReport({ plant }) {
  const [type, setType] = useState('daily');
  const [date, setDate] = useState(today());
  const id = plant.plantId;
  const res = useApi(type === 'daily' ? `/api/plants/${id}/day?date=${date}`
    : `/api/plants/${id}/stats?dateType=${type === 'monthly' ? 2 : 1}&date=${type === 'monthly' ? date.slice(0, 7) : date.slice(0, 4)}`);
  const cols = type === 'daily' ? DAILY_COLS : ENERGY_COLS;
  const rows = type === 'daily' ? res.data?.points ?? [] : (res.data?.plantEnergyStatDataList ?? []).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.abs(v) : v])));
  const cell = ([key, , f], r) => (f ? f(r[key]) : typeof r[key] === 'number' ? (type === 'daily' ? Math.round(r[key]) : fmt(r[key])) : r[key] ?? '--');
  const period = type === 'daily' ? date : type === 'monthly' ? date.slice(0, 7) : date.slice(0, 4);
  return (
    <>
      <Segmented options={[['daily', 'Daily'], ['monthly', 'Monthly'], ['yearly', 'Yearly']]} value={type} onChange={setType} />
      <PeriodPicker type={type} date={date} setDate={setDate} />
      <Table res={res} cols={cols} rows={rows} cell={cell} />
      <Foot note={type !== 'daily' ? 'Energy values in kWh.' : ''} disabled={!rows.length}
        onExport={() => shareCsv(`${plant.plantName}-plant-${period}.csv`, cols, rows, cell)} />
    </>
  );
}

// ---------- Device report ----------

const INVERTER_COLS = [
  ['plantLocalTime', 'Time', (v) => String(v).slice(11, 16)], ['MPPTTotalInputPower', 'PV (W)'],
  ['acPower1', 'AC L1 (W)'], ['acPower2', 'AC L2 (W)'], ['acPower3', 'AC L3 (W)'], ['gridPower', 'Grid (W)'],
  ['acVoltage1', 'V L1'], ['acVoltage2', 'V L2'], ['acVoltage3', 'V L3'], ['acFrequency1', 'Hz'],
  ['inverterTemperature', 'Temp (°C)'], ['dailyYield', 'Yield today (kWh)'],
];
const BATTERY_COLS = [
  ['plantLocalTime', 'Time', (v) => String(v).slice(11, 16)], ['batterySOC', 'SOC (%)'], ['chargeDischargePower', 'Power (W)'],
  ['batteryVoltage', 'Voltage (V)'], ['batteryCurrent', 'Current (A)'], ['batteryTemperature', 'Temp (°C)'], ['batteryRemainings', 'Remaining (kWh)'],
];

function DeviceReport({ plant }) {
  const ov = useApi(`/api/plants/${plant.plantId}/overview`);
  const inverters = ov.data?.devices ?? [];
  const options = [...inverters.map((d) => ({ key: `1:${d.deviceSn}`, sn: d.deviceSn, type: 1, label: `${modelName(d.deviceModel)} · ${d.deviceSn}` })),
    ...(ov.data?.batteries?.length && inverters[0] ? [{ key: `2:${inverters[0].deviceSn}`, sn: inverters[0].deviceSn, type: 2, label: 'Battery' }] : [])];
  const [pick, setPick] = useState(null);
  const [date, setDate] = useState(today());
  const dev = options.find((o) => o.key === pick) ?? options[0];
  const res = useApi(dev ? `/api/plants/${plant.plantId}/devices/${dev.sn}/history?type=${dev.type}&date=${date}` : null);
  const cols = dev?.type === 2 ? BATTERY_COLS : INVERTER_COLS;
  const rows = res.data?.rows ?? [];
  const cell = ([key, , f], r) => (f ? f(r[key]) : r[key] == null ? '--' : typeof r[key] === 'number' ? (Number.isInteger(r[key]) ? r[key] : fmt(r[key], 1)) : r[key]);
  return (
    <>
      <Text style={t.label}>Device</Text>
      <View style={t.options}>
        {!options.length && <Text style={t.note}>{ov.error ? ov.error.message : 'Loading…'}</Text>}
        {options.map((o) => (
          <Pressable key={o.key} onPress={() => setPick(o.key)} style={[t.option, dev?.key === o.key && t.optionOn]}>
            <Text style={[t.optionText, dev?.key === o.key && { color: C.accentDark, fontWeight: '600' }]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      <PeriodPicker type="daily" date={date} setDate={setDate} />
      <Table res={dev ? res : { data: null, error: ov.error }} cols={cols} rows={rows} cell={cell} empty="No readings for this day" />
      <Foot note="Readings every 5 minutes (plant local time)." disabled={!rows.length}
        onExport={() => shareCsv(`${plant.plantName}-${dev?.type === 2 ? 'battery' : dev?.sn}-${date}.csv`, cols, rows, cell)} />
    </>
  );
}

// ---------- Statistical report (all plants the user can see) ----------

const STAT_COLS = [
  ['plantName', 'Plant'], ['pvCapacity', 'kWp'], ['pvGeneration', 'Solar'], ['yieldPerKwp', 'kWh/kWp'], ['loadConsumption', 'Consumed'],
  ['importEnergy', 'Imported'], ['exportEnergy', 'Exported'], ['batteryCharged', 'Charged'], ['batteryDischarged', 'Discharged'],
];

function StatisticalReport() {
  const [type, setType] = useState('monthly');
  const [date, setDate] = useState(today());
  const period = type === 'monthly' ? date.slice(0, 7) : date.slice(0, 4);
  const res = useApi(`/api/reports/statistics?dateType=${type === 'monthly' ? 2 : 1}&date=${period}`);
  const rows = res.data?.rows ?? [];
  const keys = ['pvCapacity', 'pvGeneration', 'loadConsumption', 'importEnergy', 'exportEnergy', 'batteryCharged', 'batteryDischarged'];
  const total = rows.length > 1 ? Object.fromEntries([['plantName', `Total (${rows.length} plants)`], ...keys.map((k) => [k, rows.reduce((a, r) => a + (r[k] || 0), 0)])]) : null;
  if (total) total.yieldPerKwp = total.pvCapacity ? total.pvGeneration / total.pvCapacity : null;
  const cell = ([key], r) => (typeof r[key] === 'number' ? fmt(r[key], key === 'pvCapacity' ? 1 : 2) : r[key] ?? '--');
  return (
    <>
      <Segmented options={[['monthly', 'Monthly'], ['yearly', 'Yearly']]} value={type} onChange={setType} />
      <PeriodPicker type={type} date={date} setDate={setDate} />
      <Table res={res} cols={STAT_COLS} rows={rows} cell={cell} footer={total} empty="No plants" />
      <Foot note="Energy in kWh. kWh/kWp = solar produced per kW of panels (compares plants of different sizes)." disabled={!rows.length}
        onExport={() => shareCsv(`voltra-statistics-${period}.csv`, STAT_COLS, total ? [...rows, total] : rows, cell)} />
    </>
  );
}

const t = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 7 },
  head: { borderBottomWidth: 1, borderBottomColor: C.line },
  cell: { fontSize: 13, color: C.ink, paddingHorizontal: 6, fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '700' },
  foot: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 2 },
  note: { flex: 1, fontSize: 12, color: C.muted },
  export: { color: C.accentDark, fontWeight: '600', fontSize: 15 },
  label: { fontSize: 13, color: C.muted, marginBottom: 6 },
  options: { gap: 6, marginBottom: 12 },
  option: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#fff' },
  optionOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  optionText: { fontSize: 14, color: C.ink },
});
