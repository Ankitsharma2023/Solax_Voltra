import { useMemo, useState } from 'react';
import { useApi, fmt, modelName } from '../api.js';
import { useNav, Page } from '../nav.jsx';
import Header from '../components/Header.jsx';
import { WifiIcon, TopologyIcon } from '../components/Icons.jsx';
import { StatsPanel } from './Stats.jsx';
import { RemoteControl } from './Control.jsx';
import { WorkMode } from './Intelligence.jsx';

export default function Device({ plant, goTab }) {
  const { push } = useNav();
  const overview = useApi(`/api/plants/${plant.plantId}/overview`, 5 * 60 * 1000);
  const headerActions = <button className="icon-btn" aria-label="Topology" onClick={() => overview.data && push(Topology, { plant, cards: buildCards(overview.data) })}><TopologyIcon size={28} /></button>;

  if (!overview.data) {
    return <><Header plant={plant} actions={headerActions} />
      {overview.error ? <div className="empty err">{overview.error.message}</div>
        : <div className="device-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 18 }} />)}</div>}</>;
  }
  const cards = buildCards(overview.data);
  return (
    <>
      <Header plant={plant} actions={headerActions} />
      <div className="device-grid">
        {cards.map((c, i) => (
          <button key={c.key} className="card device-card pop-in" style={{ animationDelay: `${i * 60}ms` }} onClick={() => push(DeviceDetail, { plant, card: c })}>
            <div className="device-top"><DeviceArt kind={c.kind} /><WifiIcon className={c.online ? 'ok' : 'muted'} /></div>
            <b>{c.name}</b>
            <span className="muted">{c.sn}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function buildCards({ devices, inverters, batteries }) {
  const cards = devices.flatMap((d) => {
    const live = inverters.find((i) => i.deviceSn === d.deviceSn) || {};
    const online = d.onlineStatus === 1;
    return [
      { key: d.deviceSn, kind: 'inverter', name: modelName(d.deviceModel), sn: d.deviceSn, online, device: d, live },
      d.registerNo && { key: d.registerNo, kind: 'dongle', name: 'WiFi Dongle', sn: d.registerNo, online, device: d },
    ].filter(Boolean);
  });
  if (batteries[0]) {
    const inv = devices[0];
    cards.push({ key: 'battery', kind: 'battery', name: 'Battery', sn: batteries[0].deviceSn || `via ${inv?.deviceSn}`, online: true, live: batteries[0], device: inv });
  }
  return cards;
}

export function DeviceArt({ kind, size = 1 }) {
  const s = { transform: `scale(${size})`, transformOrigin: 'left top' };
  if (kind === 'dongle') return (
    <svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true" style={s}>
      <rect x="15" y="2" width="14" height="6" rx="2" fill="#7b838c" /><rect x="12" y="6" width="20" height="46" rx="5" fill="#4b525a" />
      <rect x="17" y="22" width="10" height="10" rx="1.5" fill="#9aa2aa" />
    </svg>
  );
  if (kind === 'battery') return (
    <svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true" style={s}>
      <rect x="8" y="4" width="28" height="48" rx="4" fill="#d9f5ef" stroke="#9fdccf" />
      {[14, 22, 30, 38].map((y) => <line key={y} x1="10" x2="34" y1={y} y2={y} stroke="#8ed3c4" />)}
    </svg>
  );
  return (
    <svg width="64" height="56" viewBox="0 0 64 56" aria-hidden="true" style={s}>
      <rect x="4" y="8" width="56" height="36" rx="4" fill="#f4f6f8" stroke="#d8dee4" />
      <rect x="27" y="18" width="10" height="10" rx="1.5" fill="none" stroke="#8a939c" /><path d="M29 26l6-6" stroke="#8a939c" />
      {[14, 20, 26].map((x) => <rect key={x} x={x} y="44" width="3" height="5" fill="#8a939c" />)}
    </svg>
  );
}

// ---------- detail: Live Data (sections) + Curve ----------
const SECTIONS = {
  inverter: (l, d) => [
    { title: 'PV Data', tiles: [['PV Power', l.MPPTTotalInputPower, 'W', 0]],
      table: { head: ['MPPT', 'Voltage (V)', 'Current (A)', 'Power (W)'], rows: mpptRows(l.mpptMap) } },
    { title: 'AC Data', tiles: [['AC Power (On-grid)', sum([l.acPower1, l.acPower2, l.acPower3]), 'W', 0], ['Power Factor', l.totalPowerFactor, '', 2]],
      table: { head: ['AC', 'Voltage (V)', 'Current (A)', 'Frequency (Hz)'],
        rows: [1, 2, 3].map((n) => [`L${n}`, fmt(l[`acVoltage${n}`], 1), fmt(l[`acCurrent${n}`]), fmt(l[`acFrequency${n}`])]) } },
    { title: 'Grid Data', tiles: [['Grid Power', l.gridPower, 'W', 0], ['Imported Today', l.todayImportEnergy, 'kWh', 2], ['Exported Today', l.todayExportEnergy, 'kWh', 2]] },
    { title: 'EPS Data', tiles: [1, 2, 3].map((n) => [`EPS L${n} Power`, l[`EPSL${n}ActivePower`], 'W', 0]) },
    { title: 'Energy', tiles: [['Today AC Output', l.dailyACOutput, 'kWh', 2], ['Total AC Output', l.totalACOutput, 'kWh', 2], ['Today PV Yield', l.dailyYield, 'kWh', 2], ['Total PV Yield', l.totalYield, 'kWh', 2]] },
    { title: 'Device', tiles: [['Temperature', l.inverterTemperature, '°C', 1], ['Rated Power', d.ratedPower, 'kW', 1]],
      info: [['Firmware ARM', d.armVersion], ['Firmware DSP', d.dspVersion], ['Registration No.', d.registerNo]] },
  ],
  battery: (l) => [
    { title: 'Battery Data', tiles: [['SOC', l.batterySOC, '%', 0], ['Power', l.chargeDischargePower, 'W', 0], ['Remaining', l.batteryRemainings, 'kWh', 2],
      ['Voltage', l.batteryVoltage, 'V', 1], ['Current', l.batteryCurrent, 'A', 1], ['Temperature', l.batteryTemperature, '°C', 0]] },
    { title: 'Health', tiles: [['SOH', l.batterySOH, '%', 0], ['Cycles', l.batteryCycleTimes, '', 0], ['Total Charged', l.totalDeviceCharge, 'kWh', 1], ['Total Discharged', l.totalDeviceDischarge, 'kWh', 1]] },
  ],
  dongle: (l, d) => [{ title: 'Dongle', info: [['Registration No.', d.registerNo], ['Type', 'WiFi 4.0'], ['Connected inverter', d.deviceSn]] }],
};
const sum = (a) => (a.every((v) => v == null) ? null : a.reduce((x, v) => x + (v || 0), 0));
function mpptRows(map = {}) {
  const n = new Set(Object.keys(map).map((k) => k.match(/mppt(\d+)/i)?.[1]).filter(Boolean));
  return [...n].sort((a, b) => a - b).map((i) => {
    const g = (f) => map[`mppt${i}${f}`] ?? map[`MPPT${i}${f}`];
    return [`MPPT${i}`, fmt(g('Voltage'), 1), fmt(g('Current')), fmt(g('Power'), 0)];
  });
}

const CURVE_FIELDS = {
  inverter: [['MPPTTotalInputPower', 'PV Power (W)'], ['gridPower', 'Grid Power (W)'], ['acPower1', 'AC Power L1 (W)'], ['acVoltage1', 'AC Voltage L1 (V)'], ['inverterTemperature', 'Temperature (°C)']],
  battery: [['batterySOC', 'SOC (%)'], ['chargeDischargePower', 'Power (W)'], ['batteryVoltage', 'Voltage (V)'], ['batteryTemperature', 'Temperature (°C)']],
};

function DeviceDetail({ plant, card: first }) {
  const { push } = useNav();
  const [view, setView] = useState('data');
  // Keep the numbers fresh while the page is open (the cloud updates every few minutes).
  const overview = useApi(`/api/plants/${plant.plantId}/overview`, 60 * 1000);
  const card = (overview.data && buildCards(overview.data).find((c) => c.key === first.key)) || first;
  const caps = useApi(`/api/capabilities?plant=${plant.plantId}`);
  const isInverter = card.kind === 'inverter';
  const l = card.live || {};
  const realtime = card.kind === 'battery'
    ? [['Battery Power', fmt(l.chargeDischargePower, 0), 'W'], ['SOC', fmt(l.batterySOC, 0), '%']]
    : isInverter ? [['Realtime Power', fmt(sum([l.acPower1, l.acPower2, l.acPower3]) ?? l.MPPTTotalInputPower, 0), 'W'], ['Total Produced Today', fmt(l.dailyACOutput ?? l.dailyYield), 'kWh']] : null;
  const functions = [
    { title: 'Remote Settings', icon: <FnRemote />, page: RemoteControl },
    { title: 'Work Mode', icon: <FnMode />, page: WorkMode },
    { title: 'Device Replacement', icon: <FnSwap />, page: DeviceReplacement },
    { title: 'Backup Password', icon: <FnLock />, page: BackupPassword },
  ];
  return (
    <Page title={card.name} subtitle={`SN: ${card.sn}`}>
      <div className="device-hero card">
        <div><span className={card.online ? 'badge normal' : 'badge offline'}>{card.online ? '● Online' : 'Offline'}</span>
          {card.live?.plantLocalTime && <p className="muted small">Data from {card.live.plantLocalTime}</p>}</div>
        <DeviceArt kind={card.kind} />
      </div>

      {realtime && (
        <div className="card">
          <h3 className="card-title">Realtime Data</h3>
          <div className="data-tiles two">{realtime.map(([label, v, unit]) => (
            <div key={label} className="data-tile"><span className="muted">{label}</span><b className="big"><Live value={v} /> <small>{unit}</small></b></div>
          ))}</div>
        </div>
      )}

      {isInverter && (
        <div className="card">
          <h3 className="card-title">Function Control</h3>
          <div className="fn-grid">
            {functions.map((f) => (
              <button key={f.title} className="fn" onClick={() => push(f.page, { plant, card, caps: caps.data })}>
                <span className="fn-icon">{f.icon}</span><span>{f.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isInverter && (
        <div className="card">
          <h3 className="card-title">Statistical Information</h3>
          <StatsPanel plant={plant} />
        </div>
      )}

      {CURVE_FIELDS[card.kind] && (
        <div className="segmented">
          <button className={view === 'data' ? 'on' : ''} onClick={() => setView('data')}>Data point</button>
          <button className={view === 'curve' ? 'on' : ''} onClick={() => setView('curve')}>Curve</button>
        </div>
      )}
      {view === 'curve' ? <Curve plant={plant} card={card} /> : <DataSections card={card} />}
    </Page>
  );
}

// Device Replacement: the swap is done on site by Voltra / the installer; the app sends the request.
function DeviceReplacement({ plant, card }) {
  const { pop } = useNav();
  const [note, setNote] = useState('');
  const [state, setState] = useState(null);
  async function send(e) {
    e.preventDefault();
    setState('busy');
    const r = await fetch(`/api/plants/${plant.plantId}/service-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'replacement', deviceSn: card.sn, note }) });
    setState(r.ok ? 'sent' : 'error');
  }
  return (
    <Page title="Device Replacement" subtitle={`SN: ${card.sn}`}>
      <div className="card form">
        <p>If this inverter or its WiFi dongle is faulty, Voltra replaces it on site and moves your system's history to the new device, so nothing is lost.</p>
        <ol className="bullets">
          <li>Send a request below (or call Voltra).</li>
          <li>A Voltra engineer checks the alarm history and contacts you.</li>
          <li>After the swap your app keeps working as before.</li>
        </ol>
      </div>
      {state === 'sent' ? (
        <div className="card form"><p className="note ok">Request sent. Voltra will contact you shortly.</p><button className="btn" onClick={pop}>Done</button></div>
      ) : (
        <form className="card form" onSubmit={send}>
          <label className="field"><span className="muted">What is wrong? (optional)</span>
            <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: no display, error code, burnt smell…" /></label>
          {state === 'error' && <p className="note err-text">Could not send. Please try again or call Voltra.</p>}
          <button className="btn" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Request replacement'}</button>
          <a className="btn ghost" href="tel:+919992929203">Call Voltra · +91 99929 29203</a>
        </form>
      )}
    </Page>
  );
}

// Backup Password: keep the inverter's local settings password safe in the cloud for this plant.
function BackupPassword({ plant, caps }) {
  const res = useApi(`/api/plants/${plant.plantId}/backup-password`);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState(null);
  const saved = res.data?.value;
  async function save(value) {
    setMsg(null);
    const r = await fetch(`/api/plants/${plant.plantId}/backup-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) });
    if (!r.ok) return setMsg({ err: true, text: (await r.json().catch(() => ({}))).error || 'Could not save.' });
    setEdit(null); setMsg({ text: value ? 'Saved.' : 'Removed.' }); res.reload();
  }
  if (res.error) return <Page title="Backup Password"><p className="note">{res.error.message}</p></Page>;
  return (
    <Page title="Backup Password" subtitle={plant.plantName}>
      <p className="note">Keep the inverter's settings password here so you or your installer never lose it. Only people who may change this system can see it.</p>
      <div className="card form">
        {!res.data ? <div className="empty">Loading…</div> : edit != null ? (
          <form className="form" onSubmit={(e) => { e.preventDefault(); save(edit.trim()); }}>
            <label className="field"><span className="muted">Inverter password</span>
              <input value={edit} maxLength={64} autoComplete="off" onChange={(e) => setEdit(e.target.value)} autoFocus /></label>
            <button className="btn">Save</button>
            <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
          </form>
        ) : saved ? (
          <>
            <div className="secret-row"><b className="secret">{show ? saved : '•'.repeat(Math.max(6, saved.length))}</b>
              <button className="text-btn" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button></div>
            <p className="muted small-text">Saved by {res.data.by} on {res.data.at?.slice(0, 10)}</p>
            <button className="btn ghost" onClick={() => setEdit(saved)}>Change</button>
            <button className="btn ghost" onClick={() => confirm('Remove the saved password?') && save(null)}>Remove</button>
          </>
        ) : (
          <><p className="muted">No password saved yet.</p><button className="btn" onClick={() => setEdit('')}>Add password</button></>
        )}
        {msg && <p className={msg.err ? 'note err-text' : 'note ok'}>{msg.text}</p>}
      </div>
      {caps && !caps.mayControl && <p className="note">Your account can only view this system.</p>}
    </Page>
  );
}

const F = (d) => () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const FnRemote = F(<><rect x="3" y="4" width="15" height="11" rx="1.5" /><path d="M7 19h7" /><circle cx="17" cy="16" r="3.2" /><path d="M17 14.8v1.2l.8.8" /></>);
const FnMode = F(<><rect x="4" y="4" width="11" height="11" rx="2" /><rect x="9" y="9" width="11" height="11" rx="2" /></>);
const FnSwap = F(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M14 6h4v4M10 18H6v-4" /></>);
const FnLock = F(<><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" /><circle cx="12" cy="11" r="2" /><path d="M12 13v3" /></>);

// Every data point of one device, grouped like SolaX (PV / AC / Grid / EPS / Energy / Device).
export function DataSections({ card }) {
  return SECTIONS[card.kind](card.live || {}, card.device || {}).map((s) => (
    <div key={s.title} className="card">
      <h3 className="card-title">{s.title}</h3>
      {s.tiles && <div className="data-tiles">{s.tiles.map(([label, v, unit, d]) => (
        <div key={label} className="data-tile"><span className="muted">{label}</span><b><Live value={fmt(v, d)} /> <small>{unit}</small></b></div>
      ))}</div>}
      {s.table && s.table.rows.length > 0 && (
        <table className="report compact"><thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{s.table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table>
      )}
      {s.info && <table className="kv"><tbody>{s.info.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v ?? '--'}</td></tr>)}</tbody></table>}
    </div>
  ));
}

// A number that flashes briefly when a new reading changes it.
function Live({ value }) {
  const [prev, setPrev] = useState(value);
  const [flash, setFlash] = useState(0);
  if (value !== prev) { setPrev(value); setFlash((n) => n + 1); }
  return <span key={flash} className={flash ? 'live-flash' : undefined}>{value}</span>;
}

function Curve({ plant, card }) {
  const fields = CURVE_FIELDS[card.kind];
  const [field, setField] = useState(fields[0][0]);
  const sn = card.kind === 'battery' ? card.device?.deviceSn : card.sn;
  const res = useApi(`/api/plants/${plant.plantId}/devices/${sn}/history?type=${card.kind === 'battery' ? 2 : 1}`);
  const pts = useMemo(() => (res.data?.rows ?? []).filter((r) => r[field] != null)
    .map((r) => { const [h, m] = r.plantLocalTime.slice(11, 16).split(':').map(Number); return { min: h * 60 + m, v: r[field], t: r.plantLocalTime.slice(11, 16) }; }), [res.data, field]);
  const [hover, setHover] = useState(null);

  const W = 340, H = 200, L = 40, R = 8, T = 10, B = 24;
  const lo = Math.min(0, ...pts.map((p) => p.v)), hi = Math.max(1, ...pts.map((p) => p.v));
  const pad = (hi - lo) * 0.1 || 1, top = hi + pad, bot = lo < 0 ? lo - pad : 0;
  const x = (m) => L + (m / 1440) * (W - L - R), y = (v) => T + ((top - v) / (top - bot)) * (H - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.min).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const ticks = Array.from({ length: 5 }, (_, i) => bot + ((top - bot) * i) / 4);

  return (
    <div className="card">
      <label className="field"><span className="muted">Data point</span>
        <select value={field} onChange={(e) => setField(e.target.value)}>{fields.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {!res.data ? <div className="empty">Loading…</div> : (
        <div className="graph-plot" onPointerLeave={() => setHover(null)} onPointerMove={(e) => {
          const b = e.currentTarget.getBoundingClientRect(); const m = (((e.clientX - b.left) / b.width) * W - L) / (W - L - R) * 1440;
          setHover(pts.reduce((a, p) => (Math.abs(p.min - m) < Math.abs(a.min - m) ? p : a), pts[0]));
        }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg" role="img" aria-label="Device data curve">
            {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid-line" />
              <text x={L - 5} y={y(t) + 3} textAnchor="end" className="tick">{Math.abs(t) >= 100 ? Math.round(t) : t.toFixed(1)}</text></g>)}
            {[0, 240, 480, 720, 960, 1200].map((m) => <text key={m} x={x(m)} y={H - 6} textAnchor="middle" className="tick">{String(m / 60).padStart(2, '0')}:00</text>)}
            <path d={d} fill="none" stroke="#14b8a6" strokeWidth="2" className="draw-in" />
            {hover && <><line x1={x(hover.min)} x2={x(hover.min)} y1={T} y2={H - B} className="crosshair" />
              <circle cx={x(hover.min)} cy={y(hover.v)} r="4" fill="#14b8a6" stroke="#fff" strokeWidth="2" /></>}
          </svg>
          {hover && <div className="tooltip" style={{ left: `${Math.min(65, Math.max(2, (x(hover.min) / W) * 100 - 15))}%` }}>
            <div className="tooltip-time">{hover.t}</div><div className="tooltip-row">{fields.find((f) => f[0] === field)[1]}<b>{hover.v}</b></div></div>}
          {!pts.length && <div className="graph-empty">No data today</div>}
        </div>
      )}
    </div>
  );
}

function Topology({ plant, cards }) {
  const inv = cards.find((c) => c.kind === 'inverter'), dongle = cards.find((c) => c.kind === 'dongle'), bat = cards.find((c) => c.kind === 'battery');
  return (
    <Page title="Topology" subtitle={plant.plantName}>
      <div className="card topo">
        {dongle && <TopoNode card={dongle} />}
        {dongle && <div className="topo-link" />}
        {inv && <TopoNode card={inv} />}
        {bat && <div className="topo-link" />}
        {bat && <TopoNode card={bat} />}
      </div>
    </Page>
  );
}
const TopoNode = ({ card }) => (
  <div className="topo-node"><DeviceArt kind={card.kind} /><div><b>{card.name}</b><span className="muted">{card.sn}</span></div>
    <WifiIcon className={card.online ? 'ok' : 'muted'} size={20} /></div>
);
