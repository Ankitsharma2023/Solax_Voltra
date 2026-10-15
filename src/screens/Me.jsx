import { useEffect, useState } from 'react';
import { pushSupported, currentSubscription, enablePush, disablePush, sendTestPush } from '../push.js';
import { useNav, Page } from '../nav.jsx';
import { DEFAULT_TARIFF } from '../tariff.js';
import { usePlantSetting } from '../settings.js';
import { ChevronIcon, MeIcon, TariffIcon, InfoIcon, HomeIcon, PlusIcon, ChartIcon } from '../components/Icons.jsx';
import AddPlant from './AddPlant.jsx';
import Messages, { useUnread } from './Messages.jsx';
import PlantSharing from './Sharing.jsx';
import LiveData from './LiveData.jsx';
import Stats from './Stats.jsx';
import { Help } from './Service.jsx';

export default function Me({ plant, plants, onPlantChange, user, onLogout, goTab }) {
  const { push } = useNav();
  const [tariff] = usePlantSetting(plant.plantId, 'tariff', null);
  const unread = useUnread();
  const open = (page, extra) => push(page, { plant, user, onLogout, onOpenTab: goTab, ...extra });
  const groups = [
    [
      { icon: <ShareIcon />, title: 'Plant Sharing', sub: plant.sharedPerm ? `Shared with you · ${plant.sharedPerm === 'view' ? 'view only' : 'view and control'}` : 'Family, caretaker or a second phone', page: PlantSharing },
      { icon: <TariffIcon />, title: 'Tariff Setting', sub: tariff ? `${tariff.currency}${tariff.mode === 'tou' ? 'TOU' : tariff.importPrice}/kWh` : 'Not set', page: TariffSetting },
    ],
    [
      { icon: <ChatIcon />, title: 'Messages', sub: unread ? `${unread} unread` : 'Alarms, automation and changes', page: Messages, badge: unread },
      { icon: <SendIcon />, title: 'Notification Settings', sub: notifState(), page: Notifications },
      { icon: <MailIcon />, title: 'Email Subscription', sub: user.emailAlerts ? 'Alarm e-mails on' : 'Off', page: EmailSubscription },
      { icon: <GearIcon />, title: 'General Settings', sub: 'Account, display, cache, privacy', page: GeneralSettings },
    ],
  ];
  const apps = [
    { icon: <PulseIcon />, title: 'Live Data', sub: 'Every reading, refreshed each minute', page: LiveData },
    { icon: <PlusIcon />, title: 'Add another system', sub: 'Second home or new installation', page: AddPlant },
  ];
  return (
    <>
      <div className="me-head">
        <span className="avatar"><MeIcon size={34} /></span>
        <div><h1>{user.name || user.login}</h1><span className="muted">{user.name ? user.login : ''}{user.role === 'admin' ? ' · Voltra admin' : ''}</span></div>
        <img src="/voltra-mark.svg" alt="" width="28" height="28" className="me-mark" />
      </div>
      <div className="me-tiles">
        <button className="card me-tile" onClick={() => open(PlantInfo)}>
          <span className="me-tile-icon teal"><HomeIcon /></span><span><b>Plant</b><span className="muted">{plants.length > 1 ? `${plants.length} systems` : plant.plantName}</span></span>
        </button>
        <button className="card me-tile" onClick={() => open(Stats)}>
          <span className="me-tile-icon amber"><ChartIcon /></span><span><b>Statistics</b><span className="muted">Day · Month · Year</span></span>
        </button>
      </div>
      {plants.length > 1 && (
        <div className="card">
          <label className="field"><span className="muted">Current plant</span>
            <select value={plant.plantId} onChange={(e) => onPlantChange(e.target.value)}>
              {plants.map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName}{p.sharedPerm ? ' (shared with you)' : ''}</option>)}</select></label>
        </div>
      )}
      {groups.map((rows, i) => <MeList key={i} rows={rows} open={open} />)}
      <h2 className="me-section">Application</h2>
      <MeList rows={apps} open={open} />
      <h2 className="me-section">Help Center</h2>
      <MeList open={open} rows={[
        { icon: <InfoIcon />, title: 'Help & contact', sub: 'Voltra support · +91 99929 29203', page: Help },
        { icon: <InfoIcon />, title: 'About & install app', sub: `Version ${APP_VERSION}`, page: About },
      ]} />
      <button className="btn ghost logout" onClick={() => { if (confirm('Log out of Voltra?')) onLogout(); }}>Log out</button>
    </>
  );
}

const APP_VERSION = '0.13';

