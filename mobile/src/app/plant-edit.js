import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { api, useApi } from '../lib/api';
import { useSession } from '../lib/session';
import { Button, Card, Empty, Field, Input, Note, Page, s } from '../components/ui';

// Edit Plant (SolaX ⋯ menu; web EditPlant in src/screens/PlantEdit.jsx): name, address, capacities, location.
// Saved by Voltra and shown everywhere in the app.
const FIELDS = [
  ['plantName', 'Plant name', 'text', true],
  ['plantAddress', 'Address', 'text'],
  ['pvCapacity', 'PV capacity (kWp)', 'number'],
  ['batteryCapacity', 'Battery capacity (kWh)', 'number'],
  ['installDate', 'Installation date', 'date'],
  ['contactPhone', 'Contact phone', 'tel'],
  ['latitude', 'Latitude (for weather)', 'number'],
  ['longitude', 'Longitude (for weather)', 'number'],
];
const KEYBOARD = { number: 'decimal-pad', tel: 'phone-pad', date: 'numbers-and-punctuation' };

export default function EditPlant() {
  const { plant, reloadPlants } = useSession();
  const res = useApi(`/api/plants/${plant.plantId}/info`);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!res.data || f) return;
    const pick = (k) => res.data.info?.[k] ?? plant[k] ?? '';
    setF(Object.fromEntries(FIELDS.map(([k]) => [k, String(pick(k))])));
  }, [res.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!f.plantName.trim()) return setMsg({ err: true, text: 'Plant name is required.' });
    setBusy(true); setMsg(null);
    try {
      await api(`/api/plants/${plant.plantId}/info`, { method: 'POST', body: f });
      setMsg({ text: 'Saved.' });
      await reloadPlants();
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 600);
    } catch (e) {
      setMsg({ err: true, text: e.message || 'Could not save.' });
    } finally { setBusy(false); }
  }

  return (
    <Page title="Edit Plant" subtitle={plant.plantName}>
      {!res.data ? <Empty error={!!res.error}>{res.error ? res.error.message : 'Loading…'}</Empty> : !res.data.canEdit ? (
        <Note>Only the owner of this system, their installer or Voltra can edit it.</Note>
      ) : f && (
        <Card>
          {FIELDS.map(([k, label, type, req]) => (
            <Field key={k} label={label} required={req} hint={type === 'date' ? 'YYYY-MM-DD' : undefined}>
              <Input value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} keyboardType={KEYBOARD[type] || 'default'}
                autoCapitalize={type === 'text' ? 'sentences' : 'none'} placeholder={type === 'date' ? 'YYYY-MM-DD' : undefined} />
            </Field>
          ))}
          <Text style={s.small}>Plant ID {plant.plantId} · time zone {plant.plantTimeZone?.replace(/\).*/, ')') || '--'}. These details are kept by Voltra; SolaX Cloud keeps its own copy.</Text>
          {msg && <Note ok={!msg.err} error={msg.err}>{msg.text}</Note>}
          <Button title={busy ? 'Saving…' : 'Save'} busy={busy} onPress={save} />
        </Card>
      )}
    </Page>
  );
}
