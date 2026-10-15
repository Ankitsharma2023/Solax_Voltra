import { useState } from 'react';
import { useApi } from '../api.js';
import { useNav, Page } from '../nav.jsx';
import Header from '../components/Header.jsx';
import { ChevronIcon, BoltIcon, IntelIcon, ChartIcon } from '../components/Icons.jsx';
import { usePlantSetting } from '../settings.js';
import { useEffect } from 'react';

const MODES = [
  { id: 'self_use', name: 'Self Use', desc: 'Solar powers the home first, extra charges the battery, then exports.' },
  { id: 'feed_in', name: 'Feed-in Priority', desc: 'Solar is exported to the grid first; the battery charges from what is left.' },
  { id: 'backup', name: 'Back Up', desc: 'Keeps the battery full to cover power cuts.' },
];
const TOU_MODES = ['Self Use', 'Charging', 'Discharging', 'Battery Standby', 'Peak Shaving'];

export default function Intelligence({ plant }) {
  const { push } = useNav();
  const caps = useApi('/api/capabilities');
  const control = caps.data?.control;
  const cards = [
    { icon: <BoltIcon />, title: 'Work Mode', sub: 'Self Use · Feed-in Priority · Back Up', page: WorkMode },
    { icon: <ChartIcon />, title: 'TOU - Time Of Use', sub: 'Run different modes at different times to cut costs', page: Tou },
    { icon: <IntelIcon />, title: 'Automation', sub: 'If this happens, then do that', page: Automation },
  ];
  return (
    <>
      <Header plant={plant} />
      <ControlBanner caps={caps.data} />
      {cards.map((c) => (
        <button key={c.title} className="card intel-card" onClick={() => push(c.page, { plant, control })}>
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
  if (!caps || caps.control) return null;
  return (
    <div className="banner">
      <b>View-only mode</b>
      <span>Settings can be prepared and saved on this phone, but they won't be sent to the inverter until inverter control is switched on for this app.</span>
    </div>
  );
}

// ---------- Work mode ----------
function WorkMode({ plant, control }) {
  const [stored, store, loadedWm] = usePlantSetting(plant.plantId, 'workmode', null);
  const [s, setS] = useState({
    mode: 'self_use', minSoc: 10, chargeUpperSoc: 100, chargeFromGridEnable: 0,
    chargeStartTimePeriod1: '00:00', chargeEndTimePeriod1: '00:00', dischargeStartTimePeriod1: '00:00', dischargeEndTimePeriod1: '23:59',
  });
  useEffect(() => { if (loadedWm && stored) setS((o) => ({ ...o, ...stored })); }, [loadedWm, stored]);
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setS((o) => ({ ...o, [k]: v }));

  async function apply() {
    await store(s);
    if (!control) return setMsg({ ok: true, text: 'Saved for this plant. It will be sent to the inverter once inverter control is switched on.' });
    if (!confirm(`Change the inverter at ${plant.plantName} to ${MODES.find((m) => m.id === s.mode).name}?`)) return;
    setMsg({ text: 'Sending…' });
    try {
      const r = await fetch(`/api/plants/${plant.plantId}/work-mode`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      const b = await r.json();
      setMsg(r.ok ? { ok: true, text: 'Command sent to the inverter.' } : { text: b.error });
    } catch (e) { setMsg({ text: e.message }); }
  }

  return (
    <Page title="Work Mode" subtitle={plant.plantName}>
      <div className="mode-list">
        {MODES.map((m) => (
          <button key={m.id} className={s.mode === m.id ? 'card mode on' : 'card mode'} onClick={() => set('mode', m.id)}>
            <span className="radio" /><span className="list-text"><b>{m.name}</b><span className="muted">{m.desc}</span></span>
          </button>
        ))}
      </div>
      <div className="card form">
        <Slider label="Minimum battery level (min SOC)" value={s.minSoc} min={10} max={100} onChange={(v) => set('minSoc', v)} />
        <Slider label="Charge battery up to" value={s.chargeUpperSoc} min={s.minSoc} max={100} onChange={(v) => set('chargeUpperSoc', v)} />
        {s.mode === 'self_use' && (
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
      {msg && <p className={msg.ok ? 'note ok' : 'note'}>{msg.text}</p>}
      <button className="btn" onClick={apply}>{control ? 'Apply to inverter' : 'Save'}</button>
    </Page>
  );
}

// ---------- TOU ----------
function Tou({ plant }) {
  const [stored, store, loadedTou] = usePlantSetting(plant.plantId, 'tou', null);
  const [s, setS] = useState({
    enabled: false, defaultMode: 'Self Use', minSoc: 10,
    periods: [{ start: '00:00', end: '23:59', mode: 'Self Use', minSoc: 10 }],
  });
  useEffect(() => { if (loadedTou && stored) setS(stored); }, [loadedTou, stored]);
  const [saved, setSaved] = useState(false);
  const update = (patch) => { setS((o) => ({ ...o, ...patch })); setSaved(false); };
  const setPeriod = (i, patch) => update({ periods: s.periods.map((p, j) => (i === j ? { ...p, ...patch } : p)) });

  return (
    <Page title="TOU" subtitle="Time Of Use">
      <div className="card form">
        <label className="switch-row"><span><b>Enable TOU strategy</b></span>
          <input type="checkbox" checked={s.enabled} onChange={(e) => update({ enabled: e.target.checked })} /></label>
        <label className="field"><span className="muted">Default working mode</span>
          <select value={s.defaultMode} onChange={(e) => update({ defaultMode: e.target.value })}>{TOU_MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
        <Slider label="Default min SOC" value={s.minSoc} min={10} max={100} onChange={(v) => update({ minSoc: v })} />
      </div>
      <p className="note">At most 10 time periods per day. Gaps run in the default mode.</p>
      {s.periods.map((p, i) => (
        <div key={i} className="card form period">
          <div className="period-head"><b>Time period {i + 1}</b>
            {s.periods.length > 1 && <button className="text-btn" onClick={() => update({ periods: s.periods.filter((_, j) => j !== i) })}>Remove</button>}</div>
          <div className="time-grid">
            <TimeField label="Start" value={p.start} onChange={(v) => setPeriod(i, { start: v })} />
            <TimeField label="End" value={p.end} onChange={(v) => setPeriod(i, { end: v })} />
          </div>
          <label className="field"><span className="muted">Work mode</span>
            <select value={p.mode} onChange={(e) => setPeriod(i, { mode: e.target.value })}>{TOU_MODES.map((m) => <option key={m}>{m}</option>)}</select></label>
          <Slider label="Min SOC" value={p.minSoc} min={10} max={100} onChange={(v) => setPeriod(i, { minSoc: v })} />
        </div>
      ))}
      {s.periods.length < 10 && (
        <button className="btn ghost" onClick={() => update({ periods: [...s.periods, { start: s.periods.at(-1)?.end || '00:00', end: '23:59', mode: 'Self Use', minSoc: 10 }] })}>
          + Add time period</button>
      )}
      <TouTimeline periods={s.periods} />
      {saved && <p className="note ok">Saved for this plant.</p>}
      <button className="btn" onClick={() => store(s).then(() => setSaved(true))}>Save</button>
    </Page>
  );
}

function TouTimeline({ periods }) {
  const colors = { 'Self Use': '#1baf7a', Charging: '#2a78d6', Discharging: '#eb6834', 'Battery Standby': '#9aa3ad', 'Peak Shaving': '#6250d6' };
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
  const persist = (list) => store(list);
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
      <p className="note">Scenes with "Send me a notification" are checked by the Voltra server every 5 minutes and work even when the app is closed. Turn on notifications in Me → Notifications.</p>
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
        {sc.action.startsWith('mode_') && <p className="note">Mode changes need inverter control to be switched on.</p>}
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
