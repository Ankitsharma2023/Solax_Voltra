import { useEffect, useState } from 'react';
import { pushSupported, currentSubscription, enablePush, disablePush, sendTestPush } from '../push.js';
import { useNav, Page } from '../nav.jsx';
import { DEFAULT_TARIFF } from '../tariff.js';
import { usePlantSetting } from '../settings.js';
import { ChevronIcon, MeIcon, TariffIcon, AlarmIcon, InfoIcon, HomeIcon, PlusIcon } from '../components/Icons.jsx';
import AddPlant from './AddPlant.jsx';

export default function Me({ plant, plants, onPlantChange, user, onLogout }) {
  const { push } = useNav();
  const [tariff] = usePlantSetting(plant.plantId, 'tariff', null);
  const rows = [
    { icon: <HomeIcon />, title: 'Plant information', sub: `${plant.pvCapacity} kWp solar · ${plant.batteryCapacity} kWh battery`, page: PlantInfo },
    { icon: <TariffIcon />, title: 'Tariff Setting', sub: tariff ? `${tariff.currency}${tariff.mode === 'tou' ? 'TOU' : tariff.importPrice}/kWh` : 'Not set', page: TariffSetting },
    { icon: <AlarmIcon />, title: 'Notifications', sub: notifState(), page: Notifications },
    { icon: <PlusIcon />, title: 'Add another system', sub: 'Second home or new installation', page: AddPlant },
    { icon: <MeIcon />, title: 'Change password', sub: user.login, page: ChangePassword },
    { icon: <InfoIcon />, title: 'About & install app', sub: 'Version 0.5', page: About },
  ];
  return (
    <>
      <div className="me-head">
        <span className="avatar"><MeIcon size={34} /></span>
        <div><h1>{user.name || user.login}</h1><span className="muted">{user.name ? user.login : ''}{user.role === 'admin' ? ' · Voltra admin' : ''}</span></div>
        <img src="/voltra-mark.svg" alt="" width="28" height="28" className="me-mark" />
      </div>
      {plants.length > 1 && (
        <div className="card">
          <label className="field"><span className="muted">Current plant</span>
            <select value={plant.plantId} onChange={(e) => onPlantChange(e.target.value)}>
              {plants.map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName}</option>)}</select></label>
        </div>
      )}
      <div className="card list">
        {rows.map((r) => (
          <button key={r.title} className="list-row" onClick={() => push(r.page, { plant })}>
            <span className="list-icon">{r.icon}</span>
            <span className="list-text"><b>{r.title}</b><span className="muted">{r.sub}</span></span>
            <ChevronIcon className="muted" size={20} />
          </button>
        ))}
      </div>
      <button className="btn ghost logout" onClick={() => { if (confirm('Log out of Voltra?')) onLogout(); }}>Log out</button>
    </>
  );
}

export function ChangePassword() {
  const { pop } = useNav();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (f.next !== f.confirm) return setMsg({ err: true, text: 'New passwords do not match.' });
    setBusy(true); setMsg(null);
    const r = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ err: true, text: b.error || 'Could not change password.' });
    setMsg({ text: 'Password changed. Other devices have been signed out.' });
    setTimeout(pop, 1200);
  }
  const field = (k, label, ac) => (
    <label className="field"><span className="muted">{label}</span>
      <input type="password" autoComplete={ac} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  return (
    <Page title="Change password">
      <form className="card form" onSubmit={submit}>
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password (8+ characters, letters and numbers)', 'new-password')}
        {field('confirm', 'Confirm new password', 'new-password')}
        {msg && <p className={msg.err ? 'note err-text' : 'note ok'}>{msg.text}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
    </Page>
  );
}

const notifState = () => (!('Notification' in window) ? 'Not supported here' : Notification.permission === 'granted' ? 'Alarms & automation alerts' : 'Off');

function PlantInfo({ plant }) {
  const rows = [
    ['Plant name', plant.plantName], ['Plant ID', plant.plantId], ['PV capacity', `${plant.pvCapacity} kWp`],
    ['Battery capacity', `${plant.batteryCapacity} kWh`], ['Address', plant.plantAddress || '--'],
    ['Location', plant.latitude != null ? `${plant.latitude.toFixed(4)}, ${plant.longitude.toFixed(4)}` : '--'],
    ['Time zone', plant.plantTimeZone?.replace(/\).*/, ')')], ['Created', plant.createTime?.slice(0, 10)], ['Owner account', plant.loginName],
  ];
  return (
    <Page title="Plant information">
      <div className="card"><table className="kv"><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></div>
    </Page>
  );
}

