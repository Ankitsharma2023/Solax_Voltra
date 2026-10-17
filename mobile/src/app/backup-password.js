import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, useApi } from '../lib/api';
import { useSession } from '../lib/session';
import { Button, Card, Empty, Field, Input, Note, Page, s as ui } from '../components/ui';
import { C } from '../theme';

// Backup Password: keep the inverter's local settings password safe in the cloud for this plant (web BackupPassword).
export default function BackupPassword() {
  const { plant } = useSession();
  const res = useApi(`/api/plants/${plant.plantId}/backup-password`);
  const caps = useApi(`/api/capabilities?plant=${plant.plantId}`);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const saved = res.data?.value;

  async function save(value) {
    setMsg(null); setBusy(true);
    try {
      await api(`/api/plants/${plant.plantId}/backup-password`, { method: 'POST', body: { value } });
      setEdit(null); setMsg({ text: value ? 'Saved.' : 'Removed.' }); res.reload();
    } catch (e) {
      setMsg({ err: true, text: e.message || 'Could not save.' });
    } finally { setBusy(false); }
  }
  function remove() {
    if (Platform.OS === 'web') { if (window.confirm('Remove the saved password?')) save(null); return; }
    Alert.alert('Remove the saved password?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => save(null) }]);
  }

  if (res.error) return <Page title="Backup Password"><Note>{res.error.message}</Note></Page>;
  return (
    <Page title="Backup Password" subtitle={plant.plantName}>
      <Note>Keep the inverter's settings password here so you or your installer never lose it. Only people who may change this system can see it.</Note>
      <Card>
        {!res.data ? <Empty>Loading…</Empty> : edit != null ? (
          <>
            <Field label="Inverter password">
              <Input value={edit} maxLength={64} autoComplete="off" autoCapitalize="none" autoCorrect={false} autoFocus
                onChangeText={setEdit} onSubmitEditing={() => save(edit.trim())} />
            </Field>
            <Button title="Save" busy={busy} onPress={() => save(edit.trim())} />
            <Button title="Cancel" ghost onPress={() => setEdit(null)} />
          </>
        ) : saved ? (
          <>
            <View style={st.secretRow}>
              <Text style={st.secret} selectable={show}>{show ? saved : '•'.repeat(Math.max(6, saved.length))}</Text>
              <Pressable onPress={() => setShow((v) => !v)} hitSlop={8}><Text style={st.textBtn}>{show ? 'Hide' : 'Show'}</Text></Pressable>
            </View>
            <Text style={ui.small}>Saved by {res.data.by} on {res.data.at?.slice(0, 10)}</Text>
            <Button title="Change" ghost onPress={() => setEdit(saved)} />
            <Button title="Remove" ghost busy={busy} onPress={remove} />
          </>
        ) : (
          <>
            <Text style={ui.muted}>No password saved yet.</Text>
            <Button title="Add password" onPress={() => setEdit('')} />
          </>
        )}
        {msg && <Note ok={!msg.err} error={msg.err}>{msg.text}</Note>}
      </Card>
      {caps.data && !caps.data.mayControl && <Note>Your account can only view this system.</Note>}
    </Page>
  );
}

const st = StyleSheet.create({
  secretRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  secret: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: 1, flexShrink: 1 },
  textBtn: { color: C.accentDark, fontWeight: '600', fontSize: 15 },
});
