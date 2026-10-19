import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApi } from '../../lib/api';
import { fmt } from '../../lib/format';
import { useSession } from '../../lib/session';
import { BATTERY_TYPE, CURVE_FIELDS, inverterPower, useDeviceCards } from '../../lib/devices';
import { Card, Empty, Input, Loading, Page, Segmented, s as ui } from '../../components/ui';
import { LineChart, toPoints } from '../../components/Charts';
import { DataSections, DeviceArt, FnHeat, FnLock, FnMode, FnPhone, FnRemote, FnSwap, FnWifi, Live, PencilIcon } from '../../components/device/DeviceParts';
import StatsPanel from '../../components/device/StatsPanel';
import { C, card as cardStyle } from '../../theme';
import { CopyText } from '../../components/Pickers';

// Device detail — web DeviceDetail (src/screens/Device.jsx). The card is found again by `key` in fresh overview data.
export default function DeviceDetail() {
  const { key } = useLocalSearchParams();
  const { plant } = useSession();
  const [view, setView] = useState('data');
  // Keep the numbers fresh while the page is open (the cloud updates every few minutes).
  const { overview, cards, names, saveNames } = useDeviceCards(plant.plantId);
  const card = cards?.find((c) => c.key === key);

  if (!card) {
    return (
      <Page title="Device">
        {overview.error ? <Empty error>{overview.error.message}</Empty> : cards ? <Empty>This device is no longer on this plant.</Empty> : <Loading height={300} />}
      </Page>
    );
  }

  const l = card.live || {}, d = card.device || {};
  const updated = l.plantLocalTime || overview.data?.inverters?.[0]?.plantLocalTime;

  const realtime = {
    inverter: [['Realtime Power', fmt(inverterPower(l), 0), 'W'], ['Total Produced Today', fmt(l.dailyACOutput ?? l.dailyYield), 'kWh']],
    battery: [[(l.chargeDischargePower ?? 0) >= 0 ? 'Charging Power' : 'Discharging Power', fmt(Math.abs(l.chargeDischargePower ?? 0), 0), 'W'], ['SOC', fmt(l.batterySOC, 0), '%']],
    dongle: null,
  }[card.kind];

  const service = (kind) => () => router.push({ pathname: '/service-request', params: { kind, sn: card.sn } });
  const go = (path) => () => router.push(path);
  const F = (title, Icon, onPress) => ({ title, Icon, onPress });
  const functions = {
    inverter: [F('Remote Settings', FnRemote, () => router.push({ pathname: '/control/remote-settings', params: { sn: card.sn } })), F('Work Mode', FnMode, go('/control/work-mode')),
      F('Device Replacement', FnSwap, service('replacement')), F('Backup Password', FnLock, go('/backup-password'))],
    dongle: [F('Reconfigure', FnWifi, service('reconfigure')), F('Local Access', FnPhone, service('local_access')),
      F('Backup Password', FnLock, go('/backup-password')), F('Device Replacement', FnSwap, service('replacement'))],
    battery: [F('Battery Heating', FnHeat, go('/control/battery-heating')), F('Device Replacement', FnSwap, service('replacement'))],
  }[card.kind];

  const info = {
    inverter: [['Device Model', card.model], ['Registration no.', d.registerNo, true], ['Rated Power', d.ratedPower != null ? `${d.ratedPower} kW` : null], ['Firmware ARM', d.armVersion], ['Firmware DSP', d.dspVersion]],
    dongle: [['Associated SN', d.deviceSn, true], ['Device Model', card.model], ['Registration no.', d.registerNo, true]],
    battery: [['Battery Type', BATTERY_TYPE[card.info?.batteryType] ?? null], ['Rated Capacity', card.info?.ratedCapacity != null ? `${card.info.ratedCapacity} kWh` : null], ['Hardware Version', card.info?.hardwareVersion], ['Software Version', card.info?.softwareVersion], ['Connected Inverter', d.deviceSn, true]],
  }[card.kind];

  return (
    <Page title={card.name} subtitle={`SN: ${card.sn}`} onRefresh={overview.reload}>
      <View style={[cardStyle, st.hero]}>
        <View style={{ flex: 1 }}><Text style={ui.small}>SN</Text><CopyText value={card.sn} style={st.sn} /></View>
        <DeviceArt kind={card.kind} />
      </View>

      <Card title="Realtime Data">
        {realtime && (
          <View style={[ui.tiles, { marginBottom: 8 }]}>
            {realtime.map(([label, v, unit]) => (
              <View key={label} style={ui.tile}>
                <Text style={ui.muted}>{label}</Text>
                <Text><Live value={v} style={st.big} /><Text style={ui.small}> {unit}</Text></Text>
              </View>
            ))}
          </View>
        )}
        <View style={[ui.kv, ui.rowLine]}><Text style={ui.kvKey}>Working Status</Text><Text style={[ui.kvVal, { color: card.online ? C.accentDark : C.muted }]}>{card.online ? 'Online' : 'Offline'}</Text></View>
        <View style={ui.kv}><Text style={ui.kvKey}>Update Time</Text><Text style={ui.kvVal}>{updated || '--'}</Text></View>
      </Card>

      <Card title="Function Control">
        <View style={st.fnGrid}>
          {functions.map(({ title, Icon, onPress }) => (
            <Pressable key={title} onPress={onPress} style={({ pressed }) => [st.fn, pressed && { backgroundColor: C.soft }]}>
              <View style={st.fnIcon}><Icon /></View>
              <Text style={st.fnText}>{title}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {card.kind !== 'dongle' && (
        <>
          <Segmented value={view} onChange={setView}
            options={card.kind === 'inverter' ? [['data', 'Overview'], ['stats', 'Statistics'], ['curve', 'Curve']] : [['data', 'Overview'], ['curve', 'Curve']]} />
          {view === 'curve' ? <Curve plant={plant} card={card} />
            : view === 'stats' ? <Card><StatsPanel plant={plant} /></Card>
            : <DataSections card={card} plant={plant} />}
        </>
      )}

      <DeviceInfo card={card} rows={info} onRename={(name) => saveNames({ ...(names || {}), [card.nameKey || card.sn]: name || undefined })} />
    </Page>
  );
}

// Device Name (editable, like SolaX's pencil), serial numbers (tap to copy), model and firmware.
function DeviceInfo({ card, rows, onRename }) {
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState(null);
  const save = async () => {
    setError(null);
    try { await onRename(edit.trim().slice(0, 40)); setEdit(null); } catch (e) { setError(e.message); }
  };
  const shown = rows.filter(([, v]) => v != null && v !== '');
  return (
    <Card>
      <View style={[ui.kv, shown.length > 0 && ui.rowLine, { alignItems: 'center' }]}>
        <Text style={ui.kvKey}>Device Name</Text>
        {edit != null ? (
          <View style={st.inlineEdit}>
            <Input value={edit} maxLength={40} autoFocus onChangeText={setEdit} onSubmitEditing={save} returnKeyType="done"
              accessibilityLabel="Device name" style={st.nameInput} />
            <Pressable onPress={save} hitSlop={8}><Text style={st.textBtn}>Save</Text></Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setEdit(card.name)} hitSlop={8} style={st.valueBtn}>
            <Text style={ui.kvVal}>{card.name}</Text><PencilIcon />
          </Pressable>
        )}
      </View>
      {shown.map(([k, v, canCopy], i) => (
        <View key={k} style={[ui.kv, i < shown.length - 1 && ui.rowLine]}>
          <Text style={ui.kvKey}>{k}</Text>
          {canCopy ? <CopyText value={v} style={[ui.kvVal, { color: C.accentDark }]} /> : <Text style={ui.kvVal} selectable>{String(v)}</Text>}
        </View>
      ))}
      {!!error && <Text style={[ui.small, { color: C.bad }]}>{error}</Text>}
    </Card>
  );
}

function Curve({ plant, card }) {
  const fields = CURVE_FIELDS[card.kind];
  const [field, setField] = useState(fields[0][0]);
  const sn = card.kind === 'battery' ? card.device?.deviceSn : card.sn;
  const res = useApi(`/api/plants/${plant.plantId}/devices/${sn}/history?type=${card.kind === 'battery' ? 2 : 1}`);
  const pts = useMemo(() => toPoints(res.data?.rows, (r) => r[field]), [res.data, field]);
  return (
    <Card>
      <Text style={ui.fieldLabel}>Data point</Text>
      <View style={st.chips}>
        {fields.map(([k, label]) => (
          <Pressable key={k} onPress={() => setField(k)} style={[st.chip, field === k && st.chipOn]}>
            <Text style={[st.chipText, field === k && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {res.error && !res.data ? <Empty error>{res.error.message}</Empty>
        : !res.data ? <Empty>Loading…</Empty> : <LineChart pts={pts} label={fields.find((f) => f[0] === field)[1]} />}
    </Card>
  );
}

const st = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f2fbf9' },
  sn: { fontSize: 18, fontWeight: '700', color: C.ink, marginTop: 2 },
  big: { fontSize: 22, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  fnGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  fn: { width: '25%', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 2, borderRadius: 12 },
  fnIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  fnText: { fontSize: 12, color: C.muted, textAlign: 'center' },
  inlineEdit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'flex-end' },
  nameInput: { flex: 1, paddingVertical: 6, paddingHorizontal: 10, fontSize: 14 },
  textBtn: { color: C.accentDark, fontWeight: '600', fontSize: 14 },
  valueBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: C.soft },
  chipOn: { backgroundColor: C.accent },
  chipText: { fontSize: 12, color: C.ink },
});
