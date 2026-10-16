import { useMemo, useState } from 'react';
import { useApi, fmt, modelName, power } from '../api.js';
import { useNav, Page } from '../nav.jsx';
import Header from '../components/Header.jsx';
import { WifiIcon, TopologyIcon } from '../components/Icons.jsx';
import { usePlantSetting } from '../settings.js';
import { StatsPanel } from './Stats.jsx';
import { BatteryHeating } from './Control.jsx';
import { WorkMode } from './Intelligence.jsx';
import RemoteSettings from './RemoteSettings.jsx';

export default function Device({ plant, goTab }) {
  const { push } = useNav();
  const overview = useApi(`/api/plants/${plant.plantId}/overview`, 60 * 1000);
  const [names] = usePlantSetting(plant.plantId, 'deviceNames', {});
  const headerActions = <button className="icon-btn" aria-label="Topology" onClick={() => overview.data && push(Topology, { plant, cards: buildCards(overview.data, names) })}><TopologyIcon size={28} /></button>;

  if (!overview.data) {
    return <><Header plant={plant} actions={headerActions} />
      {overview.error ? <div className="empty err">{overview.error.message}</div>
        : <div className="device-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 150, borderRadius: 18 }} />)}</div>}</>;
  }
  const cards = buildCards(overview.data, names);
  return (
    <>
      <Header plant={plant} actions={headerActions} />
      <div className="device-grid">
        {cards.map((c, i) => (
          <button key={c.key} className="card device-card pop-in" style={{ animationDelay: `${i * 60}ms` }} onClick={() => push(DeviceDetail, { plant, card: c })}>
            <div className="device-top"><DeviceArt kind={c.kind} /><WifiIcon className={c.online ? 'ok' : 'muted'} /></div>
            <b>{c.name}</b>
            <span className="muted">{c.sn}</span>
            <span className="device-live"><Live value={c.summary} /></span>
          </button>
        ))}
      </div>
    </>
  );
}

// Realtime Power = AC output on-grid + EPS (backup) output, as the SolaX app shows it.
export const inverterPower = (l = {}) => sum([l.acPower1, l.acPower2, l.acPower3, l.EPSL1ActivePower, l.EPSL2ActivePower, l.EPSL3ActivePower]);
const watts = (w) => { const [n, u] = power(w ?? 0); return `${n} ${u}`; };

export function buildCards({ devices, inverters, batteries, batteryDevices = [] }, names = {}) {
  const cards = devices.flatMap((d) => {
    const live = inverters.find((i) => i.deviceSn === d.deviceSn) || {};
    const online = d.onlineStatus === 1;
    return [
      { key: d.deviceSn, kind: 'inverter', model: modelName(d.deviceModel), name: names?.[d.deviceSn] || modelName(d.deviceModel), sn: d.deviceSn, online, device: d, live, battery: batteries[0],
        summary: online ? watts(inverterPower(live)) : 'Offline' },
      d.registerNo && { key: d.registerNo, kind: 'dongle', model: 'WiFi 4.0', name: names?.[d.registerNo] || 'WiFi Dongle', sn: d.registerNo, online, device: d, live,
        summary: online ? 'Online' : 'Offline' },
    ].filter(Boolean);
  });
  if (batteries[0]) {
    const inv = devices[0], b = batteries[0], info = batteryDevices[0] || {};
    const sn = info.deviceSn || b.deviceSn;
    cards.push({ key: 'battery', kind: 'battery', model: BATTERY_TYPE[info.batteryType] || 'Battery', name: names?.[sn || 'battery'] || 'Battery', sn: sn || `Connected to ${inv?.deviceSn}`, nameKey: sn || 'battery',
      online: (info.onlineStatus ?? 1) === 1, live: b, device: inv, info,
      summary: `${fmt(b.batterySOC, 0)}% · ${watts(Math.abs(b.chargeDischargePower ?? 0))}` });
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
// Every value SolaX Cloud sends, grouped like the SolaX app. Signs: grid + = export, battery + = charging.
const BATTERY_TYPE = { 0: 'Lead-acid', 1: 'Lithium' };
const SECTIONS = {
  inverter: (l, d, card) => {
    const bat = card.battery;
    return [
      { title: 'PV', tiles: [['PV Power', l.MPPTTotalInputPower, 'W', 0], ['PV Yield Today', l.dailyYield, 'kWh', 2], ['PV Yield Total', l.totalYield, 'kWh', 1]],
        table: { head: ['MPPT', 'Voltage (V)', 'Current (A)', 'Power (W)'], rows: mpptRows(l.mpptMap) },
        table2: { head: ['String', 'Voltage (V)', 'Current (A)', 'Power (W)'], rows: mpptRows(l.pvMap, 'pv', 'PV') } },
      bat && { title: 'Battery', tiles: [['SOC', bat.batterySOC, '%', 0], [(bat.chargeDischargePower ?? 0) >= 0 ? 'Charging' : 'Discharging', Math.abs(bat.chargeDischargePower ?? 0), 'W', 0],
        ['Voltage', bat.batteryVoltage, 'V', 1], ['Current', bat.batteryCurrent, 'A', 1], ['Temperature', bat.batteryTemperature, '°C', 0], ['Remaining', bat.batteryRemainings, 'kWh', 2]] },
      { title: 'AC (On-grid)', tiles: [['Active Power', l.totalActivePower ?? sum([l.acPower1, l.acPower2, l.acPower3]), 'W', 0], ['Reactive Power', l.totalReactivePower, 'var', 0],
        ['Power Factor', l.totalPowerFactor, '', 2], ['Grid Frequency', l.gridFrequency ?? l.acFrequency1, 'Hz', 2]],
        table: { head: ['Phase', 'Voltage (V)', 'Current (A)', 'Power (W)', 'Freq (Hz)'],
          rows: [1, 2, 3].map((n) => [`L${n}`, fmt(l[`acVoltage${n}`], 1), fmt(l[`acCurrent${n}`]), fmt(l[`acPower${n}`], 0), fmt(l[`acFrequency${n}`])]) },
        info: [['L1-L2 Voltage', unit(l.l1l2Voltage, 'V')], ['L2-L3 Voltage', unit(l.l2l3Voltage, 'V')], ['L1-L3 Voltage', unit(l.l1l3Voltage, 'V')]] },
      { title: 'Grid / Meter', tiles: [[(l.gridPower ?? 0) >= 0 ? 'Exporting' : 'Importing', Math.abs(l.gridPower ?? 0), 'W', 0],
        ['Imported Today', l.todayImportEnergy, 'kWh', 2], ['Exported Today', l.todayExportEnergy, 'kWh', 2], ['Imported Total', l.totalImportEnergy, 'kWh', 1], ['Exported Total', l.totalExportEnergy, 'kWh', 1],
        ...(l.gridPowerM2 || l.totalImportEnergyM2 || l.totalExportEnergyM2 ? [['Meter 2 Power', l.gridPowerM2, 'W', 0], ['Meter 2 Imported', l.totalImportEnergyM2, 'kWh', 1], ['Meter 2 Exported', l.totalExportEnergyM2, 'kWh', 1]] : [])] },
      { title: 'EPS (Backup)', tiles: [['EPS Power', sum([1, 2, 3].map((n) => l[`EPSL${n}ActivePower`])), 'W', 0]],
        table: { head: ['Phase', 'Voltage (V)', 'Current (A)', 'Power (W)', 'Apparent (VA)'],
          rows: [1, 2, 3].map((n) => [`L${n}`, fmt(l[`EPSL${n}Voltage`], 1), fmt(l[`EPSL${n}Current`]), fmt(l[`EPSL${n}ActivePower`], 0), fmt(l[`EPSL${n}ApparentPower`], 0)]) } },
      { title: 'Energy', tiles: [['AC Output Today', l.dailyACOutput, 'kWh', 2], ['AC Output Total', l.totalACOutput, 'kWh', 1], ['AC Input Today', l.dailyACInput, 'kWh', 2], ['AC Input Total', l.totalACInput, 'kWh', 1]] },
      { title: 'Inverter', tiles: [['Temperature', l.inverterTemperature, '°C', 1], ['Rated Power', d.ratedPower, 'kW', 1]],
        info: [['Status code', l.deviceStatus], ['Firmware ARM', d.armVersion], ['Firmware DSP', d.dspVersion]] },
    ].filter(Boolean);
  },
  battery: (l, _d, card, plant) => {
    const w = l.chargeDischargePower ?? 0;
    const cap = Number(card.info?.ratedCapacity) || Number(plant?.batteryCapacity) || null;
    const hours = (kwh) => { if (!(kwh > 0) || Math.abs(w) < 5) return '--'; const h = kwh / (Math.abs(w) / 1000); return h > 99 ? '> 99 h' : `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`; };
    return [
      { title: 'Battery Data', tiles: [['SOC', l.batterySOC, '%', 0], [w >= 0 ? 'Charging Power' : 'Discharging Power', Math.abs(w), 'W', 0], ['Remaining', l.batteryRemainings, 'kWh', 2],
        ['Voltage', l.batteryVoltage, 'V', 1], ['Current', l.batteryCurrent, 'A', 1], ['Temperature', l.batteryTemperature, '°C', 0]] },
      { title: 'BMS', tiles: [['SOH', l.batterySOH, '%', 0], ['Cycles (BMS)', l.batteryCycleTimes, '', 0], ['Total Charged', l.totalDeviceCharge, 'kWh', 1], ['Total Discharged', l.totalDeviceDischarge, 'kWh', 1]],
        info: [
          ['BMS State', Math.abs(w) < 5 ? 'Standby' : w > 0 ? 'Charging' : 'Discharging'],
          ['Battery Type', BATTERY_TYPE[card.info?.batteryType] ?? card.info?.batteryType],
          ['Usable Capacity', cap ? `${cap} kWh` : null],
          ['Pack Power (V × A)', l.batteryVoltage != null && l.batteryCurrent != null ? `${fmt(l.batteryVoltage * l.batteryCurrent, 0)} W` : null],
          [w > 0 ? 'Time to full' : 'Time to empty', w > 0 ? hours(cap && l.batterySOC != null ? cap * (100 - l.batterySOC) / 100 : null) : hours(l.batteryRemainings)],
          ['Round-trip (discharged ÷ charged)', l.totalDeviceCharge > 0 ? `${fmt((l.totalDeviceDischarge / l.totalDeviceCharge) * 100, 0)} %` : null],
          ['Equivalent full cycles', cap && l.totalDeviceDischarge != null ? fmt(l.totalDeviceDischarge / cap, 1) : null],
          ['BMS status code', l.deviceStatus],
          ['Hardware Version', card.info?.hardwareVersion || null], ['Software Version', card.info?.softwareVersion || null],
        ].filter(([, v]) => v != null && v !== ''),
        note: 'Cell voltages and cell temperatures are not sent to SolaX Cloud by this battery, so they can only be read on site.' },
    ];
  },
  dongle: () => [],
};
const unit = (v, u) => (v == null ? null : `${fmt(v, 1)} ${u}`);
const sum = (a) => (a.every((v) => v == null) ? null : a.reduce((x, v) => x + (v || 0), 0));
function mpptRows(map = {}, lower = 'mppt', upper = 'MPPT') {
  const re = new RegExp(`^${lower}(\\d+)`, 'i');
  const n = new Set(Object.keys(map || {}).map((k) => k.match(re)?.[1]).filter(Boolean));
  return [...n].sort((a, b) => a - b).map((i) => {
    const g = (f) => map[`${lower}${i}${f}`] ?? map[`${upper}${i}${f}`];
    return [`${upper}${i}`, fmt(g('Voltage'), 1), fmt(g('Current')), fmt(g('Power'), 0)];
  });
}

const CURVE_FIELDS = {
  inverter: [['MPPTTotalInputPower', 'PV Power (W)'], ['gridPower', 'Grid Power (W)'], ['acPower1', 'AC Power L1 (W)'], ['acVoltage1', 'AC Voltage L1 (V)'], ['inverterTemperature', 'Temperature (°C)']],
  battery: [['batterySOC', 'SOC (%)'], ['chargeDischargePower', 'Power (W)'], ['batteryVoltage', 'Voltage (V)'], ['batteryTemperature', 'Temperature (°C)']],
};

export { DeviceDetail as DeviceDetailPage };
function DeviceDetail({ plant, card: first }) {
  const { push } = useNav();
  const [view, setView] = useState('data');
  // Keep the numbers fresh while the page is open (the cloud updates every few minutes).
  const overview = useApi(`/api/plants/${plant.plantId}/overview`, 60 * 1000);
  const [names, saveNames] = usePlantSetting(plant.plantId, 'deviceNames', {});
  const card = (overview.data && buildCards(overview.data, names).find((c) => c.key === first.key)) || first;
  const caps = useApi(`/api/capabilities?plant=${plant.plantId}`);
  const l = card.live || {}, d = card.device || {};
  const updated = l.plantLocalTime || overview.data?.inverters?.[0]?.plantLocalTime;

  const realtime = {
    inverter: [['Realtime Power', fmt(inverterPower(l), 0), 'W'], ['Total Produced Today', fmt(l.dailyACOutput ?? l.dailyYield), 'kWh']],
    battery: [[(l.chargeDischargePower ?? 0) >= 0 ? 'Charging Power' : 'Discharging Power', fmt(Math.abs(l.chargeDischargePower ?? 0), 0), 'W'], ['SOC', fmt(l.batterySOC, 0), '%']],
    dongle: null,
  }[card.kind];

  const F = (title, icon, page, extra) => ({ title, icon, page, extra });
  const functions = {
    inverter: [F('Remote Settings', <FnRemote />, RemoteSettings), F('Work Mode', <FnMode />, WorkMode), F('Device Replacement', <FnSwap />, ServiceRequest, SERVICE.replacement), F('Backup Password', <FnLock />, BackupPassword)],
    dongle: [F('Reconfigure', <FnWifi />, ServiceRequest, SERVICE.reconfigure), F('Local Access', <FnPhone />, ServiceRequest, SERVICE.local_access), F('Backup Password', <FnLock />, BackupPassword), F('Device Replacement', <FnSwap />, ServiceRequest, SERVICE.replacement)],
    battery: [F('Battery Heating', <FnHeat />, BatteryHeating), F('Device Replacement', <FnSwap />, ServiceRequest, SERVICE.replacement)],
  }[card.kind];

  const info = {
    inverter: [['Device Model', card.model], ['Registration no.', d.registerNo, true], ['Rated Power', d.ratedPower != null ? `${d.ratedPower} kW` : null], ['Firmware ARM', d.armVersion], ['Firmware DSP', d.dspVersion]],
    dongle: [['Associated SN', d.deviceSn, true], ['Device Model', card.model], ['Registration no.', d.registerNo, true]],
    battery: [['Battery Type', BATTERY_TYPE[card.info?.batteryType] ?? null], ['Rated Capacity', card.info?.ratedCapacity != null ? `${card.info.ratedCapacity} kWh` : null], ['Hardware Version', card.info?.hardwareVersion], ['Software Version', card.info?.softwareVersion], ['Connected Inverter', d.deviceSn, true]],
  }[card.kind];

  return (
    <Page title={card.name} subtitle={`SN: ${card.sn}`}>
      <div className="device-hero card">
        <div><span className="muted small-text">SN</span><p className="device-sn">{card.sn}</p></div>
        <DeviceArt kind={card.kind} />
      </div>

      <div className="card">
        <h3 className="card-title">Realtime Data</h3>
        {realtime && <div className="data-tiles two">{realtime.map(([label, v, unit]) => (
          <div key={label} className="data-tile"><span className="muted">{label}</span><b className="big"><Live value={v} /> <small>{unit}</small></b></div>
        ))}</div>}
        <table className="kv soft-kv"><tbody>
          <tr><td>Working Status</td><td className={card.online ? 'ok-text' : 'muted'}>{card.online ? 'Online' : 'Offline'}</td></tr>
          <tr><td>Update Time</td><td>{updated || '--'}</td></tr>
        </tbody></table>
      </div>

      <div className="card">
        <h3 className="card-title">Function Control</h3>
        <div className="fn-grid">
          {functions.map((f) => (
            <button key={f.title} className="fn" onClick={() => push(f.page, { plant, card, caps: caps.data, ...f.extra })}>
              <span className="fn-icon">{f.icon}</span><span>{f.title}</span>
            </button>
          ))}
        </div>
      </div>

      {card.kind !== 'dongle' && (
        <div className="segmented sticky-tabs">
          <button className={view === 'data' ? 'on' : ''} onClick={() => setView('data')}>Overview</button>
          {card.kind === 'inverter' && <button className={view === 'stats' ? 'on' : ''} onClick={() => setView('stats')}>Statistics</button>}
          <button className={view === 'curve' ? 'on' : ''} onClick={() => setView('curve')}>Curve</button>
        </div>
      )}
      {card.kind !== 'dongle' && (view === 'curve' ? <Curve plant={plant} card={card} />
        : view === 'stats' ? <div className="card"><StatsPanel plant={plant} /></div>
        : <DataSections card={card} plant={plant} />)}

      <DeviceInfo card={card} rows={info} onRename={(name) => saveNames({ ...(names || {}), [card.nameKey || card.sn]: name || undefined })} />
    </Page>
  );
}

// Device Name (editable, like SolaX's pencil), serial numbers with a copy button, model and firmware.
function DeviceInfo({ card, rows, onRename }) {
  const [edit, setEdit] = useState(null);
  const [copied, setCopied] = useState(null);
  const copy = async (v) => { try { await navigator.clipboard.writeText(v); setCopied(v); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ } };
  return (
    <div className="card">
      <table className="kv info-kv"><tbody>
        <tr><td>Device Name</td><td>
          {edit != null ? (
            <form className="inline-edit" onSubmit={(e) => { e.preventDefault(); onRename(edit.trim().slice(0, 40)); setEdit(null); }}>
              <input value={edit} maxLength={40} autoFocus onChange={(e) => setEdit(e.target.value)} aria-label="Device name" />
              <button className="text-btn">Save</button>
            </form>
          ) : <button className="value-btn" onClick={() => setEdit(card.name)}>{card.name} <PencilIcon /></button>}
        </td></tr>
        {rows.filter(([, v]) => v != null && v !== '').map(([k, v, canCopy]) => (
          <tr key={k}><td>{k}</td><td>{canCopy
            ? <button className="value-btn" onClick={() => copy(String(v))}>{v} {copied === String(v) ? <span className="ok-text small-text">Copied</span> : <CopyIcon />}</button>
            : v}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

const SERVICE = {
  replacement: { kind: 'replacement', title: 'Device Replacement', button: 'Request replacement',
    intro: 'If this device is faulty, Voltra replaces it on site and moves your system\'s history to the new device, so nothing is lost.',
    steps: ['Send a request below (or call Voltra).', 'A Voltra engineer checks the alarm history and contacts you.', 'After the swap your app keeps working as before.'] },
  reconfigure: { kind: 'reconfigure', title: 'Reconfigure', button: 'Ask Voltra to reconfigure',
    intro: 'Reconfigure connects the WiFi dongle to a new router or a changed WiFi password. It has to be done next to the dongle over Bluetooth, which phone browsers cannot do, so Voltra does it for you.',
    steps: ['Keep your new WiFi name and password ready.', 'Send a request below. Voltra calls you and connects the dongle (usually within a day).', 'Once it is back online, data appears here again within 5 minutes.'] },
  local_access: { kind: 'local_access', title: 'Local Access', button: 'Request local access help',
    intro: 'Local Access talks to the inverter directly over Bluetooth, without internet. Phone browsers cannot use Bluetooth for this, so it will come with the Voltra phone app. Until then Voltra can make local changes for you.',
    steps: ['Tell us what you need changed (optional).', 'Send the request. Voltra contacts you and does it on site or by phone.'] },
};

// Device Replacement / Reconfigure / Local Access: done on site by Voltra; the app sends the request.
function ServiceRequest({ plant, card, kind, title, button, intro, steps }) {
  const { pop } = useNav();
  const [note, setNote] = useState('');
  const [state, setState] = useState(null);
  async function send(e) {
    e.preventDefault();
    setState('busy');
    const r = await fetch(`/api/plants/${plant.plantId}/service-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, deviceSn: card.sn, note }) });
    setState(r.ok ? 'sent' : 'error');
  }
  return (
    <Page title={title} subtitle={`SN: ${card.sn}`}>
      <div className="card form">
        <p>{intro}</p>
        <ol className="bullets">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      </div>
      {state === 'sent' ? (
        <div className="card form"><p className="note ok">Request sent. Voltra will contact you shortly.</p><button className="btn" onClick={pop}>Done</button></div>
      ) : (
        <form className="card form" onSubmit={send}>
          <label className="field"><span className="muted">Details (optional)</span>
            <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that helps us, e.g. error code or new WiFi name" /></label>
          {state === 'error' && <p className="note err-text">Could not send. Please try again or call Voltra.</p>}
          <button className="btn" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : button}</button>
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
const FnWifi = F(<><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" /><circle cx="12" cy="19" r="1" /></>);
const FnPhone = F(<><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>);
const FnHeat = F(<><path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z" /><path d="M12 11v6" /></>);
const PencilIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>;
const CopyIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>;
const FnLock = F(<><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" /><circle cx="12" cy="11" r="2" /><path d="M12 13v3" /></>);

// Every data point of one device, grouped like SolaX (PV / AC / Grid / EPS / Energy / Device).
export function DataSections({ card, plant }) {
  return SECTIONS[card.kind](card.live || {}, card.device || {}, card, plant).map((s) => (
    <div key={s.title} className="card">
      <h3 className="card-title">{s.title}</h3>
      {s.tiles && <div className="data-tiles">{s.tiles.map(([label, v, unit, d]) => (
        <div key={label} className="data-tile"><span className="muted">{label}</span><b><Live value={fmt(v, d)} /> <small>{unit}</small></b></div>
      ))}</div>}
      {s.table && s.table.rows.length > 0 && (
        <table className="report compact"><thead><tr>{s.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{s.table.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table>
      )}
      {s.table2 && s.table2.rows.length > 0 && (
        <table className="report compact"><thead><tr>{s.table2.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{s.table2.rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table>
      )}
      {s.info && <table className="kv"><tbody>{s.info.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v ?? '--'}</td></tr>)}</tbody></table>}
      {s.note && <p className="muted small-text">{s.note}</p>}
    </div>
  ));
}

// A number that flashes briefly when a new reading changes it.
export function Live({ value }) {
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
  const pts = useMemo(() => toPoints(res.data?.rows, (r) => r[field]), [res.data, field]);
  return (
    <div className="card">
      <label className="field"><span className="muted">Data point</span>
        <select value={field} onChange={(e) => setField(e.target.value)}>{fields.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {!res.data ? <div className="empty">Loading…</div> : <LineChart pts={pts} label={fields.find((f) => f[0] === field)[1]} />}
    </div>
  );
}

// Rows with plantLocalTime → [{ min (minute of day), v, t (HH:MM) }], skipping empty readings.
export const toPoints = (rows = [], get) => (rows ?? []).map((r) => {
  const v = get(r);
  if (v == null) return null;
  const t = (r.plantLocalTime || r.time).slice(11, 16);
  const [h, m] = t.split(':').map(Number);
  return { min: h * 60 + m, v, t };
}).filter(Boolean);

// One series over a day (00:00–24:00) with a touch/hover crosshair.
export function LineChart({ pts, label, color = '#14b8a6', fill }) {
  const [hover, setHover] = useState(null);
  const W = 340, H = 200, L = 40, R = 8, T = 10, B = 24;
  const lo = Math.min(0, ...pts.map((p) => p.v)), hi = Math.max(1, ...pts.map((p) => p.v));
  const pad = (hi - lo) * 0.1 || 1, top = hi + pad, bot = lo < 0 ? lo - pad : 0;
  const x = (m) => L + (m / 1440) * (W - L - R), y = (v) => T + ((top - v) / (top - bot)) * (H - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.min).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const area = pts.length ? `${d}L${x(pts.at(-1).min).toFixed(1)},${y(Math.max(bot, 0))}L${x(pts[0].min).toFixed(1)},${y(Math.max(bot, 0))}Z` : '';
  const ticks = Array.from({ length: 5 }, (_, i) => bot + ((top - bot) * i) / 4);
  return (
    <div className="graph-plot" onPointerLeave={() => setHover(null)} onPointerMove={(e) => {
      if (!pts.length) return;
      const b = e.currentTarget.getBoundingClientRect(); const m = (((e.clientX - b.left) / b.width) * W - L) / (W - L - R) * 1440;
      setHover(pts.reduce((a, p) => (Math.abs(p.min - m) < Math.abs(a.min - m) ? p : a), pts[0]));
    }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg" role="img" aria-label={`${label} today`}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid-line" />
          <text x={L - 5} y={y(t) + 3} textAnchor="end" className="tick">{Math.abs(t) >= 100 ? Math.round(t) : t.toFixed(1)}</text></g>)}
        {[0, 240, 480, 720, 960, 1200].map((m) => <text key={m} x={x(m)} y={H - 6} textAnchor="middle" className="tick">{String(m / 60).padStart(2, '0')}:00</text>)}
        {fill && area && <path d={area} fill={color} opacity="0.12" />}
        <path d={d} fill="none" stroke={color} strokeWidth="2" className="draw-in" />
        {hover && <><line x1={x(hover.min)} x2={x(hover.min)} y1={T} y2={H - B} className="crosshair" />
          <circle cx={x(hover.min)} cy={y(hover.v)} r="4" fill={color} stroke="#fff" strokeWidth="2" /></>}
      </svg>
      {hover && <div className="tooltip" style={{ left: `${Math.min(65, Math.max(2, (x(hover.min) / W) * 100 - 15))}%` }}>
        <div className="tooltip-time">{hover.t}</div><div className="tooltip-row">{label}<b>{hover.v}</b></div></div>}
      {!pts.length && <div className="graph-empty">No data today</div>}
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
