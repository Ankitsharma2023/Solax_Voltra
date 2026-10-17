import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { Page, Card, Note } from '../components/ui';
import { SwitchRow, savePrefs } from '../components/me/common';
import { C } from '../theme';

// Notification Settings (web: Notifications in Me.jsx). The per-type choices are saved on the server
// (/api/me/prefs → notify) and apply to every device. Push on the phone app itself is not wired yet.
export default function Notifications() {
  const { user, reloadUser } = useSession();
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
        <View style={st.head}>
          <Text style={st.title}>Push notifications on this phone</Text>
          <Text style={st.soon}>Coming soon</Text>
        </View>
        <Text style={st.muted}>Alerts that arrive even when the app is closed are coming in an app update. Until then you get alarm e-mails (Me → Email Subscription) and everything is kept in Messages. Push notifications from the Voltra web app keep working.</Text>
        <View style={{ marginTop: 8 }}>
          <SwitchRow title="Push on this phone" sub="Available in an upcoming update" value={false} disabled last onChange={() => {}} />
        </View>
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
