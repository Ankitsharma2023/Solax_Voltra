import { useState } from 'react';
import { useApi } from '../../api.js';
import { Page, useNav } from '../../nav.jsx';
import { ChevronIcon, PlusIcon } from '../../components/Icons.jsx';

const ROLE = { customer: 'End User', installer: 'Installer', distributor: 'Distributor', admin: 'Admin' };
const post = async (path, body) => {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || 'Failed');
  return b;
};

// Admin: all accounts, pending approvals first.
export default function Users() {
  const { push } = useNav();
  const users = useApi('/api/admin/users');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const list = (users.data ?? [])
    .filter((u) => role === 'all' || u.role === role)
    .filter((u) => !q || `${u.login} ${u.name} ${u.company}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || a.login.localeCompare(b.login));
  const pending = (users.data ?? []).filter((u) => u.status === 'pending').length;

  return (
    <Page title="Users & approvals" subtitle={users.data ? `${users.data.length} accounts${pending ? ` · ${pending} waiting` : ''}` : ''}
      actions={<button className="icon-btn" aria-label="New account" onClick={() => push(NewUser, { onDone: users.reload })}><PlusIcon size={26} /></button>}>
      <input className="search" type="search" placeholder="Search email, name or company" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips filter-chips">
        {['all', 'customer', 'installer', 'distributor', 'admin'].map((r) => (
          <button key={r} className={role === r ? 'chip on' : 'chip'} onClick={() => setRole(r)}>{r === 'all' ? 'All' : ROLE[r]}</button>
        ))}
      </div>
      {users.error ? <div className="empty err">{users.error.message}</div> : !users.data ? <div className="empty">Loading…</div>
        : list.map((u) => (
          <button key={u.id} className="card user-row" onClick={() => push(UserDetail, { id: u.id, onChange: users.reload })}>
            <span className="list-text">
              <b>{u.company || u.name || u.login}</b>
              <span className="muted">{u.login} · {ROLE[u.role]} · {u.role === 'admin' ? 'all plants' : `${u.plantIds.length} plant${u.plantIds.length === 1 ? '' : 's'}`}</span>
            </span>
            {u.status !== 'active' && <span className={`badge ${u.status === 'pending' ? 'alarm' : 'offline'}`}>{u.status === 'pending' ? 'Pending' : 'Suspended'}</span>}
            <ChevronIcon className="muted" size={18} />
          </button>
        ))}
    </Page>
  );
}

function UserDetail({ id, onChange }) {
  const { pop } = useNav();
  const users = useApi('/api/admin/users');
  const plants = useApi('/api/plants');
  const [msg, setMsg] = useState(null);
  const [plantPick, setPlantPick] = useState('');
  const u = users.data?.find((x) => x.id === id);

  const act = async (action, extra = {}, confirmText) => {
    if (confirmText && !confirm(confirmText)) return;
    setMsg(null);
    try {
      const r = await post(`/api/admin/users/${id}`, { action, ...extra });
      setMsg(r.tempPassword ? { text: `Temporary password: ${r.tempPassword}`, pw: true } : { text: 'Saved ✓' });
      onChange?.();
      if (action === 'delete') return setTimeout(pop, 600);
      users.reload();
    } catch (e) { setMsg({ err: true, text: e.message }); }
  };

  if (!u) return <Page title="Account"><div className="empty">{users.data ? 'Account not found.' : 'Loading…'}</div></Page>;
  const linked = (plants.data ?? []).filter((p) => u.plantIds.includes(String(p.plantId)));
  const unlinked = (plants.data ?? []).filter((p) => !u.plantIds.includes(String(p.plantId)));

  return (
    <Page title={u.company || u.name || u.login} subtitle={ROLE[u.role]}>
      <div className="card"><table className="kv"><tbody>
        <tr><td>Login</td><td>{u.login}</td></tr>
        {u.name && <tr><td>Name</td><td>{u.name}</td></tr>}
        {u.company && <tr><td>Company</td><td>{u.company}</td></tr>}
        {u.phone && <tr><td>Phone</td><td>{u.phone}</td></tr>}
        <tr><td>Status</td><td>{u.status}</td></tr>
        <tr><td>Created</td><td>{u.createdAt?.slice(0, 10)}</td></tr>
      </tbody></table></div>

      {msg && <p className={msg.err ? 'note err-text' : msg.pw ? 'note pw-note' : 'note ok'}>{msg.text}{msg.pw && <><br /><small>Share it privately. They should change it after logging in.</small></>}</p>}

      <div className="card form">
        <h3 className="card-title">Account</h3>
        {u.status === 'pending' && <button className="btn" onClick={() => act('approve')}>Approve {ROLE[u.role].toLowerCase()}</button>}
        {u.status === 'suspended' && <button className="btn" onClick={() => act('approve')}>Re-activate</button>}
        <label className="field"><span className="muted">Role</span>
          <select value={u.role} onChange={(e) => act('role', { role: e.target.value }, `Change role to ${ROLE[e.target.value]}?`)}>
            {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <button className="btn ghost" onClick={() => act('reset', {}, `Reset the password for ${u.login}? They will be signed out everywhere.`)}>Reset password</button>
        {u.status === 'active' && <button className="btn ghost" onClick={() => act('suspend', {}, `Suspend ${u.login}? They won't be able to see any plants.`)}>Suspend</button>}
        <button className="btn ghost logout" onClick={() => act('delete', {}, `Delete ${u.login} permanently?`)}>Delete account</button>
      </div>

      {u.role !== 'admin' && (
        <div className="card form">
          <h3 className="card-title">Plants ({linked.length})</h3>
          {linked.map((p) => (
            <div key={p.plantId} className="rec-row">
              <span className="list-text"><b>{p.plantName}</b><span className="muted">{p.plantAddress || p.plantId}</span></span>
              <button className="text-btn danger" onClick={() => act('unassign', { plantId: p.plantId }, `Unlink ${p.plantName}?`)}>Unlink</button>
            </div>
          ))}
          {unlinked.length > 0 && (
            <div className="assign">
              <select value={plantPick} onChange={(e) => setPlantPick(e.target.value)}>
                <option value="">Link a plant…</option>
                {unlinked.map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName}</option>)}
              </select>
              <button className="btn" disabled={!plantPick} onClick={() => { act('assign', { plantId: plantPick }); setPlantPick(''); }}>Link</button>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

function NewUser({ onDone }) {
  const plants = useApi('/api/plants');
  const [f, setF] = useState({ role: 'customer', login: '', name: '', company: '', phone: '', plantId: '' });
  const [res, setRes] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try { const r = await post('/api/admin/users', f); setRes({ text: `Created ${r.user.login}. Temporary password: ${r.tempPassword}`, pw: true }); onDone?.(); }
    catch (e2) { setRes({ err: true, text: e2.message }); }
  }
  return (
    <Page title="New account">
      <form className="card form" onSubmit={submit}>
        <label className="field"><span className="muted">Identity</span>
          <select value={f.role} onChange={set('role')}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span className="muted">Email or mobile</span><input value={f.login} onChange={set('login')} /></label>
        <label className="field"><span className="muted">Name</span><input value={f.name} onChange={set('name')} /></label>
        {(f.role === 'installer' || f.role === 'distributor') && <label className="field"><span className="muted">Company</span><input value={f.company} onChange={set('company')} /></label>}
        {f.role !== 'admin' && (
          <label className="field"><span className="muted">Plant (optional)</span>
            <select value={f.plantId} onChange={set('plantId')}><option value="">—</option>
              {(plants.data ?? []).map((p) => <option key={p.plantId} value={p.plantId}>{p.plantName}</option>)}</select></label>
        )}
        {res && <p className={res.err ? 'note err-text' : 'note pw-note'}>{res.text}</p>}
        <button className="btn" disabled={!f.login}>Create account</button>
      </form>
    </Page>
  );
}
