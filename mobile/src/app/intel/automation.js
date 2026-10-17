import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Note, Page, SectionTitle, s as ui } from '../../components/ui';
import { usePlantSetting } from '../../lib/settings';
import { useSession } from '../../lib/session';
import { describeScene } from '../../lib/scenes';
import { C } from '../../theme';

// Automation / Scenes (web Automation in src/screens/Intelligence.jsx). Scenes are plant setting "scenes";
// the Voltra server runs them. New scenes are made on /intel/scene.
const RECOMMENDED = [
  { name: 'Low battery alert', condition: { type: 'soc_below', value: 20 }, action: 'notify' },
  { name: 'Offline alert', condition: { type: 'offline' }, action: 'notify' },
];

export default function Automation() {
  const { plant } = useSession();
  const [stored, store] = usePlantSetting(plant.plantId, 'scenes', []);
  const scenes = stored ?? [];
  const [err, setErr] = useState(null);
  const persist = (list) => { setErr(null); return store(list).catch((e) => setErr(e.message)); };
  return (
    <Page title="Automation" subtitle="Scenes"
      actions={<Pressable hitSlop={10} onPress={() => router.push('/intel/scene')}><Text style={st.link}>+ Add</Text></Pressable>}>
      <Card title="Smart recommendations">
        {RECOMMENDED.map((r, i) => {
          const added = scenes.some((x) => x.name === r.name);
          return (
            <View key={r.name} style={[st.row, i < RECOMMENDED.length - 1 && ui.rowLine]}>
              <View style={{ flex: 1 }}>
                <Text style={ui.rowTitle}>{r.name}</Text>
                <Text style={ui.muted}>{describeScene(r)}</Text>
              </View>
              <Pressable hitSlop={8} disabled={added} onPress={() => persist([...scenes, { ...r, id: Date.now(), enabled: true, days: [0, 1, 2, 3, 4, 5, 6] }])}>
                <Text style={[st.link, added && { color: C.muted }]}>{added ? 'Added' : 'Enable'}</Text>
              </Pressable>
            </View>
          );
        })}
      </Card>

      <SectionTitle>My scenes ({scenes.length})</SectionTitle>
      {!scenes.length ? (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={ui.rowTitle}>No scenes yet</Text>
          <Text style={ui.muted}>Tap + Add to create one.</Text>
        </Card>
      ) : scenes.map((sc) => (
        <Card key={sc.id}>
          <View style={st.scene}>
            <View style={{ flex: 1 }}>
              <Text style={ui.rowTitle}>{sc.name}</Text>
              <Text style={ui.muted}>{describeScene(sc)}</Text>
            </View>
            <Switch value={!!sc.enabled} onValueChange={(v) => persist(scenes.map((x) => (x.id === sc.id ? { ...x, enabled: v } : x)))}
              trackColor={{ true: C.accent, false: '#d4d9de' }} thumbColor="#fff" ios_backgroundColor="#d4d9de" />
          </View>
          <Pressable hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 8 }} onPress={() => persist(scenes.filter((x) => x.id !== sc.id))}>
            <Text style={[st.link, { color: C.bad }]}>Delete</Text>
          </Pressable>
        </Card>
      ))}
      {err && <Note error>{err}</Note>}
      <Note>The Voltra server checks every scene every 5 minutes, even when the app is closed. Each scene runs at most once a day. Results appear in Messages; mode switches are also in Command History.</Note>
    </Page>
  );
}

const st = StyleSheet.create({
  link: { color: C.accentDark, fontWeight: '600', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  scene: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
