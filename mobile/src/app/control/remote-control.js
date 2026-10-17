import { useState } from 'react';
import { Card, Note, Page } from '../../components/ui';
import { Choice, NumField, RadioCard, SendBar } from '../../components/control/Form';
import { useCaps } from '../../lib/control';
import { useSession } from '../../lib/session';

// Remote Control / VPP (web RemoteControl in src/screens/Control.jsx).
const RC_MODES = [
  { op: 'rc_self_consume', name: 'Self-consume', desc: 'Normal behaviour: battery charges from solar only and covers the home.' },
  { op: 'rc_zero', name: 'Battery idle', desc: 'Battery neither charges nor discharges; solar runs at full power.' },
  { op: 'rc_battery_power', name: 'Charge / discharge at set power', desc: 'Forces the battery to charge (+) or discharge (−) at a fixed power.' },
  { op: 'rc_soc_target', name: 'Battery to target %', desc: 'Charges or discharges until the battery reaches a target level.' },
];

export default function RemoteControl() {
  const { plant } = useSession();
  const caps = useCaps(plant.plantId).data;
  const [op, setOp] = useState('rc_self_consume');
  const [f, setF] = useState({ minutes: 30, then: 'exit', batteryPower: 1000, targetSoc: 80, power: 1000 });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const params = op === 'rc_soc_target' ? { targetSoc: f.targetSoc, power: f.power }
    : { durationS: f.minutes * 60, then: f.then, ...(op === 'rc_battery_power' && { batteryPower: f.batteryPower }) };
  const mode = RC_MODES.find((m) => m.op === op);
  const describe = op === 'rc_battery_power' ? `${f.batteryPower >= 0 ? 'charge' : 'discharge'} the battery at ${Math.abs(f.batteryPower)} W for ${f.minutes} min`
    : op === 'rc_soc_target' ? `move the battery to ${f.targetSoc}% at ${Math.abs(f.power)} W` : `switch to "${mode.name}" for ${f.minutes} min`;
  return (
    <Page title="Remote Control" subtitle={plant.plantName}>
      <Note>Temporary control for a set time. Afterwards the inverter returns to its normal work mode by itself.</Note>
      {RC_MODES.map((m) => <RadioCard key={m.op} title={m.name} desc={m.desc} on={op === m.op} onPress={() => setOp(m.op)} />)}
      <Card>
        {op === 'rc_battery_power' && (
          <NumField label="Battery power in W (+ charge, − discharge)" value={f.batteryPower} onChange={(v) => set('batteryPower', v)} />
        )}
        {op === 'rc_soc_target' ? <>
          <NumField label="Target battery level (%)" value={f.targetSoc} onChange={(v) => set('targetSoc', v)} />
          <NumField label="Power in W (+ charge, − discharge)" value={f.power} onChange={(v) => set('power', v)} />
        </> : <>
          <NumField label="Duration (minutes)" value={f.minutes} onChange={(v) => set('minutes', v)} />
          <Choice label="When the time is up" value={f.then} onChange={(v) => set('then', v)}
            options={[['exit', 'Exit remote control (back to normal work mode)'], ['self_consume', 'Stay in remote "Self-consume"']]} />
        </>}
      </Card>
      <SendBar plant={plant} op={op} params={params} caps={caps} label="Start" history={false} confirmText={`At ${plant.plantName}: ${describe}?`} />
      <SendBar plant={plant} op="rc_exit" params={{}} caps={caps} label="Stop remote control now" confirmText={`Stop remote control at ${plant.plantName} and return to the normal work mode?`} />
    </Page>
  );
}
