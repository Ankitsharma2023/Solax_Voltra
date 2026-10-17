import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { API_URL, storage } from '../lib/api';
import { useSession } from '../lib/session';
import { clearSettingsCache } from '../lib/settings';
import { Page, Card, Field, Input, Segmented, Button, Note, List, ListRow } from '../components/ui';
import { savePrefs } from '../components/me/common';

// Which Home energy-flow view opens first (same key as the web app's localStorage "voltra.flowPage").
const FLOW_PAGE_KEY = 'voltra.flowPage';

// General Settings (web: GeneralSettings in Me.jsx).
export default function GeneralSettings() {
  const { user, reloadUser, reloadPlants } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [nameMsg, setNameMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState(0);
  const [cacheMsg, setCacheMsg] = useState(null);
  useEffect(() => { storage.get(FLOW_PAGE_KEY).then((v) => setFlow(Number(v) || 0)); }, []);
  const pickFlow = (p) => { setFlow(p); storage.set(FLOW_PAGE_KEY, String(p)); };

  async function saveName() {
    setBusy(true); setNameMsg(null);
    const ok = await savePrefs({ name });
    setBusy(false);
    setNameMsg(ok ? { text: 'Saved.' } : { err: true, text: 'Could not save.' });
    if (ok) reloadUser();
  }
  async function clearCache() {
    clearSettingsCache();
    setCacheMsg('Cleared. Loading fresh data…');
    await Promise.all([reloadUser(), reloadPlants()]);
    setCacheMsg('Cleared. The app now shows fresh data from the server.');
  }

  return (
    <Page title="General Settings">
      <Card title="Account">
        <Field label="Name"><Input value={name} maxLength={80} onChangeText={setName} /></Field>
        <Field label="E-mail (login)"><Input value={user?.login ?? ''} editable={false} style={{ opacity: 0.6 }} /></Field>
        <Button ghost title="Save name" busy={busy} onPress={saveName} />
        {nameMsg && <Note ok={!nameMsg.err} error={nameMsg.err}>{nameMsg.text}</Note>}
      </Card>
      <List>
        <ListRow title="Change password" onPress={() => router.push('/change-password')} last />
      </List>
      <Card title="Home screen energy flow">
        <Segmented options={[[0, 'House picture'], [1, 'Diagram']]} value={flow} onChange={pickFlow} />
        <Note>You can also swipe between them on the Home screen.</Note>
      </Card>
      <Card title="Storage">
        <Note>If the app looks out of date, clear its saved data and load the newest from the server.</Note>
        <Button ghost title="Clear cache" onPress={clearCache} />
        {cacheMsg && <Note ok>{cacheMsg}</Note>}
      </Card>
      <List>
        <ListRow title="Privacy Policy" onPress={() => Linking.openURL(`${API_URL}/privacy.html`)} />
        <ListRow title="User Terms" onPress={() => Linking.openURL(`${API_URL}/terms.html`)} last={user?.role === 'admin'} />
        {user?.role !== 'admin' && <ListRow title="Delete account" danger onPress={() => router.push('/delete-account')} last />}
      </List>
      <View style={{ height: 8 }} />
    </Page>
  );
}
