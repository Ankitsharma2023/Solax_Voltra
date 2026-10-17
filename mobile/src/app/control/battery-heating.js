import { useState } from 'react';
import { Text } from 'react-native';
import { Card, Page, s as ui } from '../../components/ui';
import { Choice, SendBar, SwitchRow, TimeField, TimeGrid } from '../../components/control/Form';
import { useCaps, validTime } from '../../lib/control';
import { useSession } from '../../lib/session';

// Battery Heating (web BatteryHeating in src/screens/Control.jsx).
export default function BatteryHeating() {
  const { plant } = useSession();
  const caps = useCaps(plant.plantId).data;
  const [f, setF] = useState({ heatingEnable: 0, heatingLevel: 1, heatingPeriod1StartTime: '02:00', heatingPeriod1EndTime: '06:00', heatingPeriod2StartTime: '', heatingPeriod2EndTime: '' });
  const t = (k, label, optional) => <TimeField label={label} optional={optional} value={f[k]} onChange={(v) => setF((o) => ({ ...o, [k]: v }))} />;
  const bad = !!f.heatingEnable && (!validTime(f.heatingPeriod1StartTime) || !validTime(f.heatingPeriod1EndTime)
    || !validTime(f.heatingPeriod2StartTime, true) || !validTime(f.heatingPeriod2EndTime, true));
  return (
    <Page title="Battery Heating" subtitle={plant.plantName}>
      <Card>
        <Text style={[ui.muted, { marginBottom: 8 }]}>Warms the battery in cold weather so it can charge. Rarely needed in India.</Text>
        <SwitchRow label="Battery heating" bold value={!!f.heatingEnable} onChange={(v) => setF({ ...f, heatingEnable: v ? 1 : 0 })} />
        {!!f.heatingEnable && <>
          <Choice label="Heating level" value={f.heatingLevel} onChange={(v) => setF({ ...f, heatingLevel: v })}
            options={[[0, 'Low'], [1, 'Medium'], [2, 'High']]} />
          <TimeGrid>
            {t('heatingPeriod1StartTime', 'Period 1 from')}{t('heatingPeriod1EndTime', 'to')}
            {t('heatingPeriod2StartTime', 'Period 2 from (optional)', true)}{t('heatingPeriod2EndTime', 'to', true)}
          </TimeGrid>
        </>}
      </Card>
      <SendBar plant={plant} op="battery_heating" params={f} caps={caps} disabled={bad}
        confirmText={`Turn battery heating ${f.heatingEnable ? 'ON' : 'OFF'} at ${plant.plantName}?`} />
    </Page>
  );
}
