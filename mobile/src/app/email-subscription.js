import { useState } from 'react';
import { Text } from 'react-native';
import { useSession } from '../lib/session';
import { Page, Card, Note } from '../components/ui';
import { SwitchRow, savePrefs } from '../components/me/common';
import { C } from '../theme';

// Email Subscription (web: EmailSubscription in Me.jsx): alarm e-mails on/off.
export default function EmailSubscription() {
  const { user, reloadUser } = useSession();
  const [on, setOn] = useState(!!user?.emailAlerts);
  const [msg, setMsg] = useState(null);

  async function toggle(v) {
    setOn(v); setMsg(null);
    if (!(await savePrefs({ emailAlerts: v }))) { setOn(!v); setMsg({ err: true, text: 'Could not save. Please try again.' }); return; }
    setMsg({ text: v ? `Alarm e-mails will go to ${user?.login}.` : 'Alarm e-mails are off.' });
    reloadUser();
  }

  return (
    <Page title="Email Subscription">
      <Card>
        <SwitchRow title="Alarm e-mails" sub={`One e-mail when a new alarm starts on ${user?.role === 'customer' ? 'your system' : 'any plant you look after'}`}
          value={on} onChange={toggle} last />
        {msg && <Note ok={!msg.err} error={msg.err}>{msg.text}</Note>}
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Sent from no-reply@voltra.in to {user?.login}.</Text>
      </Card>
    </Page>
  );
}
