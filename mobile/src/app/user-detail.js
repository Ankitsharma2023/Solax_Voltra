import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, useApi } from '../lib/api';
import { Page, Card, KV, Button, Note, Empty } from '../components/ui';
import { Chips } from '../components/me/common';
import { ROLE } from '../components/biz/admin';
import { C } from '../theme';
import { CopyText } from '../components/Pickers';

// Admin: one account — approve, change role, reset password, suspend, delete, link plants
// (web: UserDetail in Users.jsx).
export default function UserDetail() {
  const { id } = useLocalSearchParams();
  const users = useApi('/api/admin/users');
  const plants = useApi('/api/plants');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const u = users.data?.find((x) => String(x.id) === String(id));

  const run = async (action, extra = {}) => {
    setMsg(null); setBusy(true);
    try {
      const r = await api(`/api/admin/users/${u.id}`, { method: 'POST', body: { action, ...extra } });
      setMsg(r.tempPassword ? { text: `Temporary password: ${r.tempPassword}`, pw: true } : { text: 'Saved ✓' });
      if (action === 'delete') { setTimeout(() => router.back(), 600); return; }
      await users.reload();
    } catch (e) { setMsg({ err: true, text: e.message }); }
    setBusy(false);
  };
  const act = (action, extra, confirmText, destructive) => {
    if (!confirmText) return run(action, extra);
    Alert.alert(confirmText, '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', style: destructive ? 'destructive' : 'default', onPress: () => run(action, extra) },
    ]);
  };

  if (!u) return <Page title="Account"><Empty error={!!users.error}>{users.error ? users.error.message : users.data ? 'Account not found.' : 'Loading…'}</Empty></Page>;
  const linked = (plants.data ?? []).filter((p) => u.plantIds.includes(String(p.plantId)));
  const unlinked = (plants.data ?? []).filter((p) => !u.plantIds.includes(String(p.plantId)));

  return (
    <Page title={u.company || u.name || u.login} subtitle={ROLE[u.role]} onRefresh={() => Promise.all([users.reload(), plants.reload()])}>
      <Card style={{ paddingVertical: 8 }}>
        <KV rows={[
          ['Login', u.login],
          u.name && ['Name', u.name],
          u.company && ['Company', u.company],
          u.phone && ['Phone', u.phone],
          ['Status', u.status],
          ['Created', u.createdAt?.slice(0, 10)],
        ].filter(Boolean)} />
      </Card>

      {msg && (
        <View style={msg.pw && st.pw}>
          <Note ok={!msg.err && !msg.pw} error={msg.err}>{msg.pw ? <CopyText value={msg.text} style={st.pwText} /> : msg.text}</Note>
          {msg.pw && <Text style={st.small}>Share it privately. They should change it after logging in.</Text>}
        </View>
      )}

      <Card title="Account">
        {u.status === 'pending' && <Button title={`Approve ${ROLE[u.role].toLowerCase()}`} busy={busy} onPress={() => act('approve')} />}
        {u.status === 'suspended' && <Button title="Re-activate" busy={busy} onPress={() => act('approve')} />}
        <Text style={[st.label, { marginTop: 12 }]}>Role</Text>
        <Chips options={Object.entries(ROLE)} value={u.role}
          onChange={(r) => r !== u.role && act('role', { role: r }, `Change role to ${ROLE[r]}?`)} />
        <Button ghost title="Reset password" disabled={busy} onPress={() => act('reset', {}, `Reset the password for ${u.login}? They will be signed out everywhere.`)} />
        {u.status === 'active' && <Button ghost title="Suspend" disabled={busy} onPress={() => act('suspend', {}, `Suspend ${u.login}? They won't be able to see any plants.`, true)} />}
        <Pressable style={st.del} disabled={busy} onPress={() => act('delete', {}, `Delete ${u.login} permanently?`, true)}>
          <Text style={st.delText}>Delete account</Text>
        </Pressable>
      </Card>

      {u.role !== 'admin' && (
        <Card title={`Plants (${linked.length})`}>
          {linked.map((p) => (
            <View key={p.plantId} style={st.rec}>
              <View style={{ flex: 1 }}>
                <Text style={st.name} numberOfLines={1}>{p.plantName}</Text>
                <Text style={st.small} numberOfLines={1}>{p.plantAddress || p.plantId}</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => act('unassign', { plantId: p.plantId }, `Unlink ${p.plantName}?`, true)}>
                <Text style={st.danger}>Unlink</Text>
              </Pressable>
            </View>
          ))}
          {unlinked.length > 0 && (showLink ? (
            <View style={{ marginTop: 8 }}>
              <Text style={st.label}>Link a plant…</Text>
              {unlinked.map((p) => (
                <Pressable key={p.plantId} style={({ pressed }) => [st.rec, pressed && { backgroundColor: C.soft }]}
                  onPress={() => { setShowLink(false); act('assign', { plantId: p.plantId }); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.name} numberOfLines={1}>{p.plantName}</Text>
                    <Text style={st.small} numberOfLines={1}>{p.plantAddress || p.plantId}</Text>
                  </View>
                  <Text style={st.link}>Link</Text>
                </Pressable>
              ))}
              <Button ghost title="Cancel" onPress={() => setShowLink(false)} />
            </View>
          ) : <Button ghost title="Link a plant…" disabled={busy} onPress={() => setShowLink(true)} />)}
        </Card>
      )}
    </Page>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 13, color: C.muted, marginBottom: 6 },
  small: { color: C.muted, fontSize: 12 },
  name: { fontSize: 15, fontWeight: '600', color: C.ink },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  link: { color: C.accentDark, fontWeight: '600' },
  danger: { color: C.bad, fontWeight: '600' },
  del: { marginTop: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center' },
  delText: { color: C.bad, fontWeight: '600', fontSize: 16 },
  pw: { backgroundColor: '#fff8e6', borderRadius: 12, padding: 12, marginBottom: 12 },
  pwText: { fontWeight: '700', color: C.ink },
});
