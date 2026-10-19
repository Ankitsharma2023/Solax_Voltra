import { useState } from 'react';
import { Text, View } from 'react-native';
import { api, useApi } from '../lib/api';
import { Page, Card, Field, Input, Button, Note } from '../components/ui';
import { Chips } from '../components/me/common';
import { ROLE } from '../components/biz/admin';
import { C } from '../theme';
import { CopyText } from '../components/Pickers';

// Admin: create an account with a temporary password (web: NewUser in Users.jsx).
export default function NewUser() {
  const plants = useApi('/api/plants');
  const [f, setF] = useState({ role: 'customer', login: '', name: '', company: '', phone: '', plantId: '' });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });

  async function submit() {
    setBusy(true); setRes(null);
    try {
      const r = await api('/api/admin/users', { method: 'POST', body: { ...f, login: f.login.trim() } });
      setRes({ text: `Created ${r.user.login}. Temporary password: ${r.tempPassword}`, pw: true });
    } catch (e) { setRes({ err: true, text: e.message }); }
    setBusy(false);
  }

  return (
    <Page title="New account">
      <Card>
        <Text style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Identity</Text>
        <Chips options={Object.entries(ROLE)} value={f.role} onChange={set('role')} />
        <Field label="Email or mobile"><Input value={f.login} onChangeText={set('login')} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" /></Field>
        <Field label="Name"><Input value={f.name} onChangeText={set('name')} /></Field>
        {(f.role === 'installer' || f.role === 'distributor') && <Field label="Company"><Input value={f.company} onChangeText={set('company')} /></Field>}
        {f.role !== 'admin' && (
          <View>
            <Text style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Plant (optional)</Text>
            <Chips options={[['', '—'], ...(plants.data ?? []).map((p) => [String(p.plantId), p.plantName])]} value={f.plantId} onChange={set('plantId')} />
          </View>
        )}
        {res && <Note ok={false} error={res.err}>{res.pw ? <CopyText value={res.text} style={{ fontWeight: '700', color: C.ink }} /> : res.text}</Note>}
        <Button title="Create account" busy={busy} disabled={!f.login} onPress={submit} />
      </Card>
    </Page>
  );
}
