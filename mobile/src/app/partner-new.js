import { useState } from 'react';
import { Text } from 'react-native';
import { api } from '../lib/api';
import { Page, Card, Field, Input, Segmented, Button, Note } from '../components/ui';
import { C } from '../theme';
import { CopyText } from '../components/Pickers';

// Add a downstream installer / distributor directly (web: AddPartner in Partners.jsx).
export default function AddPartner() {
  const [f, setF] = useState({ role: 'installer', company: '', zip: '', name: '', phone: '', login: '' });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });

  async function submit() {
    setBusy(true); setRes(null);
    try {
      const r = await api('/api/partners', { method: 'POST', body: { ...f, login: f.login.trim() } });
      setRes({ pw: true, text: `Added ${r.user.company}. Organization Number ${r.user.orgNo}. Login ${r.user.login} · temporary password: ${r.tempPassword}` });
    } catch (e) { setRes({ err: true, text: e.message }); }
    setBusy(false);
  }

  return (
    <Page title="Add partner">
      <Card>
        <Segmented options={[['installer', 'Installer'], ['distributor', 'Distributor']]} value={f.role} onChange={set('role')} />
        <Field label="Company Name" required><Input value={f.company} onChangeText={set('company')} /></Field>
        {f.role === 'installer' && <Field label="Zip Code"><Input value={f.zip} onChangeText={set('zip')} keyboardType="number-pad" /></Field>}
        <Field label="Contact Person"><Input value={f.name} onChangeText={set('name')} /></Field>
        <Field label="Phone Number"><Input value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" /></Field>
        <Field label="E-Mail Address (used to log in)" required>
          <Input value={f.login} onChangeText={set('login')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </Field>
        {res && <Note error={res.err}>{res.pw ? <CopyText value={res.text} style={{ fontWeight: '700', color: C.ink }} /> : res.text}</Note>}
        <Button title={busy ? 'Adding…' : 'Add partner'} busy={busy} disabled={!f.company || !f.login} onPress={submit} />
        <Note>The partner is active straight away and sits under your organization. Share the temporary password privately.</Note>
      </Card>
    </Page>
  );
}
