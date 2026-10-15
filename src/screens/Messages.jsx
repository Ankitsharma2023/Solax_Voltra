import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Page, useNav } from '../nav.jsx';
import Alarms from './Alarms.jsx';
import { History } from './Control.jsx';

// Unread count shared by every bell icon; refreshed every 2 minutes and after reading.
let unreadCache = { n: 0, at: 0 };
const listeners = new Set();
export async function refreshUnread() {
  try { const r = await api('/api/messages'); unreadCache = { n: r.unread, at: Date.now() }; listeners.forEach((f) => f(r.unread)); return r; }
  catch { return null; }
}
export function useUnread() {
  const [n, setN] = useState(unreadCache.n);
  useEffect(() => {
    listeners.add(setN);
    if (Date.now() - unreadCache.at > 60_000) refreshUnread();
    const t = setInterval(refreshUnread, 120_000);
    return () => { listeners.delete(setN); clearInterval(t); };
  }, []);
  return n;
}

const TYPES = {
  alarm: { icon: '⚠️', group: 'alarms' },
  alarm_cleared: { icon: '✅', group: 'alarms' },
  automation: { icon: '⚙️', group: 'automation' },
  control: { icon: '🎛', group: 'changes' },
  partner: { icon: '🤝', group: 'changes' },
  share: { icon: '🔗', group: 'changes' },
  service: { icon: '🛠', group: 'changes' },
  system: { icon: 'ℹ️', group: 'changes' },
};
const TABS = [['all', 'All'], ['alarms', 'Alarms'], ['automation', 'Automation'], ['changes', 'Changes']];

export default function Messages({ plant, onOpenTab, openPartners }) {
  const { push } = useNav();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('all');
  const load = () => refreshUnread().then((r) => r && setData(r));
  useEffect(() => { load(); }, []);

  async function markAll() {
    await fetch('/api/messages/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    load();
  }
  async function open(m) {
    if (!m.read) fetch('/api/messages/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [m.id] }) }).then(load);
    if (m.link === 'alarms' && plant) push(Alarms, { plant });
    else if (m.link === 'history' && plant) push(History, { plant });
    else if (m.link === 'partners' && openPartners) openPartners();
    else if (m.link && onOpenTab) onOpenTab(m.link);
  }

  const list = (data?.messages ?? []).filter((m) => tab === 'all' || TYPES[m.type]?.group === tab);
  const byDay = list.reduce((acc, m) => { const d = dayLabel(m.at); (acc[d] ??= []).push(m); return acc; }, {});
  return (
    <Page title="Messages" subtitle={data ? `${data.unread} unread` : ''}
      actions={data?.unread > 0 && <button className="text-btn" onClick={markAll}>Mark all read</button>}>
      <div className="segmented">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {!data ? <div className="empty">Loading…</div>
        : !list.length ? <div className="card empty-state"><div className="ok-circle">✓</div><b>No messages</b><span className="muted">Alarms, automation actions and changes to the inverter will appear here.</span></div>
        : Object.entries(byDay).map(([day, items]) => (
          <div key={day}>
            <h3 className="sub-head">{day}</h3>
            {items.map((m) => (
              <button key={m.id} className={`card msg-row ${m.read ? '' : 'unread'}`} onClick={() => open(m)}>
                <span className="msg-icon" aria-hidden="true">{TYPES[m.type]?.icon ?? 'ℹ️'}</span>
                <span className="list-text"><b>{m.title}</b><span className="muted">{m.body}</span></span>
                <span className="msg-time muted">{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            ))}
          </div>
        ))}
      <p className="note">Messages are kept for 90 days.</p>
    </Page>
  );
}

function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, now)) return 'Today';
  if (same(d, new Date(now - 864e5))) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
