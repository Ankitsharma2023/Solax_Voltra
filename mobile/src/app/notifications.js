import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { pushSupported, pushSwitchedOff, registerPush, sendTestPush, switchPushOn, unregisterPush } from '../lib/push';
import { Button } from '../components/ui';
import { useSession } from '../lib/session';
import { Page, Card, Note } from '../components/ui';
import { SwitchRow, savePrefs } from '../components/me/common';
import { C } from '../theme';

// Notification Settings (web: Notifications in Me.jsx). The per-type choices are saved on the server
// (/api/me/prefs → notify) and apply to every device; the switch at the top is for this phone only.
export default function Notifications() {
  const { user, reloadUser, plant, isBusiness } = useSession();
  const [push, setPush] = useState(null); // 'on' | 'off' | 'denied' | 'unsupported'
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  useEffect(() => {
    (async () => setPush(!pushSupported ? 'unsupported' : (await pushSwitchedOff()) ? 'off'
      : await registerPush({ plantId: isBusiness ? undefined : plant?.plantId, ask: false })))();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function togglePush(on) {
    setBusy(true); setTestMsg(null);
    if (on) setPush(await switchPushOn(isBusiness ? undefined : plant?.plantId));
    else { await unregisterPush({ remember: true }); setPush('off'); }
    setBusy(false);
  }
  async function test() {
    setTestMsg(null);
    try { await sendTestPush(); setTestMsg({ ok: true, text: 'Sent. It should arrive in a few seconds.' }); }
    catch (e) { setTestMsg({ text: e.message }); }
  }
  const [types, setTypes] = useState({ alarm: true, automation: true, ...(user?.notify ?? {}) });
  const [msg, setMsg] = useState(null);

  async function setType(k, on) {
    const prev = types;
    setTypes({ ...types, [k]: on }); setMsg(null);
    if (!(await savePrefs({ notify: { [k]: on } }))) { setTypes(prev); setMsg('Could not save. Please try again.'); return; }
    reloadUser();
  }

  return (
    <Page title="Notification Settings">
      <Card>
        <Text style={st.title}>Push notifications on this phone</Text>
        <Text style={[st.muted, { marginTop: 4 }]}>Alerts that arrive even when the app is closed.</Text>
        <View style={{ marginTop: 8 }}>
          <SwitchRow title="Push on this phone"
            sub={push === 'unsupported' ? 'Only on a real phone' : push === 'denied' ? 'Blocked in the phone\'s settings' : push === 'on' ? 'On' : 'Off'}
            value={push === 'on'} disabled={busy || push === 'unsupported' || push === null} last onChange={togglePush} />
        </View>
        {push === 'denied' && (
          <Button ghost title="Open phone settings" onPress={() => Linking.openSettings()} />
        )}
        {push === 'on' && <Button ghost title="Send a test notification" onPress={test} />}
        {testMsg && <Note ok={testMsg.ok} error={!testMsg.ok}>{testMsg.text}</Note>}
      </Card>
      <Card>
        <Text style={[st.title, { marginBottom: 4 }]}>What to notify me about</Text>
        <SwitchRow title="Alarms" sub={`A fault or warning starts on ${user?.role === 'customer' ? 'your system' : 'a plant you look after'}`}
          value={types.alarm} onChange={(v) => setType('alarm', v)} />
        <SwitchRow title="Automation" sub='One of your scenes runs (for example "battery below 20%")'
          value={types.automation} onChange={(v) => setType('automation', v)} last />
        <Text style={[st.small, { marginTop: 8 }]}>Everything is also kept in Messages, whatever you choose here.</Text>
      </Card>
      {msg && <Note error>{msg}</Note>}
    </Page>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '700', color: C.ink, flexShrink: 1 },
  soon: { fontSize: 12, fontWeight: '600', color: C.accentDark, backgroundColor: C.accentSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  muted: { color: C.muted, fontSize: 13, lineHeight: 19 },
  small: { color: C.muted, fontSize: 12 },
});
