import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Card, Empty, Loading, Page, s as ui } from '../../components/ui';
import { DataSections } from '../../components/device/DeviceParts';
import { buildCards } from '../../lib/devices';
import { useApi } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../lib/session';
import { C } from '../../theme';

const EVERY_S = 60;

// Live Data (SolaX Me → Application → Live Data): every reading of every device on one screen,
// refreshed every minute while it is open (web src/screens/LiveData.jsx).
export default function LiveData() {
  const { plant } = useSession();
  const overview = useApi(`/api/plants/${plant.plantId}/overview`, EVERY_S * 1000);
  const [left, setLeft] = useState(EVERY_S);
  const [pick, setPick] = useState(null);

  useEffect(() => { setLeft(EVERY_S); }, [overview.data]);
  useEffect(() => {
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const cards = overview.data ? buildCards(overview.data).filter((c) => c.kind !== 'dongle') : [];
  const card = cards.find((c) => c.key === pick) || cards[0];
  const inv = overview.data?.inverters?.[0] || {};
  const bat = overview.data?.batteries?.[0];
  const solar = inv.MPPTTotalInputPower ?? 0, batteryW = bat?.chargeDischargePower ?? 0, gridW = inv.gridPower ?? 0;
  const flows = [
    ['Solar', solar, 'W', C.solar],
    ['Home', Math.max(0, solar - batteryW - gridW), 'W', C.home],
    bat && [batteryW >= 0 ? 'Battery charging' : 'Battery discharging', Math.abs(batteryW), 'W', C.battery],
    [gridW >= 0 ? 'Grid export' : 'Grid import', Math.abs(gridW), 'W', C.grid],
    bat && ['Battery SOC', bat.batterySOC, '%', C.battery],
    ['Inverter temperature', inv.inverterTemperature, '°C', '#9aa2aa'],
  ].filter(Boolean);

  return (
    <Page title="Live Data" subtitle={plant.plantName} onRefresh={overview.reload}
      actions={(
        <Pressable onPress={() => overview.reload()} accessibilityLabel="Refresh now" style={s.pill} hitSlop={8}>
          <View style={s.dot} /><Text style={s.pillText}>LIVE</Text>
        </Pressable>
      )}>
      <View style={s.bar}>
        <Text style={ui.muted}>{inv.plantLocalTime ? `Reading from ${inv.plantLocalTime.slice(11, 16)}` : 'Connecting…'}</Text>
        <View style={s.count}>
          <Svg width={18} height={18} viewBox="0 0 36 36">
            <Circle cx="18" cy="18" r="15" fill="none" stroke="#e5e8eb" strokeWidth="4" />
            <Circle cx="18" cy="18" r="15" fill="none" stroke={C.accent} strokeWidth="4" strokeDasharray={`${(left / EVERY_S) * 94.2} 94.2`} transform="rotate(-90 18 18)" />
          </Svg>
          <Text style={[ui.muted, { fontVariant: ['tabular-nums'] }]}>{left}s</Text>
        </View>
      </View>

      {overview.error && <Empty error>{overview.error.message}</Empty>}
      {!overview.data ? <Loading /> : (
        <>
          <Card>
            <View style={ui.tiles}>
              {flows.map(([label, v, unit, color]) => (
                <View key={label} style={[ui.tile, s.liveTile, { borderLeftColor: color }]}>
                  <Text style={ui.muted} numberOfLines={1}>{label}</Text>
                  <Text style={s.big}>{fmt(v, 0)}<Text style={ui.small}> {unit}</Text></Text>
                </View>
              ))}
            </View>
          </Card>

          {cards.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginBottom: 12 }}>
              {cards.map((c) => (
                <Pressable key={c.key} onPress={() => setPick(c.key)} style={[s.chip, c === card && s.chipOn]}>
                  <Text style={[s.chipText, c === card && s.chipTextOn]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {card && <DataSections card={card} plant={plant} />}
        </>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: C.accentSoft },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent },
  pillText: { fontSize: 12, fontWeight: '700', color: C.accentDark },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveTile: { borderLeftWidth: 3 },
  big: { fontSize: 20, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  chips: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
  chipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  chipText: { fontSize: 14, color: C.ink2 },
  chipTextOn: { color: C.accentDark, fontWeight: '600' },
});
