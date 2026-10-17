import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api, useApi } from '../lib/api';
import { useSession } from '../lib/session';
import { Page, Card, Field, Input, Segmented, Button, Note, Empty } from '../components/ui';
import { C, card } from '../theme';

// Plant Sharing (as in SolaX): give family members or a caretaker access to this system by e-mail.
// Web: src/screens/Sharing.jsx.
export default function PlantSharing() {
  const { plant, user, reloadPlants } = useSession();
  const res = useApi(plant ? `/api/plants/${plant.plantId}/shares` : null);
  const [f, setF] = useState({ email: '', perm: 'view' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!plant) return <Page title="Plant Sharing"><Empty>No plant selected.</Empty></Page>;

  const post = (path, body) => api(`/api/plants/${plant.plantId}/${path}`, { method: 'POST', body });

  async function share() {
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setMsg({ err: true, text: 'Please enter a valid e-mail address.' });
    setBusy(true); setMsg(null);
    const email = f.email.trim();
    try {
      const b = await post('shares', { ...f, email });
      setMsg({ text: b.status === 'invited'
        ? `Invitation sent to ${email}. They sign up with this e-mail and see ${plant.plantName} straight away.`
        : `${plant.plantName} is now shared with ${email}.` });
      setF({ email: '', perm: 'view' });
      res.reload();
    } catch (err) { setMsg({ err: true, text: err.message }); }
    setBusy(false);
  }
  function remove(email) {
    const self = email === user.login;
    Alert.alert(self ? `Stop seeing ${plant.plantName}?` : `Stop sharing ${plant.plantName} with ${email}?`, '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await post('shares/remove', { email });
          if (self) { await reloadPlants(); router.back(); } else res.reload();
        } catch (err) { setMsg({ err: true, text: err.message }); }
      } },
    ]);
  }

  const list = res.data?.shares ?? [];
  const sharedWithMe = plant.sharedPerm;
  return (
    <Page title="Plant Sharing" subtitle={plant.plantName} onRefresh={res.reload}>
      {sharedWithMe ? (
        <Card>
          <Text style={st.text}>This system was shared with you <Text style={{ fontWeight: '700' }}>({sharedWithMe === 'view' ? 'view only' : 'view and control'})</Text>.</Text>
          <Button ghost title="Remove it from my account" onPress={() => remove(user.login)} />
        </Card>
      ) : res.data && !res.data.canShare ? (
        <Note>Only the owner of this system, their installer or Voltra can share it.</Note>
      ) : (
        <Card>
          <Text style={[st.muted, { marginBottom: 12 }]}>Share this system with family or a caretaker. They log in with their own account.</Text>
          <Field label="Their e-mail address">
            <Input value={f.email} onChangeText={(email) => setF({ ...f, email })} placeholder="name@example.com"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" />
          </Field>
          <Segmented options={[['view', 'View only'], ['control', 'View and control']]} value={f.perm} onChange={(perm) => setF({ ...f, perm })} />
          <Text style={st.small}>{f.perm === 'view' ? 'They see live data, statistics and alarms but cannot change any setting.' : 'They can also change work mode, export limit and other inverter settings.'}</Text>
          <Button title={busy ? 'Sharing…' : 'Share'} busy={busy} disabled={!f.email} onPress={share} style={{ marginTop: 12 }} />
        </Card>
      )}
      {msg && <Note ok={!msg.err} error={msg.err}>{msg.text}</Note>}

      {!sharedWithMe && (
        <View style={[card, { paddingHorizontal: 0, paddingVertical: 4 }]}>
          <Text style={[st.title, { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }]}>Shared with</Text>
          {!res.data ? <Empty>{res.error ? res.error.message : 'Loading…'}</Empty>
            : !list.length ? <Empty>Not shared with anyone yet.</Empty>
            : list.map((s, i) => (
              <View key={s.email} style={[st.row, i < list.length - 1 && st.line]}>
                <View style={st.avatar}><Text style={st.avatarText}>{(s.name || s.email)[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.title} numberOfLines={1}>{s.name || s.email}</Text>
                  <Text style={st.muted}>{s.name ? `${s.email} · ` : ''}{s.perm === 'view' ? 'View only' : 'View and control'}{s.status === 'invited' ? ' · Invitation sent' : ''}</Text>
                </View>
                {res.data.canShare && <Pressable onPress={() => remove(s.email)} hitSlop={8}><Text style={st.link}>Remove</Text></Pressable>}
              </View>
            ))}
        </View>
      )}
    </Page>
  );
}

const st = StyleSheet.create({
  text: { fontSize: 15, color: C.ink, lineHeight: 21 },
  title: { fontSize: 15, fontWeight: '600', color: C.ink },
  muted: { color: C.muted, fontSize: 13 },
  small: { color: C.muted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  line: { borderBottomWidth: 1, borderBottomColor: C.line },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.accentDark, fontWeight: '700', fontSize: 16 },
  link: { color: C.accentDark, fontWeight: '600' },
});
