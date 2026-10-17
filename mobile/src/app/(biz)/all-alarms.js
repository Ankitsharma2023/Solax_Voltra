import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../lib/session';
import { Screen, Note } from '../../components/ui';
import { AllGood, PopIn } from '../../components/me/common';
import { usePortfolio, useOpenPlant } from '../../components/biz/portfolio';
import { MessagesBell } from '../../components/biz/PlantRow';
import { C, card } from '../../theme';

const ROLE_LABEL = { installer: 'Installer', distributor: 'Distributor', admin: 'Voltra Admin' };

// Current alarms across every plant (web: AllAlarms in Business.jsx). Tap one to open its plant.
export default function AllAlarms() {
  const { user } = useSession();
  const pf = usePortfolio();
  const openPlant = useOpenPlant();
  const rows = (pf.data?.plants ?? []).flatMap((p) => p.alarms.map((a) => ({ ...a, plantId: p.plantId, plantName: p.plantName })))
    .sort((a, b) => String(b.alarmStartTime).localeCompare(String(a.alarmStartTime)));

  return (
    <Screen onRefresh={pf.reload}>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Text style={st.h1}>Alarms</Text>
          <Text style={st.badge}>{user.company || ROLE_LABEL[user.role]}</Text>
        </View>
        <MessagesBell />
      </View>
      {pf.error && !pf.data ? <Text style={st.err}>{pf.error.message}</Text>
        : !pf.data ? <Text style={st.empty}>Loading…</Text>
        : !rows.length ? <AllGood title="No active alarms" sub={`Across all ${pf.data.plants.length} plants.`} />
        : rows.map((a, i) => (
          <PopIn key={`${a.plantId}-${a.deviceSn}-${a.alarmCode ?? a.alarmName}-${i}`} delay={i < 15 ? i * 40 : 0}>
            <Pressable onPress={() => openPlant(a.plantId)} style={({ pressed }) => [card, { gap: 6 }, pressed && { backgroundColor: C.soft }]}>
              <View style={st.top}>
                <Text style={[st.level, a.alarmLevel === 3 ? st.l3 : a.alarmLevel === 2 ? st.l2 : null]}>{a.alarmLevel === 3 ? 'Fault' : 'Warning'}</Text>
                <Text style={st.muted}>{a.alarmStartTime}</Text>
              </View>
              <Text style={st.name}>{a.alarmName}</Text>
              <Text style={st.muted}>{a.plantName} · {a.deviceSn}</Text>
            </Pressable>
          </PopIn>
        ))}
      <Note>Shows current alarms. Open a plant to see its alarm history.</Note>
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  h1: { fontSize: 24, fontWeight: '700', color: C.ink },
  badge: { alignSelf: 'flex-start', marginTop: 4, fontSize: 13, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', backgroundColor: C.accentSoft, color: C.accentDark },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  level: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', backgroundColor: C.soft, color: C.ink },
  l2: { backgroundColor: '#fff4e5', color: '#9a5b00' },
  l3: { backgroundColor: C.badSoft, color: C.bad },
  name: { fontSize: 16, fontWeight: '700', color: C.ink },
  muted: { color: C.muted, fontSize: 13 },
  err: { color: C.bad, textAlign: 'center', marginVertical: 40 },
  empty: { color: C.muted, textAlign: 'center', marginVertical: 40 },
});
