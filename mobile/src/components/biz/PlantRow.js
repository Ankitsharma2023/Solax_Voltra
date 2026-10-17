import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { fmt, power } from '../../lib/format';
import { AlarmIcon, BoltIcon, ChevronIcon } from '../Icons';
import { Button } from '../ui';
import { CountBadge, PopIn, useUnread } from '../me/common';
import { useOpenPlant } from './portfolio';
import { C, card } from '../../theme';

// One plant in the portfolio list (web: PlantRow in Business.jsx). Tapping opens the plant app.
export function PlantRow({ p, delay = 0 }) {
  const openPlant = useOpenPlant();
  const [n, u] = power(p.solarW);
  return (
    <PopIn delay={delay}>
      <Pressable onPress={() => openPlant(p.plantId)} style={({ pressed }) => [card, st.row, pressed && { backgroundColor: C.soft }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={st.top}>
            <Text style={st.name} numberOfLines={1}>{p.plantName}</Text>
            <StatusBadge status={p.status} extra={p.alarms.length > 1 ? ` · ${p.alarms.length}` : ''} />
          </View>
          <Text style={st.sub} numberOfLines={2}>{[p.address, p.owner && `Owner: ${p.owner}`].filter(Boolean).join(' · ') || '—'}</Text>
          <View style={st.stats}>
            <View style={st.stat}><BoltIcon size={14} color={C.ink2} /><Text style={st.statText}>{n} {u}</Text></View>
            <Text style={st.statText}>Today {fmt(p.dailyYield)} kWh</Text>
            {p.soc != null && <Text style={st.statText}>🔋 {Math.round(p.soc)}%</Text>}
            <Text style={st.statText}>{fmt(p.pvCapacity, 1)} kWp</Text>
          </View>
          {p.status === 'Alarm' && <Text style={st.alarm} numberOfLines={1}>⚠ {p.alarms[0]?.alarmName}</Text>}
        </View>
        <ChevronIcon size={18} color={C.muted} />
      </Pressable>
    </PopIn>
  );
}

const TONE = {
  Normal: [C.accentSoft, C.accentDark],
  Alarm: [C.badSoft, C.bad],
  Pending: ['#fff4e5', '#9a5b00'],
  Offline: [C.soft, C.muted],
};
export function StatusBadge({ status, label, extra = '' }) {
  const [bg, fg] = TONE[status] || [C.soft, C.muted];
  return <Text style={[st.badge, { backgroundColor: bg, color: fg }]}>{label ?? status}{extra}</Text>;
}

// Bell with the unread count → Messages (web BizHeaderActions).
export function MessagesBell() {
  const unread = useUnread();
  return (
    <Pressable onPress={() => router.push('/messages')} hitSlop={10} accessibilityLabel={`Messages (${unread} unread)`} style={st.bell}>
      <AlarmIcon size={28} color={C.ink} />
      {unread > 0 && <View style={st.bellCount}><CountBadge n={unread} /></View>}
    </Pressable>
  );
}

export function NoPlants({ user }) {
  return (
    <View style={[card, { alignItems: 'center', gap: 6, padding: 24 }]}>
      <Text style={st.name}>No plants yet</Text>
      <Text style={[st.sub, { textAlign: 'center', fontSize: 13 }]}>{user.role === 'admin' ? 'No plants on the Voltra SolaX account.' : 'Add the systems you install with their inverter SN and registration number.'}</Text>
      <Button title="Create new plant" onPress={() => router.push('/plant-create')} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingRight: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: C.ink, flexShrink: 1 },
  sub: { fontSize: 12, color: C.muted },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 13, color: C.ink2, fontVariant: ['tabular-nums'] },
  alarm: { fontSize: 13, color: C.bad },
  badge: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  bell: { padding: 2 },
  bellCount: { position: 'absolute', top: -6, right: -8 },
});