function MeList({ rows, open }) {
  return (
    <div className="card list">
      {rows.map((r) => (
        <button key={r.title} className="list-row" onClick={() => open(r.page)}>
          <span className="list-icon">{r.icon}</span>
          <span className="list-text"><b>{r.title}</b><span className="muted">{r.sub}</span></span>
          {r.badge ? <span className="count-badge">{r.badge > 99 ? '99+' : r.badge}</span> : null}
          <ChevronIcon className="muted" size={20} />
        </button>
      ))}
    </div>
  );
}

const L = (d) => (p) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>;
const ShareIcon = L(<><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="6" r="2.5" /><circle cx="17" cy="18" r="2.5" /><path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6" /></>);
const ChatIcon = L(<><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z" /><path d="M9 12h.01M12 12h.01M15 12h.01" /></>);
const SendIcon = L(<path d="M21 3 3 10.5l7 2.5 2.5 7z M10 13l4-4" />);
const MailIcon = L(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>);
const GearIcon = L(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
const PulseIcon = L(<><circle cx="12" cy="12" r="9" /><path d="M6 12h3l2-4 2 8 2-4h3" /></>);

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

export function Notifications({ plant, user }) {
  const [state, setState] = useState('checking'); // checking | on | off | unsupported | denied
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [types, setTypes] = useState({ alarm: true, automation: true, ...(user?.notify ?? {}) });

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
  async function setType(k, on) {
    const next = { ...types, [k]: on };
    setTypes(next);
    const ok = await savePrefs({ notify: { [k]: on } }, user);
    if (!ok) { setTypes(types); setMsg({ err: true, text: 'Could not save. Please try again.' }); }
  }

  return (
    <Page title="Notification Settings">
      <div className="card form">
        <h3 className="card-title">Push notifications on this phone</h3>
        <p className="muted">Arrive even when the app is closed.</p>
        {state === 'unsupported' && <p className="note">This browser can't receive push notifications. On iPhone (iOS 16.4+), add the app to your Home Screen and open it from there.</p>}
        {state === 'denied' && <p className="note">Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.</p>}
        {state === 'off' && <button className="btn" disabled={busy} onClick={run(async () => { await enablePush(plant?.plantId ?? null); setState('on'); }, { text: 'Notifications are on.' })}>Turn on notifications</button>}
        {state === 'on' && <>
          <p className="note ok">● Notifications are on for this phone.</p>
          <button className="btn ghost" disabled={busy} onClick={run(sendTestPush, { text: 'Test sent — it should appear in a few seconds.' })}>Send a test notification</button>
          <button className="btn ghost" disabled={busy} onClick={run(async () => { await disablePush(); setState('off'); }, { text: 'Notifications are off.' })}>Turn off on this phone</button>
        </>}
        {msg && <p className={msg.err ? 'note err-text' : 'note ok'}>{msg.text}</p>}
      </div>
      <div className="card form">
        <h3 className="card-title">What to notify me about</h3>
        <label className="switch-row"><span><b>Alarms</b><br /><span className="muted small-text">A fault or warning starts on {user?.role === 'customer' ? 'your system' : 'a plant you look after'}</span></span>
          <input type="checkbox" checked={types.alarm} onChange={(e) => setType('alarm', e.target.checked)} /></label>
        <label className="switch-row"><span><b>Automation</b><br /><span className="muted small-text">One of your scenes runs (for example "battery below 20%")</span></span>
          <input type="checkbox" checked={types.automation} onChange={(e) => setType('automation', e.target.checked)} /></label>
        <p className="muted small-text">Everything is also kept in Messages, whatever you choose here.</p>
      </div>
    </Page>
  );
}

// Saves personal preferences and updates the signed-in user object in place.
async function savePrefs(patch, user) {
  const r = await fetch('/api/me/prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  if (!r.ok) return false;
  const b = await r.json().catch(() => null);
  if (b?.user && user) Object.assign(user, b.user);
  return true;
}

export function EmailSubscription({ user }) {
  const [emailOn, setEmailOn] = useState(!!user?.emailAlerts);
  const [emailMsg, setEmailMsg] = useState(null);
  async function toggleEmail(on) {
    setEmailOn(on); setEmailMsg(null);
    if (!(await savePrefs({ emailAlerts: on }, user))) { setEmailOn(!on); setEmailMsg('Could not save. Please try again.'); return; }
    setEmailMsg(on ? `Alarm e-mails will go to ${user?.login}.` : 'Alarm e-mails are off.');
  }
  return (
    <Page title="Email Subscription">
      <div className="card form">
        <label className="switch-row"><span><b>Alarm e-mails</b><br /><span className="muted small-text">One e-mail when a new alarm starts on {user?.role === 'customer' ? 'your system' : 'any plant you look after'}</span></span>
          <input type="checkbox" checked={emailOn} onChange={(e) => toggleEmail(e.target.checked)} /></label>
        {emailMsg && <p className="note ok">{emailMsg}</p>}
        <p className="muted small-text">Sent from no-reply@voltra.in to {user?.login}.</p>
      </div>
    </Page>
  );
}

export function GeneralSettings({ user, onLogout }) {
  const { push } = useNav();
  const [name, setName] = useState(user?.name ?? '');
  const [nameMsg, setNameMsg] = useState(null);
  const [flow, setFlow] = useState(() => { try { return Number(localStorage.getItem('voltra.flowPage')) || 0; } catch { return 0; } });
  const [cacheMsg, setCacheMsg] = useState(null);
  const pickFlow = (p) => { setFlow(p); try { localStorage.setItem('voltra.flowPage', String(p)); } catch { /* ignore */ } };
  async function saveName(e) {
    e.preventDefault();
    setNameMsg(await savePrefs({ name }, user) ? { text: 'Saved.' } : { err: true, text: 'Could not save.' });
  }
  async function clearCache() {
    try {
      if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      const keep = ['voltra.plant', 'voltra.flowPage'];
      Object.keys(localStorage).filter((k) => k.startsWith('voltra.') && !keep.includes(k)).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setCacheMsg('Cleared. Reloading…');
    setTimeout(() => location.reload(), 600);
  }
  return (
    <Page title="General Settings">
      <form className="card form" onSubmit={saveName}>
        <h3 className="card-title">Account</h3>
        <label className="field"><span className="muted">Name</span><input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span className="muted">E-mail (login)</span><input value={user?.login ?? ''} disabled /></label>
        <button className="btn ghost">Save name</button>
        {nameMsg && <p className={nameMsg.err ? 'note err-text' : 'note ok'}>{nameMsg.text}</p>}
      </form>
      <div className="card list">
        <button className="list-row" onClick={() => push(ChangePassword)}>
          <span className="list-text"><b>Change password</b></span><ChevronIcon className="muted" size={20} /></button>
      </div>
      <div className="card form">
        <h3 className="card-title">Home screen energy flow</h3>
        <div className="segmented">
          <button className={flow === 0 ? 'on' : ''} onClick={() => pickFlow(0)}>House picture</button>
          <button className={flow === 1 ? 'on' : ''} onClick={() => pickFlow(1)}>Diagram</button>
        </div>
        <p className="muted small-text">You can also swipe between them on the Home screen.</p>
      </div>
      <div className="card form">
        <h3 className="card-title">Storage</h3>
        <p className="muted small-text">If the app looks out of date, clear its saved files and load the newest version.</p>
        <button className="btn ghost" onClick={clearCache}>Clear cache</button>
        {cacheMsg && <p className="note ok">{cacheMsg}</p>}
      </div>
      <div className="card list">
        <a className="list-row" href="/privacy.html" target="_blank" rel="noreferrer"><span className="list-text"><b>Privacy Policy</b></span><ChevronIcon className="muted" size={20} /></a>
        <a className="list-row" href="/terms.html" target="_blank" rel="noreferrer"><span className="list-text"><b>User Terms</b></span><ChevronIcon className="muted" size={20} /></a>
        {user?.role !== 'admin' && <button className="list-row danger" onClick={() => push(DeleteAccount, { user, onLogout })}>
          <span className="list-text"><b>Delete account</b></span><ChevronIcon className="muted" size={20} /></button>}
      </div>
    </Page>
  );
}

function DeleteAccount({ user, onLogout }) {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function del(e) {
    e.preventDefault();
    if (!confirm('Delete your Voltra account for good? This cannot be undone.')) return;
    setBusy(true); setMsg(null);
    const r = await fetch('/api/me/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(b.error || 'Could not delete the account.');
    onLogout ? onLogout() : location.reload();
  }
  return (
    <Page title="Delete account">
      <form className="card form" onSubmit={del}>
        <p>This deletes your Voltra app account <b>{user?.login}</b> and your settings. Your solar system keeps working, and its data stays in SolaX Cloud.</p>
        <label className="field"><span className="muted">Enter your password to confirm</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {msg && <p className="note err-text">{msg}</p>}
        <button className="btn danger" disabled={busy}>{busy ? 'Deleting…' : 'Delete my account'}</button>
      </form>
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
