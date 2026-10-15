import { useState } from 'react';
import { useApi } from '../api.js';
import { Page } from '../nav.jsx';

// Plant Sharing (as in SolaX): give family members or a caretaker access to this system by e-mail.
export default function PlantSharing({ plant, user }) {
  const res = useApi(`/api/plants/${plant.plantId}/shares`);
  const [f, setF] = useState({ email: '', perm: 'view' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function post(path, body) {
    const r = await fetch(`/api/plants/${plant.plantId}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error || 'Something went wrong.');
    return b;
  }
  async function share(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const b = await post('shares', f);
      setMsg({ text: b.status === 'invited'
        ? `Invitation sent to ${f.email}. They sign up with this e-mail and see ${plant.plantName} straight away.`
        : `${plant.plantName} is now shared with ${f.email}.` });
      setF({ email: '', perm: 'view' });
      res.reload();
    } catch (err) { setMsg({ err: true, text: err.message }); }
    setBusy(false);
  }
  async function remove(email) {
    const self = email === user.login;
    if (!confirm(self ? `Stop seeing ${plant.plantName}?` : `Stop sharing ${plant.plantName} with ${email}?`)) return;
    try { await post('shares/remove', { email }); self ? location.reload() : res.reload(); }
    catch (err) { setMsg({ err: true, text: err.message }); }
  }

  const list = res.data?.shares ?? [];
  const sharedWithMe = plant.sharedPerm;
  return (
    <Page title="Plant Sharing" subtitle={plant.plantName}>
      {sharedWithMe ? (
        <div className="card form">
          <p>This system was shared with you <b>({sharedWithMe === 'view' ? 'view only' : 'view and control'})</b>.</p>
          <button className="btn ghost" onClick={() => remove(user.login)}>Remove it from my account</button>
        </div>
      ) : res.data && !res.data.canShare ? (
        <p className="note">Only the owner of this system, their installer or Voltra can share it.</p>
      ) : (
        <form className="card form" onSubmit={share}>
          <p className="muted">Share this system with family or a caretaker. They log in with their own account.</p>
          <label className="field"><span className="muted">Their e-mail address</span>
            <input type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" required /></label>
          <div className="segmented">
            <button type="button" className={f.perm === 'view' ? 'on' : ''} onClick={() => setF({ ...f, perm: 'view' })}>View only</button>
            <button type="button" className={f.perm === 'control' ? 'on' : ''} onClick={() => setF({ ...f, perm: 'control' })}>View and control</button>
          </div>
          <p className="muted small-text">{f.perm === 'view' ? 'They see live data, statistics and alarms but cannot change any setting.' : 'They can also change work mode, export limit and other inverter settings.'}</p>
          <button className="btn" disabled={busy}>{busy ? 'Sharing…' : 'Share'}</button>
        </form>
      )}
      {msg && <p className={msg.err ? 'note err-text' : 'note ok'}>{msg.text}</p>}

      {!sharedWithMe && (
        <div className="card list">
          <h3 className="card-title list-title">Shared with</h3>
          {!res.data ? <div className="empty">Loading…</div>
            : !list.length ? <div className="empty">Not shared with anyone yet.</div>
            : list.map((s) => (
              <div key={s.email} className="list-row">
                <span className="list-icon share-avatar">{(s.name || s.email)[0].toUpperCase()}</span>
                <span className="list-text"><b>{s.name || s.email}</b>
                  <span className="muted">{s.name ? `${s.email} · ` : ''}{s.perm === 'view' ? 'View only' : 'View and control'}{s.status === 'invited' ? ' · Invitation sent' : ''}</span></span>
                {res.data.canShare && <button className="text-btn" onClick={() => remove(s.email)}>Remove</button>}
              </div>
            ))}
        </div>
      )}
    </Page>
  );
}
