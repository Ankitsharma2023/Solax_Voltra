import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { api, useApi } from './api';

// Inverter control helpers shared by the Intelligence tab and the control/* screens
// (the phone versions of sendControl / caps in the web app's Control.jsx and Intelligence.jsx).

// What this user may do on this plant: { control, ops, mayControl, viewOnly, … } (null while loading).
export function useCaps(plantId) {
  return useApi(plantId ? `/api/capabilities?plant=${plantId}` : null);
}

// Send one command. Throws with the server's own error text when it is refused.
export async function sendControl(plantId, op, params) {
  try {
    return await api(`/api/plants/${plantId}/control/${op}`, { method: 'POST', body: params });
  } catch (e) {
    throw new Error(e.message || 'The command could not be sent.');
  }
}

// confirm() on the web → a native Yes/No dialog. Resolves true when confirmed.
export function ask(message, { ok = 'Confirm', title = 'Please confirm', destructive = true } = {}) {
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' && window.confirm(message));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const validTime = (t, optional = false) => (optional && !t) || TIME_RE.test(t || '');

// Remote Settings unlock level per plant, kept while the app is open so the Settings (Basic / Advanced)
// screen knows what was unlocked on the Remote Settings screen. null = locked | 'basic' | 'advanced'.
const levels = new Map();
const listeners = new Set();
export function setUnlockLevel(plantId, level) {
  levels.set(plantId, level);
  listeners.forEach((fn) => fn(plantId, level));
}
export function useUnlockLevel(plantId) {
  const [level, setLevel] = useState(levels.get(plantId) ?? null);
  useEffect(() => {
    setLevel(levels.get(plantId) ?? null);
    const fn = (p, lv) => { if (p === plantId) setLevel(lv); };
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, [plantId]);
  return level;
}

// Work Mode options (web: MODES in Intelligence.jsx).
export const MODES = [
  { id: 'self_use', name: 'Self Use', desc: 'Solar powers the home first, extra charges the battery, then exports.' },
  { id: 'feed_in', name: 'Feed-in Priority', desc: 'Solar is exported to the grid first; the battery charges from what is left.' },
  { id: 'backup', name: 'Back Up', desc: 'Keeps the battery full to cover power cuts.' },
  { id: 'manual', name: 'Manual', desc: 'Force charge, force discharge or stop the battery. For testing and service.' },
];
