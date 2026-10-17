import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '../lib/api';
import { modelName } from '../lib/format';
import { useSession } from '../lib/session';
import { Card, Empty, Page, Segmented } from '../components/ui';
import { C } from '../theme';

// Alarms (web src/screens/Alarms.jsx): ongoing and history.
const LEVEL = { 1: 'Notice', 2: 'Warning', 3: 'Fault' };
const TONE = { 1: [C.soft, C.ink2], 2: ['#fff4e0', '#b45309'], 3: [C.badSoft, C.bad] };

export default function Alarms() {
  const { plant } = useSession();
  const [tab, setTab] = useState('current');
  const res = useApi(`/api/plants/${plant.plantId}/alarms?state=${tab === 'current' ? 1 : 0}`);
  return (
    <Page title="Alarms" subtitle={plant.plantName} onRefresh={res.reload}>
      <Segmented options={[['current', 'Current'], ['history', 'History']]} value={tab} onChange={setTab} />
      {res.error && !res.data ? <Empty error>{res.error.message}</Empty>
        : !res.data ? <Empty>Loading…</Empty>
        : !res.data.length ? (
          <Card style={s.emptyState}>
            <View style={s.okCircle}><Text style={s.okText}>✓</Text></View>
            <Text style={s.title}>{tab === 'current' ? 'No active alarms' : 'No alarm history'}</Text>
            <Text style={s.muted}>{tab === 'current' ? 'Your system is running normally.' : 'Nothing has been recorded yet.'}</Text>
          </Card>
        ) : res.data.map((a, i) => {
          const tone = TONE[a.alarmLevel] || TONE[2];
          return (
            <Card key={i} style={{ gap: 4 }}>
              <View style={s.top}>
                <Text style={[s.level, { backgroundColor: tone[0], color: tone[1] }]}>{LEVEL[a.alarmLevel] || 'Alarm'}</Text>
                <Text style={s.muted}>Code {a.errorCode}</Text>
              </View>
              <Text style={s.title}>{a.alarmName}</Text>
              <Text style={s.muted}>{modelName(Number(a.deviceModel))} · {a.deviceSn}</Text>
              <Text style={s.muted}>{a.alarmStartTime}{a.alarmEndTime ? ` → ${a.alarmEndTime.slice(11)}` : ' · ongoing'}</Text>
              {!!a.suggestion && <Text style={s.hint}>{a.suggestion}</Text>}
            </Card>
          );
        })}
    </Page>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  level: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  title: { fontSize: 16, fontWeight: '700', color: C.ink },
  muted: { color: C.muted, fontSize: 13 },
  hint: { fontSize: 13, color: C.ink2, backgroundColor: C.soft, borderRadius: 10, padding: 10, marginTop: 6, lineHeight: 19 },
  emptyState: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  okCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  okText: { color: C.accentDark, fontSize: 22, fontWeight: '700' },
});
