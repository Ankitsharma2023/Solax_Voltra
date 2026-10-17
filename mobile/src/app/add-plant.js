import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Field, Note, Page, s } from '../components/ui';
import { ScanInput } from '../components/ScanInput';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

// Add plant: link another system to the signed-in account using the numbers on the device labels
// (web app: src/screens/AddPlant.jsx).
export default function AddPlant() {
  const { reloadPlants } = useSession();
  const [f, setF] = useState({ inverterSn: '', registerNo: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setMsg(null);
    try {
      await api('/api/me/plants', { method: 'POST', body: f });
    } catch (e) {
      setBusy(false);
      return setMsg({ err: true, text: e.message || 'Could not add this system.' });
    }
    setMsg({ text: 'System added ✓' });
    await reloadPlants();
    setTimeout(() => { setBusy(false); if (router.canGoBack()) router.back(); else router.replace('/'); }, 900);
  }

  return (
    <Page title="Add plant">
      <Card>
        <Text style={[s.muted, { marginBottom: 14, lineHeight: 19 }]}>Enter the two numbers printed on the device labels. They prove you have access to this system.</Text>
        <Field label="Inverter SN">
          <ScanInput value={f.inverterSn} onChange={(v) => setF((x) => ({ ...x, inverterSn: v }))} length={14} scanTitle="inverter label" placeholder="14 characters, e.g. H34XXXXXXXXXXX" />
        </Field>
        <Field label="Registration No. (on the WiFi dongle)">
          <ScanInput value={f.registerNo} onChange={(v) => setF((x) => ({ ...x, registerNo: v }))} length={10} scanTitle="WiFi dongle" placeholder="10 characters, e.g. SXXXXXXXXX" />
        </Field>
        {msg && <Note ok={!msg.err} error={msg.err}>{msg.text}</Note>}
        <Button title={busy ? 'Checking…' : 'Add plant'} busy={busy} disabled={!f.inverterSn || !f.registerNo} onPress={submit} />
      </Card>
    </Page>
  );
}
