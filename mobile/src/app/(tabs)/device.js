import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { useDeviceCards } from '../../lib/devices';
import { Badge, Empty, Screen, s as ui } from '../../components/ui';
import { DeviceArt, Live } from '../../components/device/DeviceParts';
import { TopologyIcon, WifiIcon } from '../../components/Icons';
import { C, card as cardStyle } from '../../theme';

// Device tab: grid of device cards (inverter, WiFi dongle, battery) — web src/screens/Device.jsx.
export default function Device() {
  const { plant } = useSession();
  const { overview, cards } = useDeviceCards(plant.plantId);
  const status = cards && !cards.some((c) => c.online) ? 'Offline' : 'Normal';

  return (
    <Screen onRefresh={overview.reload}>
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={ui.h1} numberOfLines={1}>{plant.plantName}</Text>
          <View style={{ marginTop: 4 }}><Badge status={status} /></View>
        </View>
        <Pressable onPress={() => cards && router.push('/device/topology')} hitSlop={10} accessibilityLabel="Topology">
          <TopologyIcon size={28} />
        </Pressable>
      </View>

      {!cards ? (overview.error ? <Empty error>{overview.error.message}</Empty> : (
        <View style={st.grid}>{[0, 1, 2].map((i) => <View key={i} style={[st.cell, st.skeleton]} />)}</View>
      )) : (
        <View style={st.grid}>
          {cards.map((c) => (
            <Pressable key={c.key} onPress={() => router.push({ pathname: '/device/[key]', params: { key: c.key } })}
              style={({ pressed }) => [cardStyle, st.cell, pressed && { backgroundColor: C.soft }]}>
              <View style={st.top}><DeviceArt kind={c.kind} /><WifiIcon size={22} color={c.online ? C.accent : C.muted} /></View>
              <Text style={st.name} numberOfLines={1}>{c.name}</Text>
              <Text style={st.sn} numberOfLines={2}>{c.sn}</Text>
              <Live value={c.summary} style={[st.live, !c.online && c.kind !== 'battery' && { color: C.muted }]} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '48.5%', padding: 14, gap: 4 },
  skeleton: { height: 150, borderRadius: 18, backgroundColor: C.soft, marginBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  name: { fontSize: 16, fontWeight: '700', color: C.ink },
  sn: { fontSize: 12, color: C.muted },
  live: { marginTop: 4, fontSize: 13, fontWeight: '600', color: C.accentDark, fontVariant: ['tabular-nums'] },
});
