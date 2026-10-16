import { useState } from 'react';
import { Page, useNav } from '../nav.jsx';
import { ScanInput } from '../components/Scanner.jsx';

// Link another system to the signed-in account using the numbers on the device labels.
export default function AddPlant({ onDone }) {
  const { pop } = useNav();
  const [f, setF] = useState({ inverterSn: '', registerNo: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch('/api/me/plants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ err: true, text: b.error || 'Could not add this system.' });
    setMsg({ text: 'System added ✓' });
    setTimeout(() => { onDone?.(); pop(); location.reload(); }, 900);
  }

  return (
    <Page title="Add plant">
      <form className="card form" onSubmit={submit}>
        <p className="muted">Enter the two numbers printed on the device labels. They prove you have access to this system.</p>
        <label className="field"><span className="muted">Inverter SN</span>
          <ScanInput value={f.inverterSn} onChange={(v) => setF((x) => ({ ...x, inverterSn: v }))} length={14} scanTitle="inverter label" placeholder="14 characters, e.g. H34XXXXXXXXXXX" /></label>
        <label className="field"><span className="muted">Registration No. (on the WiFi dongle)</span>
          <ScanInput value={f.registerNo} onChange={(v) => setF((x) => ({ ...x, registerNo: v }))} length={10} scanTitle="WiFi dongle" placeholder="10 characters, e.g. SXXXXXXXXX" /></label>
        {msg && <p className={msg.err ? 'note err-text' : 'note ok'}>{msg.text}</p>}
        <button className="btn" disabled={busy || !f.inverterSn || !f.registerNo}>{busy ? 'Checking…' : 'Add plant'}</button>
      </form>
    </Page>
  );
}
