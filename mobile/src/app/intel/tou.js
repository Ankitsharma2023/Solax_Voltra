import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Note, Page, s as ui } from '../../components/ui';
import { Choice, NumField, Slider, SwitchRow, TimeField, TimeGrid } from '../../components/control/Form';
import { useApi } from '../../lib/api';
import { ask, useCaps, validTime } from '../../lib/control';
import { usePlantSetting } from '../../lib/settings';
import { useSession } from '../../lib/session';
import { C } from '../../theme';

// TOU - Time Of Use (web Tou in src/screens/Intelligence.jsx). The plan is plant setting "tou"; the Voltra
// server switches the inverter at each time when it is enabled.
const TOU_MODES = ['Self Use', 'Charging', 'Discharging', 'Battery Standby'];
const NEEDS_POWER = (m) => m === 'Charging' || m === 'Discharging';
const COLORS = { 'Self Use': '#1baf7a', Charging: '#2a78d6', Discharging: '#eb6834', 'Battery Standby': '#9aa3ad' };

export default function Tou() {
  const { plant } = useSession();
  const caps = useCaps(plant.plantId).data;
  const [stored, store, loadedTou] = usePlantSetting(plant.plantId, 'tou', null);
  const status = useApi(`/api/plants/${plant.plantId}/tou/status`, 60_000);
  const [s, setS] = useState({
    enabled: false, defaultMode: 'Self Use', minSoc: 10, defaultPowerKw: 2,
    periods: [{ start: '00:00', end: '06:00', mode: 'Charging', minSoc: 10, powerKw: 2 }],
  });
  useEffect(() => { if (loadedTou && stored) setS({ defaultPowerKw: 2, ...stored }); }, [loadedTou, stored]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (patch) => { setS((o) => ({ ...o, ...patch })); setMsg(null); };
  const setPeriod = (i, patch) => update({ periods: s.periods.map((p, j) => (i === j ? { ...p, ...patch } : p)) });
  const canRun = caps?.ops?.rc_battery_power && caps?.mayControl;
  const badTime = s.periods.some((p) => !validTime(p.start) || !validTime(p.end));

  async function save() {
    if (badTime) return setMsg({ text: 'Check the times: use HH:MM (24 h).' });
    if (s.enabled && !(stored?.enabled) && !(await ask(`Switch on automatic TOU at ${plant.plantName}? The Voltra server will change the inverter at each time in this plan, every day.`, { ok: 'Switch on' }))) return;
    setBusy(true);
    try { await store(s); setMsg({ ok: true, text: s.enabled ? 'Saved. The schedule takes over within a minute.' : 'Saved. Automatic switching is off.' }); status.reload(); }
    catch (e) { setMsg({ text: e.message }); }
    finally { setBusy(false); }
  }

  const st = status.data;
  return (
    <Page title="TOU" subtitle="Time Of Use" onRefresh={status.reload}>
      {st?.enabled && (
        <View style={t.banner}>
          <Text style={t.bannerTitle}>● Now: {st.mode} until {st.until}{st.gap ? ' (default mode)' : ''}</Text>
          <Text style={t.bannerText}>{st.stoppedEarly ? 'Discharge stopped early: battery reached its minimum. ' : ''}
            {st.lastError ? `Last attempt failed: ${st.lastError}` : st.appliedAt ? `Applied ${new Date(st.appliedAt).toLocaleTimeString()}.` : 'Waiting for the next minute…'}</Text>
        </View>
      )}
      <Card>
        <SwitchRow label="Run automatically" sub="The server switches the inverter at each time below, every day"
          value={s.enabled} disabled={!canRun && !s.enabled} onChange={(v) => update({ enabled: v })} />
        {!canRun && <Note>{caps?.mayControl === false ? 'Only the owner, their installer or Voltra can switch this on.' : 'Needs inverter control to be switched on.'}</Note>}
        <Choice label="Outside the periods below" options={TOU_MODES} value={s.defaultMode} onChange={(v) => update({ defaultMode: v })} />
        {NEEDS_POWER(s.defaultMode) && <NumField label="Power (kW)" value={s.defaultPowerKw} onChange={(v) => update({ defaultPowerKw: v })} />}
        {s.defaultMode === 'Discharging' && <Slider label="Stop discharging at" value={s.minSoc} min={10} max={100} onChange={(v) => update({ minSoc: v })} />}
      </Card>
      <Note>Up to 10 periods a day. Each period ends by itself, and the inverter returns to its normal mode if the server is unavailable.</Note>
      {s.periods.map((p, i) => (
        <Card key={i} title={`Time period ${i + 1}`}
          right={<Pressable hitSlop={8} onPress={() => update({ periods: s.periods.filter((_, j) => j !== i) })}><Text style={t.link}>Remove</Text></Pressable>}>
          <TimeGrid>
            <TimeField label="Start" value={p.start} onChange={(v) => setPeriod(i, { start: v })} />
            <TimeField label="End" value={p.end} onChange={(v) => setPeriod(i, { end: v })} />
          </TimeGrid>
          <Choice label="Mode" options={TOU_MODES} value={p.mode} onChange={(v) => setPeriod(i, { mode: v })} />
          {NEEDS_POWER(p.mode) && <NumField label="Power (kW)" value={p.powerKw ?? 2} onChange={(v) => setPeriod(i, { powerKw: v })} />}
          {p.mode === 'Discharging' && <Slider label="Stop discharging at" value={p.minSoc ?? 10} min={10} max={100} onChange={(v) => setPeriod(i, { minSoc: v })} />}
        </Card>
      ))}
      {s.periods.length < 10 && (
        <Button ghost title="+ Add time period" style={{ marginBottom: 12 }}
          onPress={() => update({ periods: [...s.periods, { start: s.periods.at(-1)?.end === '23:59' ? '00:00' : (s.periods.at(-1)?.end || '00:00'), end: '23:59', mode: 'Self Use', minSoc: 10, powerKw: 2 }] })} />
      )}
      <TouTimeline periods={s.periods} />
      {msg && <Note ok={msg.ok} error={!msg.ok}>{msg.text}</Note>}
      <Button title="Save" busy={busy} onPress={save} />
    </Page>
  );
}

function TouTimeline({ periods }) {
  const pct = (time) => {
    if (!validTime(time)) return null;
    const [h, m] = time.split(':').map(Number);
    return ((h * 60 + m) / 1440) * 100;
  };
  return (
    <Card title="Day plan">
      <View style={t.timeline}>
        {periods.map((p, i) => {
          const a = pct(p.start), b = pct(p.end);
          if (a == null || b == null) return null;
          return <View key={i} style={[t.seg, { left: `${a}%`, width: `${Math.max(0.5, b - a)}%`, backgroundColor: COLORS[p.mode] }]} />;
        })}
      </View>
      <View style={t.axis}>{['00:00', '06:00', '12:00', '18:00', '24:00'].map((x) => <Text key={x} style={ui.small}>{x}</Text>)}</View>
      <View style={t.legend}>
        {Object.entries(COLORS).map(([m, c]) => (
          <View key={m} style={t.legendItem}><View style={[t.dot, { backgroundColor: c }]} /><Text style={ui.small}>{m}</Text></View>
        ))}
      </View>
    </Card>
  );
}

const t = StyleSheet.create({
  banner: { backgroundColor: C.accentSoft, borderRadius: 14, padding: 14, marginBottom: 12, gap: 4 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: C.accentDark },
  bannerText: { fontSize: 13, color: C.ink2, lineHeight: 18 },
  link: { color: C.accentDark, fontWeight: '600', fontSize: 14 },
  timeline: { height: 28, borderRadius: 8, backgroundColor: C.soft, overflow: 'hidden' },
  seg: { position: 'absolute', top: 0, bottom: 0 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
