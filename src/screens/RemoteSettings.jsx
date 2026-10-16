import { useState } from 'react';
import { useNav, Page } from '../nav.jsx';
import { usePlantSetting } from '../settings.js';
import { ChevronIcon } from '../components/Icons.jsx';
import { SendBar, ExportLimit, RemoteControl, BatteryHeating, History } from './Control.jsx';
import { WorkMode } from './Intelligence.jsx';

// Remote Settings, laid out like the SolaX app: "Unlock Password" first, then Settings (Work Mode, Smart
// Settings) and More → Settings with Basic / Advanced. Advanced needs the installer password.
export default function RemoteSettings({ plant, card, caps }) {
  const { pop, push } = useNav();
  const [level, setLevel] = useState(null);   // null = locked | 'basic' | 'advanced'
  const [asking, setAsking] = useState(true);
  const [open, setOpen] = useState(null);     // expanded row

  const unlocked = (lv) => { setLevel(lv); setAsking(false); };
  return (
    <Page title="Remote Settings" subtitle={plant.plantName}>
      {asking && <UnlockDialog plant={plant} onCancel={() => (level ? setAsking(false) : pop())} onUnlocked={unlocked} advanced={!!level} />}
      <div className="card sn-card">
        <span className="muted small-text">SN</span>
        <b>{card.sn}</b>
      </div>
      {!level ? (
        <div className="card form"><p className="muted">Enter the inverter password to see its settings.</p>
          <button className="btn" onClick={() => setAsking(true)}>Unlock</button></div>
      ) : <>
        <h2 className="me-section">Settings</h2>
        <div className="card list">
          <Expand title="Work Mode" open={open === 'mode'} onToggle={() => setOpen(open === 'mode' ? null : 'mode')}>
            <QuickWorkMode plant={plant} caps={caps} />
          </Expand>
          <Expand title="Smart Settings" open={open === 'smart'} onToggle={() => setOpen(open === 'smart' ? null : 'smart')}>
            <div className="list nested">
              <Row title="Battery Heating" sub="Warm the battery in cold weather" onClick={() => push(BatteryHeating, { plant, caps })} />
              <Row title="Export Limit" sub="Maximum power sent to the grid" onClick={() => push(ExportLimit, { plant, caps })} locked={level !== 'advanced'} />
            </div>
          </Expand>
        </div>
        <h2 className="me-section">More</h2>
        <div className="card list">
          <Row title="Settings" sub="Basic · Advanced" onClick={() => push(SettingsLevels, { plant, caps, level, onAdvanced: () => setAsking(true) })} />
          <Row title="Command History" sub="Every change sent to this inverter" onClick={() => push(History, { plant })} />
        </div>
        <p className="note">{level === 'advanced' ? 'Unlocked: basic and advanced settings.' : 'Unlocked: basic settings. Advanced settings need the installer password.'}</p>
      </>}
    </Page>
  );
}

