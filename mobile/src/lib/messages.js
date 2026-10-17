import { useEffect, useState } from 'react';
import { api } from './api';

// Unread count shared by every bell icon (web: useUnread in Messages.jsx); refreshed every 2 minutes and after reading.
let unreadCache = { n: 0, at: 0 };
const listeners = new Set();

export async function refreshUnread() {
  try {
    const r = await api('/api/messages');
    unreadCache = { n: r.unread, at: Date.now() };
    listeners.forEach((f) => f(r.unread));
    return r;
  } catch { return null; }
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

export const markRead = (body) => api('/api/messages/read', { method: 'POST', body });
