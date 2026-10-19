import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApi } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../lib/session';
import { usePlantSetting } from '../../lib/settings';
import { earnings } from '../../lib/tariff';
import { Screen } from '../../components/ui';
import EnergyFlow from '../../components/EnergyFlow';
import SocGauge from '../../components/SocGauge';
import CountUp from '../../components/CountUp';
import Header, { Sheet } from '../../components/home/Header';
import EnergyGraph from '../../components/home/EnergyGraph';
import PriceTrend from '../../components/home/PriceTrend';
import { BoltIcon, ChartIcon, HouseBoltIcon, InfoIcon, InverterIcon, PylonIcon } from '../../components/Icons';
import { C, card } from '../../theme';

const FIVE_MIN = 5 * 60 * 1000;
const CO2_KG_PER_KWH = 0.997, COAL_KG_PER_KWH = 0.4, CO2_KG_PER_TREE = 18.3;

// Home tab: same data and layout as the web app's Home (src/screens/Home.jsx).
export default function Home() {
  const { plant } = useSession();
  const id = plant.plantId;
  const overview = useApi(`/api/plants/${id}/overview`, FIVE_MIN);
  const day = useApi(`/api/plants/${id}/day`, FIVE_MIN);
  const weather = useApi(`/api/plants/${id}/weather`);
  const alarms = useApi(`/api/plants/${id}/alarms`, FIVE_MIN);
  const month = new Date().toISOString().slice(0, 7);
  const stats = useApi(`/api/plants/${id}/stats?dateType=2&date=${month}`);
  const [tariff] = usePlantSetting(id, 'tariff', null);
  const [menu, setMenu] = useState(false);

  const refresh = () => Promise.all([overview.reload(), day.reload(), alarms.reload(), weather.reload(), stats.reload()]);

  const data = overview.data;
  const inv = data?.inverters?.[0] || {};
  const bat = data?.batteries?.[0];
  const totals = data?.totals || {};
  // Sign conventions (SolaX): battery + = charging; grid + = exporting.
  const solar = inv.MPPTTotalInputPower ?? 0;
  const batteryW = bat?.chargeDischargePower ?? 0;
  const gridW = inv.gridPower ?? 0;
  const homeW = Math.max(0, solar - batteryW - gridW);
  const online = data?.devices?.some((d) => d.onlineStatus === 1);
  const status = !data ? null : !online ? 'Offline' : alarms.data?.length ? 'Alarm' : 'Normal';
  const batState = batteryW >= 5 ? 'Battery Charging' : batteryW <= -5 ? 'Battery Discharging' : 'Battery Standby';
  const inverterProduced = inv.dailyACOutput ?? 0;
  const homeConsumed = Math.max(0, inverterProduced + (totals.dailyImported ?? 0) - (totals.dailyExported ?? 0));
  const co2T = ((totals.totalYield ?? 0) * CO2_KG_PER_KWH) / 1000;

  // Earnings come from the tariff saved for this plant (SolaX has none set).
  const days = stats.data?.plantEnergyStatDataList ?? [];
  const yKey = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const yRow = days.find((d) => d.date === yKey);
  const earnToday = earnings(tariff, { consumed: homeConsumed, imported: totals.dailyImported, exported: totals.dailyExported });
  const earnYesterday = yRow && earnings(tariff, { consumed: Math.abs(yRow.loadConsumption), imported: yRow.importEnergy, exported: yRow.exportEnergy });
  const earnTotal = earnings(tariff, { consumed: Math.max(0, (totals.totalYield ?? 0) + (totals.totalImported ?? 0) - (totals.totalExported ?? 0)), imported: totals.totalImported, exported: totals.totalExported });
  const money = (v, style) => (tariff && v != null
    ? <Text style={style}>{tariff.currency}<CountUp value={v} style={style} /></Text>
    : <Text style={style}>- -</Text>);
  const openTariff = () => router.push('/tariff');

  const menuItems = [
    { label: 'Edit Plant', onPress: () => router.push('/plant-edit') },
    { label: 'Statistics', onPress: () => router.push('/stats') },
    { label: 'Reports', onPress: () => router.push('/reports') },
    { label: 'Messages', onPress: () => router.push('/messages') },
    { label: 'Alarms', onPress: () => router.push('/alarms') },
    { label: 'Tariff Setting', onPress: openTariff },
    { label: 'Refresh now', onPress: () => { overview.reload(); day.reload(); alarms.reload(); } },
  ];

  return (
    <Screen onRefresh={refresh}>
      <Header plant={plant} status={status} onMore={() => setMenu(true)}
        sub={weather.data?.min != null && <Text style={s.temp}>{fmt(weather.data.min, 1)}~{fmt(weather.data.max, 1)}<Text style={s.tempUnit}>°C</Text></Text>} />

      {overview.error && !data ? <Text style={s.err}>{overview.error.message}</Text> : !data ? <HomeSkeleton /> : (
        <>
          {!online && (
            <View style={s.offline}>
              <Text style={s.offlineTitle}>System offline{inv.plantLocalTime ? ` since ${since(inv.plantLocalTime)}` : ''}</Text>
              <Text style={s.offlineText}>The WiFi dongle isn't sending data, so these are the last values received. Check the dongle's power and the home WiFi.</Text>
            </View>
          )}
          <EnergyFlow solar={solar} home={homeW} battery={batteryW} grid={gridW} soc={bat?.batterySOC} hasBattery={!!bat}
            onOpen={(kind) => router.push(`/flow/${kind}`)} />
          <Text style={s.updated}>Updated {inv.plantLocalTime?.slice(11, 16) || '--'} · refreshes every 5 min</Text>

          <View style={s.sectionHead}>
            <Text style={s.h2}>Daily Energy</Text>
            <Pressable onPress={() => router.push('/stats')} hitSlop={10} accessibilityLabel="Statistics"><ChartIcon color={C.muted} /></Pressable>
          </View>
          {bat && (
            <View style={card}>
              <View style={s.batTop}>
                <View style={{ flex: 1 }}>
                  <BoltIcon size={20} color={batState === 'Battery Standby' ? C.muted : C.battery} />
                  <Text style={s.h3}>{batState}</Text>
                  <Text style={s.muted}>Remaining Energy: {fmt(bat.batteryRemainings)}kWh</Text>
                </View>
                <SocGauge value={bat.batterySOC} />
              </View>
              <View style={s.split}>
                <Stat label="Charged" value={<><CountUp value={totals.dailyCharged} style={s.statVal} /><Text style={s.small}> kWh</Text></>} />
                <Stat label="Discharged" value={<><CountUp value={totals.dailyDischarged} style={s.statVal} /><Text style={s.small}> kWh</Text></>} />
              </View>
            </View>
          )}

          <View style={s.tiles}>
            <Tile icon={<InverterIcon color={C.grid} />} bg="#eaf2fc" value={inverterProduced} label="Inverter Produced" />
            <Tile icon={<PylonIcon color={C.muted} />} bg={C.soft} value={totals.dailyImported} label="Grid Imported" />
            <Tile icon={<HouseBoltIcon color={C.accentDark} />} bg={C.accentSoft} value={homeConsumed} label="Home Consumed" />
            <Tile icon={<PylonIcon color={C.muted} />} bg={C.soft} value={totals.dailyExported} label="Grid Exported" />
          </View>

          <View style={card}>
            <Text style={[s.h3, { marginBottom: 12 }]}>Energy Graph</Text>
            {day.error && !day.data ? <Text style={s.err}>{day.error.message}</Text> : <EnergyGraph points={day.data?.points} />}
          </View>

          <View style={s.sectionHead}><Text style={s.h2}>Energy Value</Text></View>
          <View style={card}>
            <View style={s.titleRow}><Text style={s.h3}>Earnings Today</Text><InfoIcon size={18} color={C.muted} /></View>
            <View style={{ marginVertical: 10 }}>{money(earnToday, s.bigMoney)}</View>
            <View style={s.split}>
              <Stat label="Earnings Yesterday" value={money(earnYesterday, s.statVal)} />
              <Stat label="Total Earnings" value={money(earnTotal, s.statVal)} />
            </View>
          </View>

          <View style={card}>
            <Text style={[s.h3, { marginBottom: 12 }]}>Price Trend</Text>
            <PriceTrend tariff={tariff} onSet={openTariff} />
          </View>

          <View style={card}>
            <View style={[s.titleRow, { marginBottom: 12 }]}><Text style={s.h3}>Environmental Benefits</Text><InfoIcon size={18} color={C.muted} /></View>
            <View style={s.benefits}>
              <Benefit bg="#fff3ec" value={co2T} unit="t" label="CO₂ Saved" />
              <Benefit bg="#eaf8f1" value={(co2T * 1000) / CO2_KG_PER_TREE} digits={1} unit="Trees" label="Equivalent Planted" />
              <Benefit bg="#eef4fb" value={((totals.totalYield ?? 0) * COAL_KG_PER_KWH) / 1000} unit="t" label="Standard Coal Saved" />
            </View>
          </View>
        </>
      )}

      <Sheet visible={menu} items={menuItems} onClose={() => setMenu(false)} />
    </Screen>
  );
}

