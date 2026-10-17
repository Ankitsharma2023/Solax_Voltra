import { useEffect, useState } from 'react';
import { Button, Card, Note, Page } from '../../components/ui';
import { Choice, NumField, RadioCard, SendBar, Slider, SwitchRow, TimeField, TimeGrid } from '../../components/control/Form';
import { MODES, useCaps, validTime } from '../../lib/control';
import { usePlantSetting } from '../../lib/settings';
import { useSession } from '../../lib/session';

const TIMES1 = ['chargeStartTimePeriod1', 'chargeEndTimePeriod1', 'dischargeStartTimePeriod1', 'dischargeEndTimePeriod1'];
const TIMES2 = ['chargeStartTimePeriod2', 'chargeEndTimePeriod2', 'dischargeStartTimePeriod2', 'dischargeEndTimePeriod2'];

// Work Mode (web WorkMode in src/screens/Intelligence.jsx). The draft is saved in plant setting "workmode".
export default function WorkMode() {
  const { plant } = useSession();
  const caps = useCaps(plant.plantId).data;
  const [stored, store, loadedWm] = usePlantSetting(plant.plantId, 'workmode', null);
  const [s, setS] = useState({
    mode: 'self_use', minSoc: 10, chargeUpperSoc: 100, chargeFromGridEnable: 0,
    chargeStartTimePeriod1: '00:00', chargeEndTimePeriod1: '00:00', dischargeStartTimePeriod1: '00:00', dischargeEndTimePeriod1: '23:59',
    enableTimePeriod2: 0, chargeStartTimePeriod2: '00:00', chargeEndTimePeriod2: '00:00', dischargeStartTimePeriod2: '00:00', dischargeEndTimePeriod2: '00:00',
    manualMode: 0, power: 1, targetSoc: '',
  });
  useEffect(() => { if (loadedWm && stored) setS((o) => ({ ...o, ...stored })); }, [loadedWm, stored]);
  const [saved, setSaved] = useState(null);
  const set = (k, v) => { setSaved(null); setS((o) => ({ ...o, [k]: v })); };
  const mode = MODES.find((m) => m.id === s.mode) || MODES[0];
  const params = s.mode === 'manual'
    ? { manualMode: s.manualMode, power: s.power, targetSoc: s.targetSoc }
    : { minSoc: s.minSoc, chargeUpperSoc: s.chargeUpperSoc, chargeFromGridEnable: s.chargeFromGridEnable,
        chargeStartTimePeriod1: s.chargeStartTimePeriod1, chargeEndTimePeriod1: s.chargeEndTimePeriod1,
        dischargeStartTimePeriod1: s.dischargeStartTimePeriod1, dischargeEndTimePeriod1: s.dischargeEndTimePeriod1,
        enableTimePeriod2: s.enableTimePeriod2 ? 1 : 0,
        ...(s.enableTimePeriod2 ? { chargeStartTimePeriod2: s.chargeStartTimePeriod2, chargeEndTimePeriod2: s.chargeEndTimePeriod2,
          dischargeStartTimePeriod2: s.dischargeStartTimePeriod2, dischargeEndTimePeriod2: s.dischargeEndTimePeriod2 } : {}) };
  const manualText = ['stop charging and discharging', `force CHARGE at ${s.power} kW`, `force DISCHARGE at ${s.power} kW`][s.manualMode];
  const badTime = s.mode !== 'manual' && [...TIMES1, ...(s.enableTimePeriod2 ? TIMES2 : [])].some((k) => !validTime(s[k]));
  const time = (k, label) => <TimeField key={k} label={label} value={s[k]} onChange={(v) => set(k, v)} />;

  return (
    <Page title="Work Mode" subtitle={plant.plantName}>
      <Note>SolaX doesn't report the inverter's current mode through its API, so this shows the last settings saved here.</Note>
      {MODES.map((m) => <RadioCard key={m.id} title={m.name} desc={m.desc} on={s.mode === m.id} onPress={() => set('mode', m.id)} />)}

      {s.mode === 'manual' ? (
        <Card>
          <Choice label="Action" value={s.manualMode} onChange={(v) => set('manualMode', v)}
            options={[[0, 'Stop charging and discharging'], [1, 'Force charge'], [2, 'Force discharge']]} />
          {s.manualMode !== 0 && <>
            <NumField label="Power (kW)" value={s.power} onChange={(v) => set('power', v)} />
            <NumField label="Stop at battery level (%, optional)" value={s.targetSoc} allowEmpty onChange={(v) => set('targetSoc', v)} />
          </>}
        </Card>
      ) : (
        <Card>
          <Slider label="Minimum battery level (min SOC)" value={s.minSoc} min={10} max={100} onChange={(v) => set('minSoc', v)} />
          <Slider label="Charge battery up to" value={s.chargeUpperSoc} min={s.minSoc} max={100} onChange={(v) => set('chargeUpperSoc', v)} />
          {s.mode !== 'feed_in' && (
            <SwitchRow label="Allow charging from grid" value={!!s.chargeFromGridEnable} onChange={(v) => set('chargeFromGridEnable', v ? 1 : 0)} />
          )}
          <TimeGrid>
            {time('chargeStartTimePeriod1', 'Charge from')}{time('chargeEndTimePeriod1', 'Charge to')}
            {time('dischargeStartTimePeriod1', 'Discharge from')}{time('dischargeEndTimePeriod1', 'Discharge to')}
          </TimeGrid>
          <SwitchRow label="Second charge / discharge period" value={!!s.enableTimePeriod2} onChange={(v) => set('enableTimePeriod2', v ? 1 : 0)} />
          {!!s.enableTimePeriod2 && (
            <TimeGrid>
              {time('chargeStartTimePeriod2', 'Charge from (2)')}{time('chargeEndTimePeriod2', 'Charge to (2)')}
              {time('dischargeStartTimePeriod2', 'Discharge from (2)')}{time('dischargeEndTimePeriod2', 'Discharge to (2)')}
            </TimeGrid>
          )}
        </Card>
      )}
      {saved && <Note ok={saved.ok} error={!saved.ok}>{saved.text}</Note>}
      <Button ghost title="Save without sending" disabled={badTime}
        onPress={() => store(s).then(() => setSaved({ ok: true, text: 'Saved for this plant.' }), (e) => setSaved({ text: e.message }))} />
      <SendBar plant={plant} op={s.mode} params={params} caps={caps} onSaved={() => store(s).catch(() => {})} disabled={badTime}
        confirmText={s.mode === 'manual' ? `At ${plant.plantName}: ${manualText}?` : `Change the inverter at ${plant.plantName} to ${mode.name} (battery ${s.minSoc}–${s.chargeUpperSoc}%)?`} />
    </Page>
  );
}
