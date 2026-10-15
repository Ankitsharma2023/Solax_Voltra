import { useState } from 'react';
import { useApi } from '../../api.js';
import { Page, useNav } from '../../nav.jsx';
import { PlusIcon } from '../../components/Icons.jsx';

const ROLE = { installer: 'Installer', distributor: 'Distributor' };
const post = async (path, body) => {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || 'Failed');
  return b;
};

// Downstream channel partners (installers / sub-distributors) — the SolaX "superior channel partner" view.
export default function Partners({ user }) {
  const { push } = useNav();
  const res = useApi('/api/partners');
  const [msg, setMsg] = useState(null);
  const canAdd = user.role === 'distributor' || user.role === 'admin';

  const act = async (p, action, confirmText) => {
    if (confirmText && !confirm(confirmText)) return;
    try {
      const r = await post(`/api/partners/${p.id}`, { action });
      setMsg(r.tempPassword ? { pw: true, text: `${p.login} · temporary password: ${r.tempPassword}` } : { text: `${p.company}: ${action === 'approve' ? 'approved' : action === 'suspend' ? 'suspended' : 'done'} ✓` });
      res.reload();
    } catch (e) { setMsg({ err: true, text: e.message }); }
  };

  const list = [...(res.data ?? [])].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || a.company.localeCompare(b.company));
  return (
    <Page title="Partners" subtitle={res.data ? `${res.data.length} downstream · ${res.data.filter((p) => p.status === 'pending').length} waiting` : ''}
      actions={canAdd && <button className="icon-btn" aria-label="Add partner" onClick={() => push(AddPartner, { onDone: res.reload })}><PlusIcon size={26} /></button>}>
      {msg && <p className={msg.err ? 'note err-text' : msg.pw ? 'note pw-note' : 'note ok'}>{msg.text}</p>}
      {res.error ? <div className="empty err">{res.error.message}</div>
        : !res.data ? <div className="empty">Loading…</div>
        : !list.length ? (
          <div className="card empty-state">
            <b>No partners yet</b>
            <span className="muted">Installers and distributors who sign up with your Organization Number appear here{canAdd ? ', or add them directly with +' : ''}.</span>
          </div>
        ) : list.map((p) => (
          <div key={p.id} className="card partner">
            <div className="plant-row-top">
              <b>{p.company || p.login}</b>
              <span className={`badge ${p.status === 'active' ? 'normal' : p.status === 'pending' ? 'alarm' : 'offline'}`}>
                {p.status === 'active' ? ROLE[p.role] : p.status === 'pending' ? 'Pending' : 'Suspended'}</span>
            </div>
            <span className="muted small-text">{[p.name, p.login, p.phone].filter(Boolean).join(' · ')}</span>
            <span className="muted small-text">Org No. {p.orgNo} · {p.plantCount} plant{p.plantCount === 1 ? '' : 's'}{p.downstream ? ` · ${p.downstream} downstream` : ''} · under {p.parentCompany}</span>
            <div className="partner-actions">
              {p.status !== 'active' && <button className="text-btn" onClick={() => act(p, 'approve')}>{p.status === 'pending' ? 'Approve' : 'Re-activate'}</button>}
              {p.status === 'active' && <button className="text-btn danger" onClick={() => act(p, 'suspend', `Suspend ${p.company}? They will lose access to their plants.`)}>Suspend</button>}
              <button className="text-btn" onClick={() => act(p, 'reset', `Reset the password for ${p.login}?`)}>Reset password</button>
            </div>
          </div>
        ))}
    </Page>
  );
}

function AddPartner({ onDone }) {
  const [f, setF] = useState({ role: 'installer', company: '', zip: '', name: '', phone: '', login: '' });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await post('/api/partners', f);
      setRes({ pw: true, text: `Added ${r.user.company}. Organization Number ${r.user.orgNo}. Login ${r.user.login} · temporary password: ${r.tempPassword}` });
      onDone?.();
    } catch (e2) { setRes({ err: true, text: e2.message }); }
    setBusy(false);
  }
  return (
    <Page title="Add partner">
      <form className="card form" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={f.role === 'installer' ? 'on' : ''} onClick={() => setF({ ...f, role: 'installer' })}>Installer</button>
          <button type="button" className={f.role === 'distributor' ? 'on' : ''} onClick={() => setF({ ...f, role: 'distributor' })}>Distributor</button>
        </div>
        <label className="field"><span className="muted">Company Name *</span><input value={f.company} onChange={set('company')} /></label>
        {f.role === 'installer' && <label className="field"><span className="muted">Zip Code</span><input inputMode="numeric" value={f.zip} onChange={set('zip')} /></label>}
        <label className="field"><span className="muted">Contact Person</span><input value={f.name} onChange={set('name')} /></label>
        <label className="field"><span className="muted">Phone Number</span><input inputMode="tel" value={f.phone} onChange={set('phone')} /></label>
        <label className="field"><span className="muted">E-Mail Address * (used to log in)</span><input type="email" value={f.login} onChange={set('login')} /></label>
        {res && <p className={res.err ? 'note err-text' : 'note pw-note'}>{res.text}</p>}
        <button className="btn" disabled={busy || !f.company || !f.login}>{busy ? 'Adding…' : 'Add partner'}</button>
        <p className="note">The partner is active straight away and sits under your organization. Share the temporary password privately.</p>
      </form>
    </Page>
  );
}