function Stat({ label, value }) {
  return (
    <View style={s.stat}>
      <Text style={s.muted}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function Tile({ icon, bg, value, label }) {
  return (
    <View style={[card, s.tile]}>
      <View style={[s.tileIcon, { backgroundColor: bg }]}>{icon}</View>
      <View style={{ flexShrink: 1 }}>
        <Text><CountUp value={value} style={s.tileVal} /><Text style={s.small}> kWh</Text></Text>
        <Text style={[s.muted, { fontSize: 12 }]} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

function Benefit({ bg, value, digits = 2, unit, label }) {
  return (
    <View style={[s.benefit, { backgroundColor: bg }]}>
      <Text><CountUp value={value} digits={digits} style={s.benefitVal} /><Text style={s.small}> {unit}</Text></Text>
      <Text style={[s.muted, { fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View accessibilityLabel="Loading">
      <View style={[s.skeleton, { height: 300 }]} />
      <View style={[s.skeleton, { height: 22, width: 140, marginTop: 24, marginBottom: 12 }]} />
      <View style={[s.skeleton, { height: 190 }]} />
      <View style={[s.tiles, { marginTop: 12 }]}>{[0, 1, 2, 3].map((i) => <View key={i} style={[s.skeleton, { height: 72, width: '48.5%', marginBottom: 12 }]} />)}</View>
    </View>
  );
}

// "2026-10-17 09:55:00" → "17 Oct, 09:55"
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const since = (t) => `${+t.slice(8, 10)} ${MONTHS[+t.slice(5, 7) - 1]}, ${t.slice(11, 16)}`;

const s = StyleSheet.create({
  offline: { backgroundColor: '#fff8eb', borderRadius: 14, padding: 12, marginBottom: 8, gap: 2 },
  offlineTitle: { color: '#9a5b00', fontWeight: '700', fontSize: 14 },
  offlineText: { color: '#9a5b00', fontSize: 13, lineHeight: 18 },
  temp: { fontSize: 22, fontWeight: '600', marginTop: 10, color: C.ink },
  tempUnit: { fontSize: 13, fontWeight: '500' },
  updated: { textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 4, marginBottom: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
  h2: { fontSize: 20, fontWeight: '700', color: C.ink },
  h3: { fontSize: 17, fontWeight: '700', color: C.ink, marginTop: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { color: C.muted, fontSize: 13 },
  small: { fontSize: 12, color: C.muted },
  err: { color: C.bad, textAlign: 'center', marginVertical: 40 },
  skeleton: { backgroundColor: C.soft, borderRadius: 20 },
  batTop: { flexDirection: 'row', alignItems: 'center' },
  split: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.soft, borderRadius: 12, padding: 12, gap: 2 },
  statVal: { fontSize: 18, fontWeight: '700', color: C.ink },
  bigMoney: { fontSize: 32, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileVal: { fontSize: 17, fontWeight: '700', color: C.ink },
  benefits: { flexDirection: 'row', gap: 8 },
  benefit: { flex: 1, borderRadius: 14, padding: 10, minHeight: 92, gap: 4 },
  benefitVal: { fontSize: 16, fontWeight: '700', color: C.ink },
});
