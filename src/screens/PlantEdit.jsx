import { useEffect, useState } from 'react';
import { useApi } from '../api.js';
import { useNav, Page } from '../nav.jsx';

const FIELDS = [
  ['plantName', 'Plant name', 'text', true],
  ['plantAddress', 'Address', 'text'],
  ['pvCapacity', 'PV capacity (kWp)', 'number'],
  ['batteryCapacity', 'Battery capacity (kWh)', 'number'],
  ['installDate', 'Installation date', 'date'],
  ['contactPhone', 'Contact phone', 'tel'],
  ['latitude', 'Latitude (for weather)', 'number'],
  ['longitude', 'Longitude (for weather)', 'number'],
];

function PlantFields({ f, set, only }) {
  return FIELDS.filter(([k]) => !only || only.includes(k)).map(([k, label, type, req]) => (
    <label key={k} className="field"><span className="muted">{label}{req && <span className="req">*</span>}</span>
      <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} step={type === 'number' ? 'any' : undefined}
        value={f[k] ?? ''} onChange={(e) => set({ ...f, [k]: e.target.value })} required={req} /></label>
  ));
}

// Edit Plant (SolaX ⋯ menu): name, address, capacities, location. Saved by Voltra and shown everywhere in the app.
export function EditPlant({ plant }) {
  const res = useApi(`/api/plants/${plant.plantId}/info`);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!res.data || f) return;
    const pick = (k) => res.data.info?.[k] ?? plant[k] ?? '';
    setF(Object.fromEntries(FIELDS.map(([k]) => [k, pick(k)])));
  }, [res.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/plants/${plant.plantId}/info`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ err: true, text: b.error || 'Could not save.' });
    setMsg({ text: 'Saved. Reloading…' });
    setTimeout(() => location.reload(), 700);
  }
  return (
    <Page title="Edit Plant" subtitle={plant.plantName}>
      {!res.data ? <div className="empty">Loading…</div> : !res.data.canEdit ? (
        <p className="note">Only the owner of this system, their installer or Voltra can edit it.</p>
      ) : f && (
        <form className="card form" onSubmit={save}>
          <PlantFields f={f} set={setF} />
          <p className="muted small-text">Plant ID {plant.plantId} · time zone {plant.plantTimeZone?.replace(/\).*/, ')') || '--'}. These details are kept by Voltra; SolaX Cloud keeps its own copy.</p>
          {msg && <p className={msg.err ? 'note err-text' : 'note ok'}>{msg.text}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </form>
      )}
    </Page>
  );
}

// Create Plant: link a new system by its inverter SN + dongle registration no. If it is not yet in Voltra's
// SolaX account, Voltra receives the request and registers it.
export function CreatePlant() {
  const { pop } = useNav();
  const [f, setF] = useState({ plantName: '', plantAddress: '', pvCapacity: '', batteryCapacity: '', installDate: '', inverterSn: '', registerNo: '', ownerEmail: '' });
  const [state, setState] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setState({ busy: true });
    const r = await fetch('/api/plants/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return setState({ err: b.error || 'Could not create the plant.' });
    setState({ done: b.status });
  }
  if (state?.done) return (
    <Page title="Create Plant">
      <div className="card form">
        {state.done === 'linked'
          ? <p className="note ok">✓ {f.plantName} is linked to your account. Live data appears straight away.</p>
          : <p className="note ok">✓ Request sent. This system is not in Voltra's SolaX account yet — Voltra registers it and you'll get a message when it appears (usually within one working day).</p>}
        <button className="btn" onClick={() => (state.done === 'linked' ? location.reload() : pop())}>Done</button>
      </div>
    </Page>
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Page title="Create Plant">
      <form className="card form" onSubmit={submit}>
        <h3 className="card-title">Plant</h3>
        <PlantFields f={f} set={setF} only={['plantName', 'plantAddress', 'pvCapacity', 'batteryCapacity', 'installDate']} />
        <h3 className="card-title">Devices</h3>
        <label className="field"><span className="muted">Inverter SN<span className="req">*</span></span>
          <input value={f.inverterSn} onChange={set('inverterSn')} autoCapitalize="characters" placeholder="On the inverter label" required /></label>
        <label className="field"><span className="muted">Registration no. (WiFi dongle)<span className="req">*</span></span>
          <input value={f.registerNo} onChange={set('registerNo')} autoCapitalize="characters" placeholder="On the dongle label" required /></label>
        <label className="field"><span className="muted">Owner's e-mail (optional)</span>
          <input type="email" value={f.ownerEmail} onChange={set('ownerEmail')} placeholder="So Voltra can share it with the owner" /></label>
        {state?.err && <p className="note err-text">{state.err}</p>}
        <button className="btn" disabled={state?.busy}>{state?.busy ? 'Creating…' : 'Create Plant'}</button>
      </form>
    </Page>
  );
}
