import { useCallback, useEffect, useState } from 'react';

// Per-plant settings saved on the Voltra server (tariff, TOU plan, automation scenes, work-mode draft),
// so they follow the customer to any phone and installers can set them up for the owner.

const LEGACY_KEYS = { tariff: 'voltra.tariff.v1', tou: 'voltra.tou', scenes: 'voltra.scenes', workmode: 'voltra.workmode' };
const cache = new Map(); // plantId → Promise<{ tariff, tou, scenes, workmode }>

function fetchAll(plantId) {
  if (!cache.has(plantId)) {
    cache.set(plantId, fetch(`/api/plants/${plantId}/settings`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  }
  return cache.get(plantId);
}

export async function savePlantSetting(plantId, key, value) {
  const r = await fetch(`/api/plants/${plantId}/settings/${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save');
  const all = await fetchAll(plantId);
  cache.set(plantId, Promise.resolve({ ...all, [key]: value }));
  dispatchEvent(new CustomEvent('voltra:setting', { detail: { plantId, key, value } }));
}

// [value, save(value), loaded]. Settings saved on this phone by older versions are moved up once.
export function usePlantSetting(plantId, key, fallback = null) {
  const [state, setState] = useState({ value: fallback, loaded: false });

  useEffect(() => {
    let alive = true;
    fetchAll(plantId).then(async (all) => {
      let value = all[key];
      if (value == null) {
        try {
          const legacy = JSON.parse(localStorage.getItem(LEGACY_KEYS[key]));
          if (legacy != null) { await savePlantSetting(plantId, key, legacy); value = legacy; localStorage.removeItem(LEGACY_KEYS[key]); }
        } catch { /* nothing to migrate */ }
      }
      if (alive) setState({ value: value ?? fallback, loaded: true });
    });
    const onChange = (e) => { if (e.detail.plantId === plantId && e.detail.key === key) setState({ value: e.detail.value ?? fallback, loaded: true }); };
    addEventListener('voltra:setting', onChange);
    return () => { alive = false; removeEventListener('voltra:setting', onChange); };
  }, [plantId, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback((value) => savePlantSetting(plantId, key, value), [plantId, key]);
  return [state.value, save, state.loaded];
}

export const clearSettingsCache = () => cache.clear();
