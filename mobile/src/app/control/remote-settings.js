import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, List, ListRow, Note, Page, SectionTitle, s as ui } from '../../components/ui';
import { ChevronIcon } from '../../components/Icons';
import { LockIcon } from '../../components/control/icons';
import { RadioCard, SendBar } from '../../components/control/Form';
import UnlockDialog from '../../components/control/UnlockDialog';
import { useApi } from '../../lib/api';
import { setUnlockLevel, useCaps, useUnlockLevel } from '../../lib/control';
import { usePlantSetting } from '../../lib/settings';
import { useSession } from '../../lib/session';
import { C } from '../../theme';

// Remote Settings, laid out like the SolaX app (web src/screens/RemoteSettings.jsx): "Unlock Password" first,
// then Settings (Work Mode, Smart Settings) and More → Settings with Basic / Advanced.
// Open with router.push({ pathname: '/control/remote-settings', params: { sn } }); without sn it uses the first inverter.
export default function RemoteSettings() {
  const { plant } = useSession();
  const { sn: snParam } = useLocalSearchParams();
  const caps = useCaps(plant.plantId).data;
  const ov = useApi(snParam ? null : `/api/plants/${plant.plantId}/overview`);
  const sn = snParam || ov.data?.devices?.[0]?.deviceSn;
  const level = useUnlockLevel(plant.plantId);
  const [asking, setAsking] = useState(true);
  const [open, setOpen] = useState(null);

  // Ask for the password again every time this screen is opened (as on the web).
  useEffect(() => { setUnlockLevel(plant.plantId, null); }, [plant.plantId]);

  const unlocked = (lv) => { setUnlockLevel(plant.plantId, lv); setAsking(false); };
  const cancel = () => { setAsking(false); if (!level) router.back(); };

  return (
    <Page title="Remote Settings" subtitle={plant.plantName}>
      <UnlockDialog visible={asking} plantId={plant.plantId} advanced={!!level} onCancel={cancel} onUnlocked={unlocked} />
      <Card>
        <Text style={ui.small}>SN</Text>
        <Text style={st.sn} selectable>{sn || '--'}</Text>
      </Card>
      {!level ? (
        <Card>
          <Text style={ui.muted}>Enter the inverter password to see its settings.</Text>
          <Button title="Unlock" onPress={() => setAsking(true)} />
        </Card>
      ) : <>
        <SectionTitle>Settings</SectionTitle>
        <List>
          <Expand title="Work Mode" open={open === 'mode'} onToggle={() => setOpen(open === 'mode' ? null : 'mode')}>
            <QuickWorkMode plant={plant} caps={caps} />
          </Expand>
          <Expand title="Smart Settings" open={open === 'smart'} onToggle={() => setOpen(open === 'smart' ? null : 'smart')} last>
            <View style={st.nested}>
              <ListRow title="Battery Heating" sub="Warm the battery in cold weather" onPress={() => router.push('/control/battery-heating')} />
              {level === 'advanced'
                ? <ListRow title="Export Limit" sub="Maximum power sent to the grid" onPress={() => router.push('/control/export-limit')} last />
                : <ListRow title="Export Limit" sub="Needs the installer password" right={<LockIcon size={20} color={C.muted} />} last />}
            </View>
          </Expand>
        </List>
        <SectionTitle>More</SectionTitle>
        <List>
          <ListRow title="Settings" sub="Basic · Advanced" onPress={() => router.push('/control/settings')} />
          <ListRow title="Command History" sub="Every change sent to this inverter" onPress={() => router.push('/control/history')} last />
        </List>
        <Note>{level === 'advanced' ? 'Unlocked: basic and advanced settings.' : 'Unlocked: basic settings. Advanced settings need the installer password.'}</Note>
      </>}
    </Page>
  );
}

function Expand({ title, open, onToggle, children, last }) {
  return (
    <View style={!last && ui.rowLine}>
      <Pressable onPress={onToggle} accessibilityState={{ expanded: open }} style={({ pressed }) => [ui.row, pressed && { backgroundColor: C.soft }]}>
        <Text style={[ui.rowTitle, { flex: 1 }]}>{title}</Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><ChevronIcon size={20} color={C.muted} /></View>
      </Pressable>
      {open && <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>{children}</View>}
    </View>
  );
}

const QUICK_MODES = [
  { id: 'self_use', name: 'Self Use' }, { id: 'feed_in', name: 'Feed-in Priority' }, { id: 'backup', name: 'Back Up' },
];

// Pick a mode and send it with the battery limits saved for this plant (edited under Settings → Basic).
function QuickWorkMode({ plant, caps }) {
  const [stored, store] = usePlantSetting(plant.plantId, 'workmode', null);
  const s = { minSoc: 10, chargeUpperSoc: 100, chargeFromGridEnable: 0, chargeStartTimePeriod1: '00:00', chargeEndTimePeriod1: '00:00',
    dischargeStartTimePeriod1: '00:00', dischargeEndTimePeriod1: '23:59', ...(stored || {}) };
  const [mode, setMode] = useState(QUICK_MODES.some((m) => m.id === stored?.mode) ? stored.mode : 'self_use');
  const params = { minSoc: s.minSoc, chargeUpperSoc: s.chargeUpperSoc, chargeFromGridEnable: s.chargeFromGridEnable,
    chargeStartTimePeriod1: s.chargeStartTimePeriod1, chargeEndTimePeriod1: s.chargeEndTimePeriod1,
    dischargeStartTimePeriod1: s.dischargeStartTimePeriod1, dischargeEndTimePeriod1: s.dischargeEndTimePeriod1 };
  const name = QUICK_MODES.find((m) => m.id === mode).name;
  return (
    <View>
      {QUICK_MODES.map((m) => <RadioCard key={m.id} title={m.name} on={mode === m.id} onPress={() => setMode(m.id)} />)}
      <Text style={ui.small}>Battery {s.minSoc}–{s.chargeUpperSoc}%{s.chargeFromGridEnable ? ', charging from grid allowed' : ''}. Change these under More → Settings → Basic.</Text>
      <SendBar plant={plant} op={mode} params={params} caps={caps} onSaved={() => store({ ...s, mode }).catch(() => {})}
        confirmText={`Change the inverter at ${plant.plantName} to ${name}?`} />
    </View>
  );
}

const st = StyleSheet.create({
  sn: { fontSize: 17, fontWeight: '700', color: C.ink, marginTop: 2 },
  nested: { borderRadius: 12, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
});
