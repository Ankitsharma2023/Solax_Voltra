import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Page, Card, Field, Input, Button, Note } from '../components/ui';
import { C } from '../theme';

// Delete account (web: DeleteAccount in Me.jsx). Voltra admins are removed by another admin.
export default function DeleteAccount() {
  const { user, signOut } = useSession();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  function confirmDelete() {
    Alert.alert('Delete your Voltra account for good?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: del },
    ]);
  }
  async function del() {
    setBusy(true); setMsg(null);
    try {
      await api('/api/me/delete', { method: 'POST', body: { password } });
      await signOut();
    } catch (e) { setMsg(e.message || 'Could not delete the account.'); setBusy(false); }
  }

  return (
    <Page title="Delete account">
      <Card>
        <Text style={{ fontSize: 15, color: C.ink, lineHeight: 21, marginBottom: 14 }}>
          This deletes your Voltra app account <Text style={{ fontWeight: '700' }}>{user?.login}</Text> and your settings. Your solar system keeps working, and its data stays in SolaX Cloud.
        </Text>
        <Field label="Enter your password to confirm">
          <Input secureTextEntry autoComplete="current-password" autoCapitalize="none" value={password} onChangeText={setPassword} />
        </Field>
        {msg && <Note error>{msg}</Note>}
        <Button danger title={busy ? 'Deleting…' : 'Delete my account'} busy={busy} disabled={!password} onPress={confirmDelete} />
      </Card>
    </Page>
  );
}
