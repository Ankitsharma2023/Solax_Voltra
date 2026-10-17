import { useState } from 'react';
import { router } from 'expo-router';
import { api, saveToken } from '../lib/api';
import { Page, Card, Field, Input, Button, Note } from '../components/ui';

// Change password (web: ChangePassword in Me.jsx). The server signs out other devices and hands this
// phone a fresh token.
export default function ChangePassword() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (f.next !== f.confirm) return setMsg({ err: true, text: 'New passwords do not match.' });
    setBusy(true); setMsg(null);
    try {
      const r = await api('/api/auth/change-password', { method: 'POST', body: f });
      if (r.token) await saveToken(r.token);
      setMsg({ text: 'Password changed. Other devices have been signed out.' });
      setTimeout(() => router.back(), 1200);
    } catch (e) { setMsg({ err: true, text: e.message || 'Could not change password.' }); }
    setBusy(false);
  }
  const field = (k, label, ac) => (
    <Field label={label}>
      <Input secureTextEntry autoComplete={ac} textContentType={ac === 'current-password' ? 'password' : 'newPassword'}
        autoCapitalize="none" value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} />
    </Field>
  );
  return (
    <Page title="Change password">
      <Card>
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password (8+ characters, letters and numbers)', 'new-password')}
        {field('confirm', 'Confirm new password', 'new-password')}
        {msg && <Note ok={!msg.err} error={msg.err}>{msg.text}</Note>}
        <Button title={busy ? 'Saving…' : 'Change password'} busy={busy} disabled={!f.current || !f.next} onPress={submit} />
      </Card>
    </Page>
  );
}
