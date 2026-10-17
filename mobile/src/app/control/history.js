import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Card, Empty, Note, Page, s as ui } from '../../components/ui';
import { ToneBadge } from '../../components/control/Form';
import { useApi } from '../../lib/api';
import { useSession } from '../../lib/session';
import { C } from '../../theme';

// Command History (web History in src/screens/Control.jsx).
const STATUS_TONE = { 0: 'offline', 1: 'offline', 2: 'alarm', 3: 'pending', 4: 'normal', 5: 'alarm', 6: 'alarm' };

export default function History() {
  const { plant } = useSession();
  const log = useApi(`/api/plants/${plant.plantId}/control/log`);
  const pending = (log.data ?? []).some((e) => e.status === 3);
  useEffect(() => { if (!pending) return undefined; const t = setInterval(log.reload, 10_000); return () => clearInterval(t); }, [pending, log.reload]);
  return (
    <Page title="Command History" subtitle={plant.plantName} onRefresh={log.reload}>
      {log.error ? <Empty error>{log.error.message}</Empty>
        : !log.data ? <Empty>Loading…</Empty>
        : !log.data.length ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={ui.rowTitle}>No commands yet</Text>
            <Text style={[ui.muted, { textAlign: 'center' }]}>Changes sent to the inverter appear here with their result.</Text>
          </Card>
        ) : log.data.map((e) => (
          <Card key={e.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={[ui.rowTitle, { flex: 1 }]}>{e.label}</Text>
              <ToneBadge tone={STATUS_TONE[e.status] ?? 'offline'}>{e.statusText}</ToneBadge>
            </View>
            <Text style={ui.small}>{new Date(e.at).toLocaleString()} · {e.by}</Text>
            <Text style={[ui.small, { color: C.ink2, marginTop: 4 }]}>{summarize(e.params)}</Text>
            {!!e.error && <Text style={[ui.small, { color: C.bad, marginTop: 4 }]}>{e.error}</Text>}
          </Card>
        ))}
      {pending && <Note>Waiting for the inverter… this page refreshes every 10 s.</Note>}
    </Page>
  );
}

function summarize(p = {}) {
  const names = { minSoc: 'min SOC', chargeUpperSoc: 'charge to', chargeFromGridEnable: 'grid charging', isEnable: 'enabled', limitValue: 'limit kW',
    timeOfDuration: 'seconds', nextMotion: 'then', batteryPower: 'battery W', targetSoc: 'target %', chargeDischargPower: 'power W', heatingEnable: 'heating', heatingLevel: 'level', manualMode: 'manual', power: 'kW' };
  return Object.entries(p || {}).filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${names[k] || k}: ${k === 'nextMotion' ? (v === 160 ? 'exit' : 'self-consume') : typeof v === 'number' && /Enable$/.test(k) ? (v ? 'on' : 'off') : v}`).join(' · ');
}
