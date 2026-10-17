import { useState } from 'react';
import { Text } from 'react-native';
import { Card, Page, s as ui } from '../../components/ui';
import { SendBar, Slider, SwitchRow } from '../../components/control/Form';
import { useApi } from '../../lib/api';
import { useCaps } from '../../lib/control';
import { useSession } from '../../lib/session';

// Export Limit (web ExportLimit in src/screens/Control.jsx).
export default function ExportLimit() {
  const { plant } = useSession();
  const caps = useCaps(plant.plantId).data;
  const ov = useApi(`/api/plants/${plant.plantId}/overview`);
  const rated = ov.data?.devices?.[0]?.ratedPower ?? 10;
  const [f, setF] = useState({ isEnable: 1, limitValue: 0 });
  return (
    <Page title="Export Limit" subtitle={plant.plantName}>
      <Card>
        <Text style={[ui.muted, { marginBottom: 8, lineHeight: 19 }]}>Limits how much power the system sends to the grid. Set 0 kW for <Text style={{ fontWeight: '700' }}>zero export</Text> (often required by the electricity board).</Text>
        <SwitchRow label="Export limit" bold value={!!f.isEnable} onChange={(v) => setF({ ...f, isEnable: v ? 1 : 0 })} />
        {!!f.isEnable && (
          <Slider label="Maximum export" value={f.limitValue} min={0} max={rated} step={0.1} unit="kW" digits={1}
            onChange={(v) => setF({ ...f, limitValue: v })} hint={`0 – ${rated} kW (inverter rating)`} />
        )}
      </Card>
      <SendBar plant={plant} op="export_limit" params={f} caps={caps}
        confirmText={f.isEnable ? `Limit export to the grid at ${plant.plantName} to ${f.limitValue} kW?` : `Turn OFF the export limit at ${plant.plantName}?`} />
    </Page>
  );
}
