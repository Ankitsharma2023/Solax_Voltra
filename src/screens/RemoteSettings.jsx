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

function SettingsLevels({ plant, caps, level: startLevel, onAdvanced }) {
  const { push, pop } = useNav();
  const [tab, setTab] = useState('basic');
  const advanced = startLevel === 'advanced';
  return (
    <Page title="Settings" subtitle={plant.plantName}>
      <div className="segmented">
        <button className={tab === 'basic' ? 'on' : ''} onClick={() => setTab('basic')}>Basic</button>
        <button className={tab === 'advanced' ? 'on' : ''} onClick={() => setTab('advanced')}>Advanced</button>
      </div>
      {tab === 'basic' ? (
        <div className="card list">
          <Row title="Work Mode & battery limits" sub="Mode, minimum SOC, charge up to, charge from grid, times" onClick={() => push(WorkMode, { plant, caps })} />
          <Row title="Battery Heating" sub="Heating on/off, level and times" onClick={() => push(BatteryHeating, { plant, caps })} />
        </div>
      ) : advanced ? (
        <div className="card list">
          <Row title="Export Limit" sub="Zero export or a maximum in kW" onClick={() => push(ExportLimit, { plant, caps })} />
          <Row title="Remote Control" sub="Force charge / discharge / idle for a set time" onClick={() => push(RemoteControl, { plant, caps })} />
          <Row title="Manual Mode" sub="Under Work Mode → Manual" onClick={() => push(WorkMode, { plant, caps })} />
        </div>
      ) : (
        <div className="card form">
          <p>🔒 Advanced settings change how the inverter works with the grid. They need the installer password.</p>
          <button className="btn" onClick={() => { pop(); setTimeout(onAdvanced, 300); }}>Enter installer password</button>
        </div>
      )}
    </Page>
  );
}
