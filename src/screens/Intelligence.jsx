import { useState } from 'react';
import { useApi } from '../api.js';
import { useNav, Page } from '../nav.jsx';
import Header from '../components/Header.jsx';
import { ChevronIcon, BoltIcon, IntelIcon, ChartIcon } from '../components/Icons.jsx';
import { usePlantSetting } from '../settings.js';
import { useEffect } from 'react';
import { SendBar, ExportLimit, RemoteControl, BatteryHeating, History } from './Control.jsx';

const MODES = [
  { id: 'self_use', name: 'Self Use', desc: 'Solar powers the home first, extra charges the battery, then exports.' },
  { id: 'feed_in', name: 'Feed-in Priority', desc: 'Solar is exported to the grid first; the battery charges from what is left.' },
  { id: 'backup', name: 'Back Up', desc: 'Keeps the battery full to cover power cuts.' },
  { id: 'manual', name: 'Manual', desc: 'Force charge, force discharge or stop the battery. For testing and service.' },
];
const TOU_MODES = ['Self Use', 'Charging', 'Discharging', 'Battery Standby'];
const NEEDS_POWER = (m) => m === 'Charging' || m === 'Discharging';

export default function Intelligence({ plant, goTab }) {
  const { push } = useNav();
  const caps = useApi(`/api/capabilities?plant=${plant.plantId}`);
  const cards = [
    { icon: <BoltIcon />, title: 'Work Mode', sub: 'Self Use · Feed-in Priority · Back Up · Manual', page: WorkMode },
    { icon: <ExportIcon />, title: 'Export Limit', sub: 'Maximum power to the grid · zero export', page: ExportLimit },
    { icon: <RemoteIcon />, title: 'Remote Control', sub: 'Temporary charge / discharge / idle for a set time', page: RemoteControl },
    { icon: <HeatIcon />, title: 'Battery Heating', sub: 'Warm the battery in cold weather', page: BatteryHeating },
    { icon: <ChartIcon />, title: 'TOU - Time Of Use', sub: 'Plan modes by time of day', page: Tou },
    { icon: <IntelIcon />, title: 'Automation', sub: 'If this happens, then do that', page: Automation },
    { icon: <HistoryIcon />, title: 'Command History', sub: 'Every change sent to the inverter, with its result', page: History },
  ];
  return (
    <>
      <Header plant={plant} goTab={goTab} />
      <ControlBanner caps={caps.data} />
      {cards.map((c) => (
        <button key={c.title} className="card intel-card" onClick={() => push(c.page, { plant, caps: caps.data })}>
          <span className="intel-icon">{c.icon}</span>
          <span className="list-text"><b>{c.title}</b><span className="muted">{c.sub}</span></span>
          <ChevronIcon className="muted" size={20} />
        </button>
      ))}
      <div className="card intel-card disabled">
        <span className="intel-icon">✦</span>
        <span className="list-text"><b>XSchedule</b><span className="muted">AI energy manager. Needs the SolaX XHub device.</span></span>
      </div>
    </>
  );
}

function ControlBanner({ caps }) {
  if (!caps || caps.control) return caps?.control ? (
    <div className="banner live"><b>● Live control</b><span>Changes here are sent to the inverter. Each one asks for confirmation and is logged in Command History.</span></div>
  ) : null;
  return (
    <div className="banner">
      <b>{caps.mayControl ? 'View-only mode' : 'View only'}</b>
      <span>{caps.mayControl
        ? 'Inverter commands are not switched on yet. Settings are saved for this plant and can be sent once control is enabled.'
        : caps.viewOnly ? 'This system was shared with you as view only. Ask the owner for control access to change settings.' : 'Your account can see these settings but only the owner, their installer or Voltra can change them.'}</span>
    </div>
  );
}

