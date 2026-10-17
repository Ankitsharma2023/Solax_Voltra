import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Field, Input, Note, Page, s as ui } from '../../components/ui';
import { Choice, Slider, TimeField } from '../../components/control/Form';
import { validTime } from '../../lib/control';
import { usePlantSetting } from '../../lib/settings';
import { useSession } from '../../lib/session';
import { ACTIONS, CONDITIONS } from '../../lib/scenes';
import { C } from '../../theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// New Scene (web SceneEditor in src/screens/Intelligence.jsx): saved straight into plant setting "scenes".
export default function SceneEditor() {
  const { plant } = useSession();
  const [scenes, store, loaded] = usePlantSetting(plant.plantId, 'scenes', []);
  const [sc, setSc] = useState({ name: '', days: [0, 1, 2, 3, 4, 5, 6], condition: { type: 'soc_below', value: 20 }, action: 'notify', enabled: true });
  const [state, setState] = useState(null);
  const cond = CONDITIONS.find((c) => c.id === sc.condition.type);
  const badTime = cond.fields.includes('time') && !validTime(sc.condition.time);

  async function save() {
    setState({ busy: true });
    try { await store([...(scenes ?? []), { ...sc, name: sc.name.trim(), id: Date.now() }]); router.back(); }
    catch (e) { setState({ err: e.message }); }
  }

  return (
    <Page title="New Scene">
      <Card>
        <Field label="Name">
          <Input value={sc.name} placeholder="e.g. Evening backup" onChangeText={(v) => setSc({ ...sc, name: v })} />
        </Field>
        <Text style={ui.fieldLabel}>Repeat</Text>
        <View style={st.days}>
          {DAYS.map((d, i) => {
            const on = sc.days.includes(i);
            return (
              <Pressable key={d} onPress={() => setSc({ ...sc, days: on ? sc.days.filter((x) => x !== i) : [...sc.days, i].sort() })} style={[st.day, on && st.dayOn]}>
                <Text style={[st.dayText, on && st.dayTextOn]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Card title="If">
        <Choice options={CONDITIONS.map((c) => [c.id, c.label])} value={sc.condition.type}
          onChange={(v) => setSc({ ...sc, condition: v === 'time' ? { type: 'time', time: '18:00' } : { type: v, value: 20 } })} />
        {cond.fields.includes('time') && (
          <TimeField label="Time" value={sc.condition.time ?? '18:00'} onChange={(v) => setSc({ ...sc, condition: { ...sc.condition, time: v } })} />
        )}
        {cond.fields.includes('value') && (
          <Slider label={cond.label} value={sc.condition.value} min={5} max={100} onChange={(v) => setSc({ ...sc, condition: { ...sc.condition, value: v } })} />
        )}
      </Card>
      <Card title="Then">
        <Choice options={ACTIONS.map((a) => [a.id, a.label])} value={sc.action} onChange={(v) => setSc({ ...sc, action: v })} />
        {sc.action.startsWith('mode_') && <Note>The server will switch the inverter's work mode (using this plant's saved Work Mode settings). Only the owner, their installer or Voltra can save this.</Note>}
      </Card>
      {state?.err && <Note error>{state.err}</Note>}
      <Button title="Save scene" busy={state?.busy} disabled={!loaded || !sc.name.trim() || badTime} onPress={save} />
    </Page>
  );
}

const st = StyleSheet.create({
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.line, minWidth: 42, alignItems: 'center' },
  dayOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  dayText: { fontSize: 13, color: C.ink2 },
  dayTextOn: { color: C.accentDark, fontWeight: '600' },
});
