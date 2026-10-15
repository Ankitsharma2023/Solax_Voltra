import { useEffect, useState } from 'react';
import { useApi, fmt } from '../api.js';
import { Page, useNav } from '../nav.jsx';

// ---------- sending commands ----------

export async function sendControl(plant, op, params) {
  const r = await fetch(`/api/plants/${plant.plantId}/control/${op}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || 'The command could not be sent.');
  return b;
}

// Button + confirmation + result line shared by every control screen.
export function SendBar({ plant, op, params, caps, confirmText, label = 'Apply to inverter', onSaved, disabled }) {
  const { push } = useNav();
  const [state, setState] = useState(null);
  const allowed = caps?.ops?.[op] && caps?.mayControl;
  async function go() {
    if (!confirm(confirmText)) return;
    setState({ busy: true });
    try {
      const e = await sendControl(plant, op, params);
      setState({ ok: true, text: `Sent ✓ — ${e.statusText}. Check Command History for the result.` });
      onSaved?.();
    } catch (err) { setState({ err: true, text: err.message }); }
  }
  return (
    <div className="send-bar">
      {state?.text && <p className={state.err ? 'note err-text' : 'note ok'}>{state.text}</p>}
      {!allowed && <p className="note">{!caps ? 'Checking permissions…' : !caps.mayControl ? 'Your account can view this plant but not change its settings.' : 'Commands to the inverter are not switched on yet. Settings are saved for this plant.'}</p>}
      <button className="btn danger-btn" disabled={!allowed || disabled || state?.busy} onClick={go}>{state?.busy ? 'Sending…' : label}</button>
      <button className="text-btn history-link" onClick={() => push(History, { plant })}>Command History ›</button>
    </div>
  );
}

// ---------- Export limit ----------

export function ExportLimit({ plant, caps }) {
  const ov = useApi(`/api/plants/${plant.plantId}/overview`);
  const rated = ov.data?.devices?.[0]?.ratedPower ?? 10;
  const [f, setF] = useState({ isEnable: 1, limitValue: 0 });
  return (
    <Page title="Export Limit" subtitle={plant.plantName}>
      <div className="card form">
        <p className="muted">Limits how much power the system sends to the grid. Set 0 kW for <b>zero export</b> (often required by the electricity board).</p>
        <label className="switch-row"><span><b>Export limit</b></span>
          <input type="checkbox" checked={!!f.isEnable} onChange={(e) => setF({ ...f, isEnable: e.target.checked ? 1 : 0 })} /></label>
        {!!f.isEnable && (
          <label className="slider">
            <span className="slider-head"><span>Maximum export</span><b>{fmt(f.limitValue, 1)} kW</b></span>
            <input type="range" min="0" max={rated} step="0.1" value={f.limitValue} onChange={(e) => setF({ ...f, limitValue: Number(e.target.value) })}
              style={{ '--p': `${(f.limitValue / rated) * 100}%` }} />
            <span className="muted small-text">0 – {rated} kW (inverter rating)</span>
          </label>
        )}
      </div>
      <SendBar plant={plant} op="export_limit" params={f} caps={caps}
        confirmText={f.isEnable ? `Limit export to the grid at ${plant.plantName} to ${f.limitValue} kW?` : `Turn OFF the export limit at ${plant.plantName}?`} />
    </Page>
  );
}

// ---------- Remote control (VPP) ----------

const RC_MODES = [
  { op: 'rc_self_consume', name: 'Self-consume', desc: 'Normal behaviour: battery charges from solar only and covers the home.' },
  { op: 'rc_zero', name: 'Battery idle', desc: 'Battery neither charges nor discharges; solar runs at full power.' },
  { op: 'rc_battery_power', name: 'Charge / discharge at set power', desc: 'Forces the battery to charge (+) or discharge (−) at a fixed power.' },
  { op: 'rc_soc_target', name: 'Battery to target %', desc: 'Charges or discharges until the battery reaches a target level.' },
];

export function RemoteControl({ plant, caps }) {
  const [op, setOp] = useState('rc_self_consume');
  const [f, setF] = useState({ minutes: 30, then: 'exit', batteryPower: 1000, targetSoc: 80, power: 1000 });
  const params = op === 'rc_soc_target' ? { targetSoc: f.targetSoc, power: f.power }
    : { durationS: f.minutes * 60, then: f.then, ...(op === 'rc_battery_power' && { batteryPower: f.batteryPower }) };
  const mode = RC_MODES.find((m) => m.op === op);
  const describe = op === 'rc_battery_power' ? `${f.batteryPower >= 0 ? 'charge' : 'discharge'} the battery at ${Math.abs(f.batteryPower)} W for ${f.minutes} min`
    : op === 'rc_soc_target' ? `move the battery to ${f.targetSoc}% at ${Math.abs(f.power)} W` : `switch to "${mode.name}" for ${f.minutes} min`;
  return (
    <Page title="Remote Control" subtitle={plant.plantName}>
      <p className="note">Temporary control for a set time. Afterwards the inverter returns to its normal work mode by itself.</p>
      <div className="mode-list">
        {RC_MODES.map((m) => (
          <button key={m.op} className={op === m.op ? 'card mode on' : 'card mode'} onClick={() => setOp(m.op)}>
            <span className="radio" /><span className="list-text"><b>{m.name}</b><span className="muted">{m.desc}</span></span>
          </button>
        ))}
      </div>
      <div className="card form">
        {op === 'rc_battery_power' && (
          <label className="field"><span className="muted">Battery power in W (+ charge, − discharge)</span>
            <input type="number" step="100" value={f.batteryPower} onChange={(e) => setF({ ...f, batteryPower: Number(e.target.value) })} /></label>
        )}
        {op === 'rc_soc_target' ? <>
          <label className="field"><span className="muted">Target battery level (%)</span>
            <input type="number" min="10" max="100" value={f.targetSoc} onChange={(e) => setF({ ...f, targetSoc: Number(e.target.value) })} /></label>
          <label className="field"><span className="muted">Power in W (+ charge, − discharge)</span>
            <input type="number" step="100" value={f.power} onChange={(e) => setF({ ...f, power: Number(e.target.value) })} /></label>
        </> : <>
          <label className="field"><span className="muted">Duration (minutes)</span>
            <input type="number" min="1" max="1440" value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} /></label>
          <label className="field"><span className="muted">When the time is up</span>
            <select value={f.then} onChange={(e) => setF({ ...f, then: e.target.value })}>
              <option value="exit">Exit remote control (back to normal work mode)</option>
              <option value="self_consume">Stay in remote "Self-consume"</option>
            </select></label>
        </>}
      </div>
      <SendBar plant={plant} op={op} params={params} caps={caps} label="Start" confirmText={`At ${plant.plantName}: ${describe}?`} />
      <SendBar plant={plant} op="rc_exit" params={{}} caps={caps} label="Stop remote control now" confirmText={`Stop remote control at ${plant.plantName} and return to the normal work mode?`} />
    </Page>
  );
}

// ---------- Battery heating ----------

export function BatteryHeating({ plant, caps }) {
  const [f, setF] = useState({ heatingEnable: 0, heatingLevel: 1, heatingPeriod1StartTime: '02:00', heatingPeriod1EndTime: '06:00', heatingPeriod2StartTime: '', heatingPeriod2EndTime: '' });
  const t = (k) => <input type="time" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <Page title="Battery Heating" subtitle={plant.plantName}>
      <div className="card form">
        <p className="muted">Warms the battery in cold weather so it can charge. Rarely needed in India.</p>
        <label className="switch-row"><span><b>Battery heating</b></span>
          <input type="checkbox" checked={!!f.heatingEnable} onChange={(e) => setF({ ...f, heatingEnable: e.target.checked ? 1 : 0 })} /></label>
        {!!f.heatingEnable && <>
          <label className="field"><span className="muted">Heating level</span>
            <select value={f.heatingLevel} onChange={(e) => setF({ ...f, heatingLevel: Number(e.target.value) })}>
              <option value={0}>Low</option><option value={1}>Medium</option><option value={2}>High</option></select></label>
          <div className="time-grid">
            <label className="field"><span className="muted">Period 1 from</span>{t('heatingPeriod1StartTime')}</label>
            <label className="field"><span className="muted">to</span>{t('heatingPeriod1EndTime')}</label>
            <label className="field"><span className="muted">Period 2 from (optional)</span>{t('heatingPeriod2StartTime')}</label>
            <label className="field"><span className="muted">to</span>{t('heatingPeriod2EndTime')}</label>
          </div>
        </>}
      </div>
      <SendBar plant={plant} op="battery_heating" params={f} caps={caps}
        confirmText={`Turn battery heating ${f.heatingEnable ? 'ON' : 'OFF'} at ${plant.plantName}?`} />
    </Page>
  );
}

// ---------- Command history ----------

const STATUS_TONE = { 0: 'offline', 1: 'offline', 2: 'alarm', 3: 'pending', 4: 'normal', 5: 'alarm', 6: 'alarm' };

export function History({ plant }) {
  const log = useApi(`/api/plants/${plant.plantId}/control/log`);
  const pending = (log.data ?? []).some((e) => e.status === 3);
  useEffect(() => { if (!pending) return; const t = setInterval(log.reload, 10_000); return () => clearInterval(t); }, [pending, log.reload]);
  return (
    <Page title="Command History" subtitle={plant.plantName}>
      {log.error ? <div className="empty err">{log.error.message}</div>
        : !log.data ? <div className="empty">Loading…</div>
        : !log.data.length ? <div className="card empty-state"><b>No commands yet</b><span className="muted">Changes sent to the inverter appear here with their result.</span></div>
        : log.data.map((e) => (
          <div key={e.id} className="card cmd">
            <div className="plant-row-top"><b>{e.label}</b><span className={`badge ${STATUS_TONE[e.status] ?? 'offline'}`}>{e.statusText}</span></div>
            <span className="muted small-text">{new Date(e.at).toLocaleString()} · {e.by}</span>
            <span className="small-text cmd-params">{summarize(e.params)}</span>
            {e.error && <span className="small-text err-text">{e.error}</span>}
          </div>
        ))}
      {pending && <p className="note">Waiting for the inverter… this page refreshes every 10 s.</p>}
    </Page>
  );
}

function summarize(p = {}) {
  const names = { minSoc: 'min SOC', chargeUpperSoc: 'charge to', chargeFromGridEnable: 'grid charging', isEnable: 'enabled', limitValue: 'limit kW',
    timeOfDuration: 'seconds', nextMotion: 'then', batteryPower: 'battery W', targetSoc: 'target %', chargeDischargPower: 'power W', heatingEnable: 'heating', heatingLevel: 'level', manualMode: 'manual', power: 'kW' };
  return Object.entries(p).filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${names[k] || k}: ${k === 'nextMotion' ? (v === 160 ? 'exit' : 'self-consume') : typeof v === 'number' && /Enable$/.test(k) ? (v ? 'on' : 'off') : v}`).join(' · ');
}
