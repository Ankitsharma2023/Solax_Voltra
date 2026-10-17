import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApi } from '../../lib/api';
import { fmt, modelName, power } from '../../lib/format';
import { useSession } from '../../lib/session';
import { Button, Card, Empty, Page, Segmented, Tiles } from '../../components/ui';
import { LineChart, toPoints } from '../../components/Charts';
import { C } from '../../theme';

// Tapping Solar / Battery / Grid / Home in the energy flow opens its real-time data, as in the SolaX app
// (web src/screens/FlowDetail.jsx): the reading now, the related values, and today's curve. Refreshed every minute while open.
const META = {
  solar: { title: 'Solar', color: C.solar },
  battery: { title: 'Battery', color: C.battery },
  grid: { title: 'Grid', color: C.grid },
  home: { title: 'Home', color: C.home },
};

// Realtime Power = AC output on-grid + EPS (backup) output, as the SolaX app shows it (web Device.jsx).
const inverterPower = (l = {}) => {
  const v = [l.acPower1, l.acPower2, l.acPower3, l.EPSL1ActivePower, l.EPSL2ActivePower, l.EPSL3ActivePower].filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};

export default function FlowDetail() {
  const { kind: k } = useLocalSearchParams();
  const kind = META[k] ? k : 'solar';
  const { plant } = useSession();
  const overview = useApi(`/api/plants/${plant.plantId}/overview`, 60 * 1000);
  const day = useApi(`/api/plants/${plant.plantId}/day`, 5 * 60 * 1000);
  const [series, setSeries] = useState(0);
  const m = META[kind];

  const data = overview.data;
  const inv = data?.inverters?.[0] || {}, bat = data?.batteries?.[0], t = data?.totals || {};
  const solar = inv.MPPTTotalInputPower ?? 0, batteryW = bat?.chargeDischargePower ?? 0, gridW = inv.gridPower ?? 0;
  const homeW = Math.max(0, solar - batteryW - gridW);
  const eps = [1, 2, 3].map((n) => inv[`EPSL${n}ActivePower`]);

  const view = {
    solar: {
      now: solar, status: solar >= 5 ? 'Producing' : 'Not producing',
      tiles: [['Today', t.dailyYield, 'kWh', 2], ['Total', t.totalYield, 'kWh', 1],
        ...Object.keys(inv.mpptMap || {}).filter((x) => /power$/i.test(x)).sort().map((x) => [x.replace(/power$/i, '').toUpperCase(), inv.mpptMap[x], 'W', 0])],
      curves: [['Solar power (W)', (p) => p.solar]],
      device: 'inverter',
    },
    battery: {
      now: Math.abs(batteryW), status: batteryW >= 5 ? 'Charging' : batteryW <= -5 ? 'Discharging' : 'Standby',
      tiles: [['SOC', bat?.batterySOC, '%', 0], ['Remaining', bat?.batteryRemainings, 'kWh', 2], ['Charged today', t.dailyCharged, 'kWh', 2],
        ['Discharged today', t.dailyDischarged, 'kWh', 2], ['Voltage', bat?.batteryVoltage, 'V', 1], ['Temperature', bat?.batteryTemperature, '°C', 0]],
      curves: [['Battery power (W, + charging)', (p) => p.battery], ['SOC (%)', (p) => p.soc]],
      device: 'battery',
    },
    grid: {
      now: Math.abs(gridW), status: gridW >= 5 ? 'Exporting' : gridW <= -5 ? 'Importing' : 'Idle',
      tiles: [['Imported today', t.dailyImported, 'kWh', 2], ['Exported today', t.dailyExported, 'kWh', 2], ['Total imported', t.totalImported, 'kWh', 1],
        ['Total exported', t.totalExported, 'kWh', 1], ...[1, 2, 3].map((n) => [`L${n} voltage`, inv[`acVoltage${n}`], 'V', 1]), ['Frequency', inv.acFrequency1, 'Hz', 2]],
      curves: [['Grid power (W, + export)', (p) => p.grid]],
      device: 'inverter',
    },
    home: {
      now: homeW, status: homeW >= 5 ? 'Consuming' : 'Idle',
      tiles: [['Inverter output', inverterPower(inv), 'W', 0], ...eps.map((v, i) => [`Backup L${i + 1}`, v, 'W', 0]),
        ['Inverter produced today', inv.dailyACOutput, 'kWh', 2], ['Imported today', t.dailyImported, 'kWh', 2]],
      curves: [['Home consumption (W)', (p) => p.consumption]],
      device: 'inverter',
    },
  }[kind];

  const [label, get] = view.curves[Math.min(series, view.curves.length - 1)];
  const pts = useMemo(() => toPoints(day.data?.points, get), [day.data, get]);
  const [n, u] = power(view.now);
  // Device detail route key, as web buildCards: inverter SN, or 'battery'.
  const dev = data?.devices?.[0];
  const device = !data ? null : view.device === 'battery'
    ? (bat ? { key: 'battery', name: 'Battery' } : null)
    : (dev ? { key: dev.deviceSn, name: modelName(dev.deviceModel) } : null);

  return (
    <Page title={m.title} subtitle={plant.plantName} onRefresh={() => Promise.all([overview.reload(), day.reload()])}>
      <Card style={[s.hero, { borderTopColor: m.color }]}>
        <View style={s.statusRow}><View style={[s.liveDot, { backgroundColor: m.color }]} /><Text style={s.status}>{data ? view.status : 'Loading…'}</Text></View>
        <Text style={s.heroVal}>{data ? n : '--'}<Text style={s.heroUnit}> {u}</Text></Text>
        <Text style={s.small}>Updated {inv.plantLocalTime?.slice(11, 16) || '--'} · refreshes every minute</Text>
      </Card>
      {overview.error && !data && <Empty error>{overview.error.message}</Empty>}

      {data && (
        <Card title="Realtime Data">
          <Tiles items={view.tiles.map(([lbl, v, unit, d]) => [lbl, fmt(v, d), unit])} />
        </Card>
      )}

      <Card title="Today">
        {view.curves.length > 1 && (
          <Segmented options={view.curves.map(([l], i) => [i, l.replace(/ \(.*/, '')])} value={series} onChange={setSeries} />
        )}
        {!day.data ? <Empty>{day.error ? day.error.message : 'Loading…'}</Empty> : <LineChart pts={pts} label={label} color={m.color} fill />}
      </Card>

      {device && <Button ghost title={`${device.name} details ›`} onPress={() => router.push(`/device/${encodeURIComponent(device.key)}`)} />}
    </Page>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', borderTopWidth: 3, gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 14, color: C.ink2, fontWeight: '600' },
  heroVal: { fontSize: 40, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  heroUnit: { fontSize: 16, fontWeight: '500', color: C.muted },
  small: { fontSize: 12, color: C.muted },
});
