import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, List, ListRow, Note, Page, Segmented, s as ui } from '../../components/ui';
import UnlockDialog from '../../components/control/UnlockDialog';
import { setUnlockLevel, useUnlockLevel } from '../../lib/control';
import { useSession } from '../../lib/session';
import { C } from '../../theme';

// Remote Settings → More → Settings (web SettingsLevels in src/screens/RemoteSettings.jsx). Rows the SolaX cloud
// API can change open a working editor; the rest need the installer on site and open a service request instead.
const PAGES = { workmode: '/control/work-mode', export: '/control/export-limit', heating: '/control/battery-heating', remote: '/control/remote-control' };
const BASIC = [
  { title: 'Work Mode', sub: 'Self Use · Feed-in Priority · Back Up · Manual', page: 'workmode' },
  { title: 'Self Use', sub: 'Min SOC, charge battery to, charge from grid', page: 'workmode' },
  { title: 'Feed-in Priority', sub: 'Min SOC, charge battery to', page: 'workmode' },
  { title: 'Back Up', sub: 'Min SOC kept for power cuts', page: 'workmode' },
  { title: 'Charge & Discharge Period', sub: 'Period 1 and period 2', page: 'workmode' },
  { title: 'Export Control (user value)', sub: 'Zero export or a maximum in kW', page: 'export' },
  { title: 'Battery Heating', sub: 'Heating on/off, level, two periods', page: 'heating' },
  { title: 'EPS Setting', sub: 'Backup output: mute, frequency, min SOC', site: 'Changes the backup (EPS) output behaviour: alarm mute, 50/60 Hz and the battery level kept for backup.' },
  { title: 'Date & Time', sub: 'Inverter clock', site: 'The inverter normally takes its time from SolaX Cloud automatically. A wrong clock is corrected on site.' },
];
const ADVANCED = [
  { title: 'Export Control (installer)', sub: 'Meter/CT based export limit', page: 'export' },
  { title: 'Remote Control (VPP)', sub: 'Force charge / discharge / idle for a set time', page: 'remote' },
  { title: 'Manual Mode', sub: 'Force charge, force discharge, stop', page: 'workmode' },
  { title: 'Safety Code', sub: 'Grid standard / country', site: 'Sets the grid standard the inverter follows. It is locked to the installer for safety and grid-code compliance.' },
  { title: 'Grid Protection', sub: 'Voltage and frequency limits', site: 'Over/under voltage and frequency trip limits required by the electricity board.' },
  { title: 'Meter / CT Setting', sub: 'Meter type, CT direction', site: 'Configures the energy meter or CT that measures import/export.' },
  { title: 'Battery Setting', sub: 'Battery type, max charge/discharge current', site: 'Battery brand/type and charge/discharge current limits.' },
  { title: 'Peak Shaving', sub: 'Limit grid import peaks', site: 'Uses the battery to cap peaks of grid import. SolaX does not offer it through its cloud API.' },
  { title: 'Shadow Fix (GMPPT)', sub: 'Shaded panel tracking', site: 'Global MPPT scan for partly shaded strings.' },
  { title: 'Power Factor / Reactive Power', sub: 'PF mode and Q(U)', site: 'Reactive power control required by some grid operators.' },
  { title: 'Parallel Setting', sub: 'Several inverters together', site: 'Master/slave setup for inverters working in parallel.' },
  { title: 'DRM Function', sub: 'Demand response modes', site: 'Demand response (DRM) input used in some regions.' },
  { title: 'Pgrid Bias', sub: 'Grid power offset', site: 'Small offset so the system imports or exports slightly instead of exactly zero.' },
  { title: 'Reset', sub: 'Errors, energy counters, meter, factory', site: 'Clears error logs, energy counters or returns the inverter to factory settings.' },
];

export default function SettingsLevels() {
  const { plant } = useSession();
  const level = useUnlockLevel(plant.plantId);
  const [tab, setTab] = useState('basic');
  const [asking, setAsking] = useState(false);
  const list = tab === 'basic' ? BASIC : ADVANCED;
  const open = (it) => (it.page
    ? router.push(PAGES[it.page])
    : router.push({ pathname: '/service-request', params: { kind: 'service', setting: it.title, note: `Setting: ${it.title}. `, about: it.site } }));

  return (
    <Page title="Settings" subtitle={plant.plantName}>
      <UnlockDialog visible={asking} plantId={plant.plantId} advanced onCancel={() => setAsking(false)}
        onUnlocked={(lv) => { setUnlockLevel(plant.plantId, lv); setAsking(false); }} />
      <Segmented options={[['basic', 'Basic'], ['advanced', 'Advanced']]} value={tab} onChange={setTab} />
      {!level ? (
        <Card>
          <Text style={ui.muted}>Enter the inverter password on Remote Settings to see these settings.</Text>
          <Button title="Back to Remote Settings" onPress={() => router.back()} />
        </Card>
      ) : tab === 'advanced' && level !== 'advanced' ? (
        <Card>
          <Text style={ui.text}>🔒 Advanced settings change how the inverter works with the grid. They need the installer password.</Text>
          <Button title="Enter installer password" onPress={() => setAsking(true)} />
        </Card>
      ) : (
        <List>
          {list.map((it, i) => (
            it.site ? (
              <Pressable key={it.title} onPress={() => open(it)} style={({ pressed }) => [ui.row, i < list.length - 1 && ui.rowLine, pressed && { backgroundColor: C.soft }]}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{it.title}</Text>
                  <Text style={ui.muted} numberOfLines={2}>{it.sub}</Text>
                </View>
                <Text style={st.site}>On site</Text>
              </Pressable>
            ) : <ListRow key={it.title} title={it.title} sub={it.sub} last={i === list.length - 1} onPress={() => open(it)} />
          ))}
        </List>
      )}
      <Note>Rows marked <Text style={{ fontWeight: '700' }}>On site</Text> can't be changed through SolaX Cloud. Voltra changes them at the inverter; tap one to send a request.</Note>
    </Page>
  );
}

const st = StyleSheet.create({
  site: { fontSize: 12, fontWeight: '600', color: C.accentDark, backgroundColor: C.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
});
