import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// Per-plant settings saved on the Voltra server (tariff, TOU plan, scenes, work-mode draft, device names, …).
// Same endpoints as the web app's src/settings.js.
const cache = new Map(); // plantId → Promise<{...}>
const listeners = new Set();

function fetchAll(plantId) {
  if (!cache.has(plantId)) cache.set(plantId, api(`/api/plants/${plantId}/settings`).catch(() => ({})));
  return cache.get(plantId);
}

export async function savePlantSetting(plantId, key, value) {
  await api(`/api/plants/${plantId}/settings/${key}`, { method: 'POST', body: { value } });
  const all = await fetchAll(plantId);
  cache.set(plantId, Promise.resolve({ ...all, [key]: value }));
  listeners.forEach((fn) => fn(plantId, key, value));
}

// [value, save(value), loaded]
export function usePlantSetting(plantId, key, fallback = null) {
  const [state, setState] = useState({ value: fallback, loaded: false });
  useEffect(() => {
    let alive = true;
    fetchAll(plantId).then((all) => { if (alive) setState({ value: all[key] ?? fallback, loaded: true }); });
    const onChange = (p, k, v) => { if (p === plantId && k === key) setState({ value: v ?? fallback, loaded: true }); };
    listeners.add(onChange);
    return () => { alive = false; listeners.delete(onChange); };
  }, [plantId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useCallback((value) => savePlantSetting(plantId, key, value), [plantId, key]);
  return [state.value, save, state.loaded];
}

export const clearSettingsCache = () => cache.clear();
