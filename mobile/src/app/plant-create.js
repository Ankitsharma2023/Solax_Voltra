import { useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Field, Input, Note, Page } from '../components/ui';
import { ScanInput } from '../components/ScanInput';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

// Create Plant (web app: CreatePlant in src/screens/PlantEdit.jsx): link a new system by its inverter SN +
// dongle registration no. If it is not yet in Voltra's SolaX account, Voltra receives the request and registers it.
const PLANT_FIELDS = [
  ['plantName', 'Plant name', 'text', true],
  ['plantAddress', 'Address', 'text'],
  ['pvCapacity', 'PV capacity (kWp)', 'number'],
  ['batteryCapacity', 'Battery capacity (kWh)', 'number'],
  ['installDate', 'Installation date', 'date'],
];

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function CreatePlant() {
  const { reloadPlants } = useSession();
  const [f, setF] = useState({ plantName: '', plantAddress: '', pvCapacity: '', batteryCapacity: '', installDate: '', inverterSn: '', registerNo: '', ownerEmail: '' });
  const [state, setState] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function submit() {
    if (!f.plantName.trim()) return setState({ err: 'Please enter a plant name.' });
    if (f.installDate && !/^\d{4}-\d{2}-\d{2}$/.test(f.installDate)) return setState({ err: 'Please enter the installation date as YYYY-MM-DD.' });
    if (!f.inverterSn || !f.registerNo) return setState({ err: 'Please enter the inverter SN and the dongle registration no.' });
    setState({ busy: true });
    try {
      const r = await api('/api/plants/create', { method: 'POST', body: f });
      if (r.status === 'linked') await reloadPlants();
      setState({ done: r.status });
    } catch (e) { setState({ err: e.message || 'Could not create the plant.' }); }
  }

  if (state?.done) return (
    <Page title="Create Plant">
      <Card>
        {state.done === 'linked'
          ? <Note ok>✓ {f.plantName} is linked to your account. Live data appears straight away.</Note>
          : <Note ok>✓ Request sent. This system is not in Voltra's SolaX account yet — Voltra registers it and you'll get a message when it appears (usually within one working day).</Note>}
        <Button title="Done" onPress={goBack} />
      </Card>
    </Page>
  );

  return (
    <Page title="Create Plant">
      <Card title="Plant">
        {PLANT_FIELDS.map(([k, label, type, req]) => (
          <Field key={k} label={label} required={req}>
            <Input value={f[k]} onChangeText={(v) => set(k)(type === 'number' ? v.replace(',', '.') : v)}
              keyboardType={type === 'number' ? 'decimal-pad' : type === 'date' ? 'numbers-and-punctuation' : 'default'}
              placeholder={type === 'date' ? 'YYYY-MM-DD' : undefined} maxLength={type === 'date' ? 10 : undefined}
              autoCapitalize={type === 'text' ? 'sentences' : 'none'} />
          </Field>
        ))}
      </Card>
      <Card title="Devices">
        <Field label="Inverter SN" required>
          <ScanInput value={f.inverterSn} onChange={set('inverterSn')} length={14} scanTitle="inverter label" placeholder="Type or scan the inverter label" />
        </Field>
        <Field label="Registration no. (WiFi dongle)" required>
          <ScanInput value={f.registerNo} onChange={set('registerNo')} length={10} scanTitle="WiFi dongle" placeholder="Type or scan the dongle label" />
        </Field>
        <Field label="Owner's e-mail (optional)">
          <Input value={f.ownerEmail} onChangeText={set('ownerEmail')} placeholder="So Voltra can share it with the owner"
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
        </Field>
        {!!state?.err && <Note error>{state.err}</Note>}
        <Button title={state?.busy ? 'Creating…' : 'Create Plant'} busy={state?.busy} onPress={submit} />
      </Card>
    </Page>
  );
}