export function TariffSetting({ plant }) {
  const { pop } = useNav();
  const [saved, save, loaded] = usePlantSetting(plant.plantId, 'tariff', null);
  const [t, setT] = useState(DEFAULT_TARIFF);
  useEffect(() => { if (loaded && saved) setT({ ...DEFAULT_TARIFF, ...saved }); }, [loaded, saved]);
  const [err, setErr] = useState(null);
  const setP = (i, patch) => setT({ ...t, periods: t.periods.map((p, j) => (i === j ? { ...p, ...patch } : p)) });
  return (
    <Page title="Tariff Setting" subtitle={plant.plantName}>
      <div className="card form">
        <label className="field"><span className="muted">Currency symbol</span>
          <input value={t.currency} maxLength={3} onChange={(e) => setT({ ...t, currency: e.target.value })} /></label>
        <div className="segmented">
          <button className={t.mode === 'flat' ? 'on' : ''} onClick={() => setT({ ...t, mode: 'flat' })}>Fixed price</button>
          <button className={t.mode === 'tou' ? 'on' : ''} onClick={() => setT({ ...t, mode: 'tou' })}>Time of use</button>
        </div>
        {t.mode === 'flat' ? (
          <div className="time-grid">
            <Num label={`Import price (${t.currency}/kWh)`} value={t.importPrice} onChange={(v) => setT({ ...t, importPrice: v })} />
            <Num label={`Export price (${t.currency}/kWh)`} value={t.exportPrice} onChange={(v) => setT({ ...t, exportPrice: v })} />
          </div>
        ) : t.periods.map((p, i) => (
          <div key={i} className="period">
            <div className="period-head"><b>Period {i + 1}</b>
              {t.periods.length > 1 && <button className="text-btn" onClick={() => setT({ ...t, periods: t.periods.filter((_, j) => j !== i) })}>Remove</button>}</div>
            <div className="time-grid">
              <label className="field"><span className="muted">From</span><input type="time" value={p.start} onChange={(e) => setP(i, { start: e.target.value })} /></label>
              <label className="field"><span className="muted">To</span><input type="time" value={p.end} onChange={(e) => setP(i, { end: e.target.value })} /></label>
              <Num label="Import /kWh" value={p.importPrice} onChange={(v) => setP(i, { importPrice: v })} />
              <Num label="Export /kWh" value={p.exportPrice} onChange={(v) => setP(i, { exportPrice: v })} />
            </div>
          </div>
        ))}
        {t.mode === 'tou' && t.periods.length < 6 && (
          <button className="btn ghost" onClick={() => setT({ ...t, periods: [...t.periods, { start: '00:00', end: '23:59', importPrice: t.importPrice, exportPrice: t.exportPrice }] })}>+ Add period</button>
        )}
      </div>
      <p className="note">Saved for this plant and used to calculate earnings on the Home screen, on every phone.</p>
      {err && <p className="note err-text">{err}</p>}
      <button className="btn" onClick={() => save(t).then(pop).catch((e) => setErr(e.message))}>Save</button>
      {saved && <button className="btn ghost" onClick={() => save(null).then(pop).catch((e) => setErr(e.message))}>Remove tariff</button>}
    </Page>
  );
}

function Num({ label, value, onChange }) {
  return <label className="field"><span className="muted">{label}</span>
    <input type="number" inputMode="decimal" min="0" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

export function Notifications({ plant }) {
  const [state, setState] = useState('checking'); // checking | on | off | unsupported | denied
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    currentSubscription().then((s) => setState(s ? 'on' : 'off')).catch(() => setState('off'));
  }, []);

  const run = (fn, done) => async () => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(done); } catch (e) { setMsg({ err: true, text: e.message }); }
    setBusy(false);
  };

  return (
    <Page title="Notifications">
      <div className="card form">
        <p>Get a notification on this phone, even when the app is closed, when:</p>
        <ul className="bullets">
          <li>your system raises a new <b>alarm</b></li>
          <li>one of your <b>Automation</b> scenes triggers (for example "battery below 20%")</li>
        </ul>
        {state === 'unsupported' && <p className="note">This browser can't receive push notifications. On iPhone (iOS 16.4+), add the app to your Home Screen and open it from there.</p>}
        {state === 'denied' && <p className="note">Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.</p>}
        {state === 'off' && <button className="btn" disabled={busy} onClick={run(async () => { await enablePush(plant?.plantId ?? null); setState('on'); }, { text: 'Notifications are on.' })}>Turn on notifications</button>}
        {state === 'on' && <>
          <p className="note ok">● Notifications are on for this phone.</p>
          <button className="btn" disabled={busy} onClick={run(sendTestPush, { text: 'Test sent — it should appear in a few seconds.' })}>Send a test notification</button>
          <button className="btn ghost" disabled={busy} onClick={run(async () => { await disablePush(); setState('off'); }, { text: 'Notifications are off.' })}>Turn off</button>
        </>}
        {msg && <p className={msg.err ? 'note err-text' : 'note ok'}>{msg.text}</p>}
      </div>
    </Page>
  );
}

export function About() {
  return (
    <Page title="About">
      <div className="card form">
        <img src="/voltra-logo.png" alt="Voltra" width="130" height="57" />
        <p className="muted">Monitor your Voltra solar and battery system. Live data comes from SolaX Cloud.</p>
        <p><a href="/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a> · <a href="/terms.html" target="_blank" rel="noreferrer">User Terms</a></p>
      </div>
      <div className="card form">
        <h3 className="card-title">Install on your phone</h3>
        <p><b>iPhone:</b> open in Safari → Share → <i>Add to Home Screen</i>.</p>
        <p><b>Android:</b> open in Chrome → ⋮ menu → <i>Install app</i>.</p>
      </div>
    </Page>
  );
}