const I = (d) => (p) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>;
const ExportIcon = I(<><path d="M12 3v12m0-12 4 4m-4-4-4 4" /><path d="M4 14v5h16v-5" /></>);
const RemoteIcon = I(<><circle cx="12" cy="12" r="3" /><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" /></>);
const HeatIcon = I(<><path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z" /><path d="M12 11v6" /></>);
const HistoryIcon = I(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>);

// ---------- Work mode ----------
export function WorkMode({ plant, caps }) {
  const [stored, store, loadedWm] = usePlantSetting(plant.plantId, 'workmode', null);
  const [s, setS] = useState({
    mode: 'self_use', minSoc: 10, chargeUpperSoc: 100, chargeFromGridEnable: 0,
    chargeStartTimePeriod1: '00:00', chargeEndTimePeriod1: '00:00', dischargeStartTimePeriod1: '00:00', dischargeEndTimePeriod1: '23:59',
    manualMode: 0, power: 1, targetSoc: '',
  });
  useEffect(() => { if (loadedWm && stored) setS((o) => ({ ...o, ...stored })); }, [loadedWm, stored]);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setSaved(false); setS((o) => ({ ...o, [k]: v })); };
  const mode = MODES.find((m) => m.id === s.mode);
  const params = s.mode === 'manual'
    ? { manualMode: s.manualMode, power: s.power, targetSoc: s.targetSoc }
    : { minSoc: s.minSoc, chargeUpperSoc: s.chargeUpperSoc, chargeFromGridEnable: s.chargeFromGridEnable,
        chargeStartTimePeriod1: s.chargeStartTimePeriod1, chargeEndTimePeriod1: s.chargeEndTimePeriod1,
        dischargeStartTimePeriod1: s.dischargeStartTimePeriod1, dischargeEndTimePeriod1: s.dischargeEndTimePeriod1 };
  const manualText = ['stop charging and discharging', `force CHARGE at ${s.power} kW`, `force DISCHARGE at ${s.power} kW`][s.manualMode];

  return (
    <Page title="Work Mode" subtitle={plant.plantName}>
      <p className="note">SolaX doesn't report the inverter's current mode through its API, so this shows the last settings saved here.</p>
      <div className="mode-list">
        {MODES.map((m) => (
          <button key={m.id} className={s.mode === m.id ? 'card mode on' : 'card mode'} onClick={() => set('mode', m.id)}>
            <span className="radio" /><span className="list-text"><b>{m.name}</b><span className="muted">{m.desc}</span></span>
          </button>
        ))}
      </div>
      {s.mode === 'manual' ? (
        <div className="card form">
          <label className="field"><span className="muted">Action</span>
            <select value={s.manualMode} onChange={(e) => set('manualMode', Number(e.target.value))}>
              <option value={0}>Stop charging and discharging</option><option value={1}>Force charge</option><option value={2}>Force discharge</option></select></label>
          {s.manualMode !== 0 && <>
            <label className="field"><span className="muted">Power (kW)</span>
              <input type="number" min="0.1" step="0.1" value={s.power} onChange={(e) => set('power', Number(e.target.value))} /></label>
            <label className="field"><span className="muted">Stop at battery level (%, optional)</span>
              <input type="number" min="10" max="100" value={s.targetSoc} onChange={(e) => set('targetSoc', e.target.value === '' ? '' : Number(e.target.value))} /></label>
          </>}
        </div>
      ) : (
        <div className="card form">
          <Slider label="Minimum battery level (min SOC)" value={s.minSoc} min={10} max={100} onChange={(v) => set('minSoc', v)} />
          <Slider label="Charge battery up to" value={s.chargeUpperSoc} min={s.minSoc} max={100} onChange={(v) => set('chargeUpperSoc', v)} />
          {s.mode !== 'feed_in' && (
            <label className="switch-row">
              <span>Allow charging from grid</span>
              <input type="checkbox" checked={!!s.chargeFromGridEnable} onChange={(e) => set('chargeFromGridEnable', e.target.checked ? 1 : 0)} />
            </label>
          )}
          <div className="time-grid">
            <TimeField label="Charge from" value={s.chargeStartTimePeriod1} onChange={(v) => set('chargeStartTimePeriod1', v)} />
            <TimeField label="Charge to" value={s.chargeEndTimePeriod1} onChange={(v) => set('chargeEndTimePeriod1', v)} />
            <TimeField label="Discharge from" value={s.dischargeStartTimePeriod1} onChange={(v) => set('dischargeStartTimePeriod1', v)} />
            <TimeField label="Discharge to" value={s.dischargeEndTimePeriod1} onChange={(v) => set('dischargeEndTimePeriod1', v)} />
          </div>
        </div>
      )}
      {saved && <p className="note ok">Saved for this plant.</p>}
      <button className="btn ghost" onClick={() => store(s).then(() => setSaved(true))}>Save without sending</button>
      <SendBar plant={plant} op={s.mode} params={params} caps={caps} onSaved={() => store(s)}
        confirmText={s.mode === 'manual' ? `At ${plant.plantName}: ${manualText}?` : `Change the inverter at ${plant.plantName} to ${mode.name} (battery ${s.minSoc}–${s.chargeUpperSoc}%)?`} />
    </Page>
  );
}

// ---------- TOU ----------
function Tou({ plant, caps }) {
  const [stored, store, loadedTou] = usePlantSetting(plant.plantId, 'tou', null);
  const status = useApi(`/api/plants/${plant.plantId}/tou/status`, 60_000);
  const [s, setS] = useState({
    enabled: false, defaultMode: 'Self Use', minSoc: 10, defaultPowerKw: 2,
    periods: [{ start: '00:00', end: '06:00', mode: 'Charging', minSoc: 10, powerKw: 2 }],
  });
  useEffect(() => { if (loadedTou && stored) setS({ defaultPowerKw: 2, ...stored }); }, [loadedTou, stored]);
  const [msg, setMsg] = useState(null);
  const update = (patch) => { setS((o) => ({ ...o, ...patch })); setMsg(null); };
  const setPeriod = (i, patch) => update({ periods: s.periods.map((p, j) => (i === j ? { ...p, ...patch } : p)) });
  const canRun = caps?.ops?.rc_battery_power && caps?.mayControl;

  async function save() {
    if (s.enabled && !(stored?.enabled) && !confirm(`Switch on automatic TOU at ${plant.plantName}? The Voltra server will change the inverter at each time in this plan, every day.`)) return;
    try { await store(s); setMsg({ ok: true, text: s.enabled ? 'Saved. The schedule takes over within a minute.' : 'Saved. Automatic switching is off.' }); status.reload(); }
    catch (e) { setMsg({ text: e.message }); }
  }

  return (
    <Page title="TOU" subtitle="Time Of Use">
      {status.data?.enabled && (
        <div className="banner live">
          <b>● Now: {status.data.mode} until {status.data.until}{status.data.gap ? ' (default mode)' : ''}</b>
          <span>{status.data.stoppedEarly ? 'Discharge stopped early: battery reached its minimum. ' : ''}
            {status.data.lastError ? `Last attempt failed: ${status.data.lastError}` : status.data.appliedAt ? `Applied ${new Date(status.data.appliedAt).toLocaleTimeString()}.` : 'Waiting for the next minute…'}</span>
        </div>
      )}
      <div className="card form">
        <label className="switch-row"><span><b>Run automatically</b><br /><span className="muted small-text">The server switches the inverter at each time below, every day</span></span>
          <input type="checkbox" checked={s.enabled} disabled={!canRun && !s.enabled} onChange={(e) => update({ enabled: e.target.checked })} /></label>
        {!canRun && <p className="note">{caps?.mayControl === false ? 'Only the owner, their installer or Voltra can switch this on.' : 'Needs inverter control to be switched on.'}</p>}
        <label className="field"><span className="muted">Outside the periods below</span>
          <select value={s.defaultMode} onChange={(e) => update({ defaultMode: e.target.value })}>{TOU_MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
        {NEEDS_POWER(s.defaultMode) && <PowerField value={s.defaultPowerKw} onChange={(v) => update({ defaultPowerKw: v })} />}
        {s.defaultMode === 'Discharging' && <Slider label="Stop discharging at" value={s.minSoc} min={10} max={100} onChange={(v) => update({ minSoc: v })} />}
      </div>
      <p className="note">Up to 10 periods a day. Each period ends by itself, and the inverter returns to its normal mode if the server is unavailable.</p>
      {s.periods.map((p, i) => (
        <div key={i} className="card form period">
          <div className="period-head"><b>Time period {i + 1}</b>
            <button className="text-btn" onClick={() => update({ periods: s.periods.filter((_, j) => j !== i) })}>Remove</button></div>
          <div className="time-grid">
            <TimeField label="Start" value={p.start} onChange={(v) => setPeriod(i, { start: v })} />
            <TimeField label="End" value={p.end} onChange={(v) => setPeriod(i, { end: v })} />
          </div>
          <label className="field"><span className="muted">Mode</span>
            <select value={p.mode} onChange={(e) => setPeriod(i, { mode: e.target.value })}>{TOU_MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
          {NEEDS_POWER(p.mode) && <PowerField value={p.powerKw ?? 2} onChange={(v) => setPeriod(i, { powerKw: v })} />}
          {p.mode === 'Discharging' && <Slider label="Stop discharging at" value={p.minSoc ?? 10} min={10} max={100} onChange={(v) => setPeriod(i, { minSoc: v })} />}
        </div>
      ))}
      {s.periods.length < 10 && (
        <button className="btn ghost" onClick={() => update({ periods: [...s.periods, { start: s.periods.at(-1)?.end === '23:59' ? '00:00' : (s.periods.at(-1)?.end || '00:00'), end: '23:59', mode: 'Self Use', minSoc: 10, powerKw: 2 }] })}>
          + Add time period</button>
      )}
      <TouTimeline periods={s.periods} />
      {msg && <p className={msg.ok ? 'note ok' : 'note err-text'}>{msg.text}</p>}
      <button className="btn" onClick={save}>Save</button>
    </Page>
  );
}

function PowerField({ value, onChange }) {
  return (
    <label className="field"><span className="muted">Power (kW)</span>
      <input type="number" min="0.1" max="30" step="0.1" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>
  );
}

function TouTimeline({ periods }) {
  const colors = { 'Self Use': '#1baf7a', Charging: '#2a78d6', Discharging: '#eb6834', 'Battery Standby': '#9aa3ad' };
  const pct = (t) => { const [h, m] = t.split(':').map(Number); return ((h * 60 + m) / 1440) * 100; };
  return (
    <div className="card">
      <h3 className="card-title">Day plan</h3>
      <div className="timeline">
        {periods.map((p, i) => (
          <div key={i} className="timeline-seg" title={`${p.start}–${p.end} ${p.mode}`}
            style={{ left: `${pct(p.start)}%`, width: `${Math.max(0.5, pct(p.end) - pct(p.start))}%`, background: colors[p.mode] }} />
        ))}
      </div>
      <div className="price-x"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      <div className="chips static">{Object.entries(colors).map(([m, c]) => <span key={m} className="chip on"><span className="dot" style={{ background: c }} />{m}</span>)}</div>
    </div>
  );
}

// ---------- Automation ----------
const CONDITIONS = [
  { id: 'time', label: 'At a time', fields: ['time'] },
  { id: 'soc_below', label: 'Battery below', fields: ['value'], unit: '%' },
  { id: 'soc_above', label: 'Battery above', fields: ['value'], unit: '%' },
  { id: 'offline', label: 'Inverter goes offline', fields: [] },
];
const ACTIONS = [
  { id: 'notify', label: 'Send me a notification' },
  { id: 'mode_self_use', label: 'Switch to Self Use' },
  { id: 'mode_backup', label: 'Switch to Back Up' },
  { id: 'mode_feed_in', label: 'Switch to Feed-in Priority' },
];

function Automation({ plant }) {
  const { push } = useNav();
  const [stored, store] = usePlantSetting(plant.plantId, 'scenes', []);
  const scenes = stored ?? [];
  const [err, setErr] = useState(null);
  const persist = (list) => { setErr(null); return store(list).catch((e) => setErr(e.message)); };
  const describe = (sc) => {
    const c = CONDITIONS.find((x) => x.id === sc.condition.type);
    return `If ${c.label.toLowerCase()}${c.id === 'time' && sc.condition.time ? ` ${sc.condition.time}` : ''}${sc.condition.value != null && c.unit ? ` ${sc.condition.value}${c.unit}` : ''} → ${ACTIONS.find((a) => a.id === sc.action).label.toLowerCase()}`;
  };
  return (
    <Page title="Automation" subtitle="Scenes"
      actions={<button className="text-btn" onClick={() => push(SceneEditor, { onSave: (sc) => persist([...scenes, sc]) })}>+ Add</button>}>
      <div className="card">
        <h3 className="card-title">Smart recommendations</h3>
        {[
          { name: 'Low battery alert', condition: { type: 'soc_below', value: 20 }, action: 'notify' },
          { name: 'Offline alert', condition: { type: 'offline' }, action: 'notify' },
        ].map((r) => (
          <div key={r.name} className="rec-row">
            <span className="list-text"><b>{r.name}</b><span className="muted">{describe(r)}</span></span>
            <button className="text-btn" disabled={scenes.some((s) => s.name === r.name)}
              onClick={() => persist([...scenes, { ...r, id: Date.now(), enabled: true, days: [0, 1, 2, 3, 4, 5, 6] }])}>
              {scenes.some((s) => s.name === r.name) ? 'Added' : 'Enable'}</button>
          </div>
        ))}
      </div>
      <h3 className="sub-head">My scenes ({scenes.length})</h3>
      {!scenes.length ? <div className="card empty-state"><b>No scenes yet</b><span className="muted">Tap + Add to create one.</span></div>
        : scenes.map((sc) => (
          <div key={sc.id} className="card scene">
            <span className="list-text"><b>{sc.name}</b><span className="muted">{describe(sc)}</span></span>
            <label className="toggle"><input type="checkbox" checked={sc.enabled}
              onChange={(e) => persist(scenes.map((x) => (x.id === sc.id ? { ...x, enabled: e.target.checked } : x)))} /><span /></label>
            <button className="text-btn danger" onClick={() => persist(scenes.filter((x) => x.id !== sc.id))}>Delete</button>
          </div>
        ))}
      {err && <p className="note err-text">{err}</p>}
      <p className="note">The Voltra server checks every scene every 5 minutes, even when the app is closed. Each scene runs at most once a day. Results appear in Messages; mode switches are also in Command History.</p>
    </Page>
  );
}

function SceneEditor({ onSave }) {
  const { pop } = useNav();
  const [sc, setSc] = useState({ name: '', days: [0, 1, 2, 3, 4, 5, 6], condition: { type: 'soc_below', value: 20 }, action: 'notify', enabled: true });
  const cond = CONDITIONS.find((c) => c.id === sc.condition.type);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <Page title="New Scene">
      <div className="card form">
        <label className="field"><span className="muted">Name</span>
          <input value={sc.name} placeholder="e.g. Evening backup" onChange={(e) => setSc({ ...sc, name: e.target.value })} /></label>
        <div className="field"><span className="muted">Repeat</span>
          <div className="days">{DAYS.map((d, i) => (
            <button key={d} className={sc.days.includes(i) ? 'day on' : 'day'}
              onClick={() => setSc({ ...sc, days: sc.days.includes(i) ? sc.days.filter((x) => x !== i) : [...sc.days, i].sort() })}>{d}</button>
          ))}</div></div>
      </div>
      <div className="card form if-block">
        <b>If</b>
        <select value={sc.condition.type} onChange={(e) => setSc({ ...sc, condition: e.target.value === 'time' ? { type: 'time', time: '18:00' } : { type: e.target.value, value: 20 } })}>
          {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        {cond.fields.includes('time') && <input type="time" value={sc.condition.time || '18:00'} onChange={(e) => setSc({ ...sc, condition: { ...sc.condition, time: e.target.value } })} />}
        {cond.fields.includes('value') && <Slider label={cond.label} value={sc.condition.value} min={5} max={100} onChange={(v) => setSc({ ...sc, condition: { ...sc.condition, value: v } })} />}
      </div>
      <div className="card form then-block">
        <b>Then</b>
        <select value={sc.action} onChange={(e) => setSc({ ...sc, action: e.target.value })}>
          {ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
        {sc.action.startsWith('mode_') && <p className="note">The server will switch the inverter's work mode (using this plant's saved Work Mode settings). Only the owner, their installer or Voltra can save this.</p>}
      </div>
      <button className="btn" disabled={!sc.name.trim()} onClick={() => { onSave({ ...sc, id: Date.now() }); pop(); }}>Save scene</button>
    </Page>
  );
}

// ---------- small form pieces ----------
function Slider({ label, value, min, max, onChange }) {
  return (
    <label className="slider">
      <span className="slider-head"><span>{label}</span><b>{value}%</b></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--p': `${((value - min) / Math.max(1, max - min)) * 100}%` }} />
    </label>
  );
}
function TimeField({ label, value, onChange }) {
  return <label className="field"><span className="muted">{label}</span><input type="time" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