function UnlockDialog({ plant, onCancel, onUnlocked, advanced }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function confirm(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await fetch(`/api/plants/${plant.plantId}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(b.error || 'Incorrect password.');
    onUnlocked(b.level);
  }
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={confirm}>
        <h3>{advanced ? 'Installer Password' : 'Unlock Password'}</h3>
        <input type="password" inputMode="numeric" autoComplete="off" placeholder="Password" value={pw} autoFocus onChange={(e) => setPw(e.target.value)} />
        {err ? <p className="err-text small-text">{err}</p>
          : <p className="muted small-text">{advanced ? 'Ask Voltra for the installer password.' : 'The inverter password (default 0000, or the one saved under Backup Password).'}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={busy || !pw}>{busy ? '…' : 'Confirm'}</button>
        </div>
      </form>
    </div>
  );
}

function Expand({ title, open, onToggle, children }) {
  return (
    <div className={open ? 'expand open' : 'expand'}>
      <button className="list-row" onClick={onToggle} aria-expanded={open}>
        <span className="list-text"><b>{title}</b></span><ChevronIcon className="muted expand-chev" size={20} />
      </button>
      {open && <div className="expand-body">{children}</div>}
    </div>
  );
}

function Row({ title, sub, onClick, locked }) {
  return (
    <button className="list-row" onClick={onClick} disabled={locked}>
      <span className="list-text"><b>{title}</b>{sub && <span className="muted">{locked ? 'Needs the installer password' : sub}</span>}</span>
      {locked ? <span aria-hidden="true">🔒</span> : <ChevronIcon className="muted" size={20} />}
    </button>
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
    <div className="form">
      <div className="radio-list">
        {QUICK_MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'radio-row on' : 'radio-row'} onClick={() => setMode(m.id)}>
            <span className="radio" />{m.name}
          </button>
        ))}
      </div>
      <p className="muted small-text">Battery {s.minSoc}–{s.chargeUpperSoc}%{s.chargeFromGridEnable ? ', charging from grid allowed' : ''}. Change these under More → Settings → Basic.</p>
      <SendBar plant={plant} op={mode} params={params} caps={caps} onSaved={() => store({ ...s, mode })}
        confirmText={`Change the inverter at ${plant.plantName} to ${name}?`} />
    </div>
  );
}

// The full SolaX settings menu. Rows the SolaX cloud API can change open a working editor; the rest need the
// installer on site (Bluetooth / inverter screen) and send Voltra a request instead.
const BASIC = [
  { title: 'Work Mode', sub: 'Self Use · Feed-in Priority · Back Up · Manual', page: 'workmode' },
  { title: 'Self Use', sub: 'Min SOC, charge battery to, charge from grid', page: 'workmode' },
  { title: 'Feed-in Priority', sub: 'Min SOC, charge battery to', page: 'workmode' },
  { title: 'Back Up', sub: 'Min SOC kept for power cuts', page: 'workmode' },
  { title: 'Charge & Discharge Period', sub: 'Period 1 and period 2', page: 'workmode' },
  { title: 'Export Control (user value)', sub: 'Zero export or a maximum in kW', page: 'export' },
  { title: 'Battery Heating', sub: 'Heating on/off, level, two periods', page: 'heating' },
  { title: 'EPS Setting', sub: 'Backup output: mute, frequency, min SOC', site: 'Changes the backup (EPS) output behaviour: alarm mute, 50/60 Hz and the battery level kept for backup.' },
  { title: 'Date & Time', sub: 'Inverter clock', site: 'The inverter normally takes its time from SolaX Cloud automatically. A wrong clock is corrected on site.' },
];
const ADVANCED = [
  { title: 'Export Control (installer)', sub: 'Meter/CT based export limit', page: 'export' },
  { title: 'Remote Control (VPP)', sub: 'Force charge / discharge / idle for a set time', page: 'remote' },
  { title: 'Manual Mode', sub: 'Force charge, force discharge, stop', page: 'workmode' },
  { title: 'Safety Code', sub: 'Grid standard / country', site: 'Sets the grid standard the inverter follows. It is locked to the installer for safety and grid-code compliance.' },
  { title: 'Grid Protection', sub: 'Voltage and frequency limits', site: 'Over/under voltage and frequency trip limits required by the electricity board.' },
  { title: 'Meter / CT Setting', sub: 'Meter type, CT direction', site: 'Configures the energy meter or CT that measures import/export.' },
  { title: 'Battery Setting', sub: 'Battery type, max charge/discharge current', site: 'Battery brand/type and charge/discharge current limits.' },
  { title: 'Peak Shaving', sub: 'Limit grid import peaks', site: 'Uses the battery to cap peaks of grid import. SolaX does not offer it through its cloud API.' },
  { title: 'Shadow Fix (GMPPT)', sub: 'Shaded panel tracking', site: 'Global MPPT scan for partly shaded strings.' },
  { title: 'Power Factor / Reactive Power', sub: 'PF mode and Q(U)', site: 'Reactive power control required by some grid operators.' },
  { title: 'Parallel Setting', sub: 'Several inverters together', site: 'Master/slave setup for inverters working in parallel.' },
  { title: 'DRM Function', sub: 'Demand response modes', site: 'Demand response (DRM) input used in some regions.' },
  { title: 'Pgrid Bias', sub: 'Grid power offset', site: 'Small offset so the system imports or exports slightly instead of exactly zero.' },
  { title: 'Reset', sub: 'Errors, energy counters, meter, factory', site: 'Clears error logs, energy counters or returns the inverter to factory settings.' },
];

function SettingsLevels({ plant, caps, level: startLevel, onAdvanced }) {
  const { push, pop } = useNav();
  const [tab, setTab] = useState('basic');
  const advanced = startLevel === 'advanced';
  const PAGES = { workmode: WorkMode, export: ExportLimit, heating: BatteryHeating, remote: RemoteControl };
  const open = (it) => (it.page ? push(PAGES[it.page], { plant, caps }) : push(OnSite, { plant, item: it }));
  const list = tab === 'basic' ? BASIC : ADVANCED;
  return (
    <Page title="Settings" subtitle={plant.plantName}>
      <div className="segmented">
        <button className={tab === 'basic' ? 'on' : ''} onClick={() => setTab('basic')}>Basic</button>
        <button className={tab === 'advanced' ? 'on' : ''} onClick={() => setTab('advanced')}>Advanced</button>
      </div>
      {tab === 'advanced' && !advanced ? (
        <div className="card form">
          <p>🔒 Advanced settings change how the inverter works with the grid. They need the installer password.</p>
          <button className="btn" onClick={() => { pop(); setTimeout(onAdvanced, 300); }}>Enter installer password</button>
        </div>
      ) : (
        <div className="card list">
          {list.map((it) => (
            <button key={it.title} className="list-row" onClick={() => open(it)}>
              <span className="list-text"><b>{it.title}</b><span className="muted">{it.sub}</span></span>
              {it.site ? <span className="site-badge">On site</span> : <ChevronIcon className="muted" size={20} />}
            </button>
          ))}
        </div>
      )}
      <p className="note">Rows marked <b>On site</b> can't be changed through SolaX Cloud. Voltra changes them at the inverter; tap one to send a request.</p>
    </Page>
  );
}

function OnSite({ plant, item }) {
  const { pop } = useNav();
  const [note, setNote] = useState('');
  const [state, setState] = useState(null);
  async function send(e) {
    e.preventDefault();
    setState('busy');
    const r = await fetch(`/api/plants/${plant.plantId}/service-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'service', note: `Setting: ${item.title}. ${note}` }) });
    setState(r.ok ? 'sent' : 'error');
  }
  return (
    <Page title={item.title} subtitle={plant.plantName}>
      <div className="card form">
        <p>{item.site}</p>
        <p className="muted small-text">SolaX only lets outside apps change work mode, export limit, battery heating and remote control. This setting is changed by Voltra at the inverter (screen or Bluetooth).</p>
      </div>
      {state === 'sent' ? (
        <div className="card form"><p className="note ok">Request sent. Voltra will contact you.</p><button className="btn" onClick={pop}>Done</button></div>
      ) : (
        <form className="card form" onSubmit={send}>
          <label className="field"><span className="muted">What should it be set to? (optional)</span>
            <textarea rows={3} maxLength={800} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {state === 'error' && <p className="note err-text">Could not send. Please try again or call Voltra.</p>}
          <button className="btn" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Ask Voltra to change it'}</button>
        </form>
      )}
    </Page>
  );
}
