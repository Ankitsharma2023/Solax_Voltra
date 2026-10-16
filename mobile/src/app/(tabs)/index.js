import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../lib/session';
import EnergyFlow from '../../components/EnergyFlow';
import SocGauge from '../../components/SocGauge';
import CountUp from '../../components/CountUp';
import { BoltIcon, HouseBoltIcon, InverterIcon, PylonIcon } from '../../components/Icons';
import { C, card } from '../../theme';

const FIVE_MIN = 5 * 60 * 1000;
const CO2_KG_PER_KWH = 0.997, COAL_KG_PER_KWH = 0.4, CO2_KG_PER_TREE = 18.3;

// Home tab: same data and layout as the web app's Home (src/screens/Home.jsx).
export default function Home() {
  const { plant } = useSession();
  const id = plant.plantId;
  const overview = useApi(`/api/plants/${id}/overview`, FIVE_MIN);
  const weather = useApi(`/api/plants/${id}/weather`);
  const alarms = useApi(`/api/plants/${id}/alarms`, FIVE_MIN);
  const [pulling, setPulling] = useState(false);

  async function refresh() {
    setPulling(true);
    await Promise.all([overview.reload(), alarms.reload(), weather.reload()]);
    setPulling(false);
  }

  const data = overview.data;
  const inv = data?.inverters?.[0] || {};
  const bat = data?.batteries?.[0];
  const totals = data?.totals || {};
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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} tintColor={C.accent} colors={[C.accent]} />}>
        <View style={s.header}>
          <Text style={s.h1} numberOfLines={1}>{plant.plantName}</Text>
          {status && <Text style={[s.badge, status === 'Alarm' ? s.badgeBad : status === 'Offline' ? s.badgeOff : null]}>{status}</Text>}
          {weather.data?.min != null && <Text style={s.temp}>{fmt(weather.data.min, 1)}~{fmt(weather.data.max, 1)}<Text style={s.tempUnit}>°C</Text></Text>}
        </View>

        {overview.error && !data ? <Text style={s.err}>{overview.error.message}</Text> : !data ? <View style={[s.skeleton, { height: 300 }]} /> : (
          <>
            <EnergyFlow solar={solar} home={homeW} battery={batteryW} grid={gridW} soc={bat?.batterySOC} hasBattery={!!bat} />
            <Text style={s.updated}>Updated {inv.plantLocalTime?.slice(11, 16) || '--'} · pull down to refresh</Text>

            <Text style={s.h2}>Daily Energy</Text>
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
                  <Stat label="Charged" value={totals.dailyCharged} />
                  <Stat label="Discharged" value={totals.dailyDischarged} />
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
              <Text style={[s.h3, { marginBottom: 12 }]}>Environmental Benefits</Text>
              <View style={s.benefits}>
                <Benefit bg="#fff3ec" value={co2T} unit="t" label="CO₂ Saved" />
                <Benefit bg="#eaf8f1" value={(co2T * 1000) / CO2_KG_PER_TREE} digits={1} unit="Trees" label="Equivalent Planted" />
                <Benefit bg="#eef4fb" value={((totals.totalYield ?? 0) * COAL_KG_PER_KWH) / 1000} unit="t" label="Standard Coal Saved" />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={s.stat}>
      <Text style={s.muted}>{label}</Text>
      <Text><CountUp value={value} style={s.statVal} /><Text style={s.small}> kWh</Text></Text>
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

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 8 },
  h1: { fontSize: 24, fontWeight: '700', color: C.ink },
  badge: { alignSelf: 'flex-start', marginTop: 4, fontSize: 14, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', backgroundColor: C.accentSoft, color: C.accentDark },
  badgeBad: { backgroundColor: C.badSoft, color: C.bad },
  badgeOff: { backgroundColor: C.soft, color: C.muted },
  temp: { fontSize: 22, fontWeight: '600', marginTop: 10, color: C.ink },
  tempUnit: { fontSize: 13, fontWeight: '500' },
  updated: { textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 4, marginBottom: 8 },
  h2: { fontSize: 20, fontWeight: '700', color: C.ink, marginTop: 12, marginBottom: 12 },
  h3: { fontSize: 17, fontWeight: '700', color: C.ink, marginTop: 4 },
  muted: { color: C.muted, fontSize: 13 },
  small: { fontSize: 12, color: C.muted },
  err: { color: C.bad, textAlign: 'center', marginVertical: 40 },
  skeleton: { backgroundColor: C.soft, borderRadius: 20 },
  batTop: { flexDirection: 'row', alignItems: 'center' },
  split: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.soft, borderRadius: 12, padding: 12, gap: 2 },
  statVal: { fontSize: 18, fontWeight: '700', color: C.ink },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileVal: { fontSize: 17, fontWeight: '700', color: C.ink },
  benefits: { flexDirection: 'row', gap: 8 },
  benefit: { flex: 1, borderRadius: 14, padding: 10, minHeight: 92, gap: 4 },
  benefitVal: { fontSize: 16, fontWeight: '700', color: C.ink },
});
