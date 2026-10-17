import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, useApi } from '../lib/api';
import { useSession } from '../lib/session';
import { buildCards, SERVICE, SUPPORT_PHONE, telHref } from '../lib/devices';
import { Button, Card, Empty, Field, Input, Note, Page, s as ui } from '../components/ui';
import { C } from '../theme';

// Device Replacement / Reconfigure / Local Access: done on site by Voltra; the app sends the request
// (web ServiceRequest in Device.jsx). ?kind=replacement|reconfigure|local_access&sn=…
// Without an sn (Service → Local Access) it goes through the plant's dongle, or its inverter if there is none.
export default function ServiceRequest() {
  const { kind, sn, setting, about } = useLocalSearchParams();
  const { plant } = useSession();
  // kind=service: a Remote Settings row SolaX's API can't change ("On site", web RemoteSettings OnSite).
  const svc = kind === 'service'
    ? { kind: 'service', title: setting || 'On-site change', button: 'Ask Voltra to change it', prefix: `Setting: ${setting}. `, label: 'What should it be set to? (optional)',
      intro: `${about ? `${about}\n\n` : ''}SolaX only lets outside apps change work mode, export limit, battery heating and remote control. This setting is changed by Voltra at the inverter (screen or Bluetooth).`, steps: [] }
    : SERVICE[kind] || SERVICE.replacement;
  const ov = useApi(sn ? null : `/api/plants/${plant.plantId}/overview`);
  const cards = ov.data ? buildCards(ov.data) : [];
  const deviceSn = sn || (cards.find((c) => c.kind === 'dongle') || cards.find((c) => c.kind === 'inverter'))?.sn;

  if (!deviceSn) {
    return <Page title={svc.title}><Empty error={!!ov.error}>{ov.error ? ov.error.message : ov.data ? 'No device on this plant.' : 'Loading…'}</Empty></Page>;
  }
  return <RequestForm plantId={plant.plantId} deviceSn={deviceSn} {...svc} />;
}

function RequestForm({ plantId, deviceSn, kind, title, button, intro, steps, prefix = '', label = 'Details (optional)' }) {
  const [note, setNote] = useState('');
  const [state, setState] = useState(null);
  async function send() {
    setState('busy');
    try {
      await api(`/api/plants/${plantId}/service-request`, { method: 'POST', body: { kind, deviceSn, note: prefix + note } });
      setState('sent');
    } catch { setState('error'); }
  }
  return (
    <Page title={title} subtitle={`SN: ${deviceSn}`}>
      <Card>
        <Text style={[ui.text, { lineHeight: 21 }]}>{intro}</Text>
        <View style={{ marginTop: 10, gap: 6 }}>
          {steps.map((x, i) => (
            <View key={x} style={st.step}><Text style={st.num}>{i + 1}.</Text><Text style={[ui.text, { flex: 1, lineHeight: 21 }]}>{x}</Text></View>
          ))}
        </View>
      </Card>
      {state === 'sent' ? (
        <Card>
          <Note ok>Request sent. Voltra will contact you shortly.</Note>
          <Button title="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </Card>
      ) : (
        <Card>
          <Field label={label}>
            <Input multiline numberOfLines={3} maxLength={1000} value={note} onChangeText={setNote}
              placeholder="Anything that helps us, e.g. error code or new WiFi name" />
          </Field>
          {state === 'error' && <Note error>Could not send. Please try again or call Voltra.</Note>}
          <Button title={state === 'busy' ? 'Sending…' : button} busy={state === 'busy'} onPress={send} />
          <Button title={`Call Voltra · ${SUPPORT_PHONE}`} ghost onPress={() => Linking.openURL(telHref(SUPPORT_PHONE))} />
        </Card>
      )}
    </Page>
  );
}

const st = StyleSheet.create({
  step: { flexDirection: 'row', gap: 6 },
  num: { color: C.muted, fontSize: 15, width: 18 },
});
