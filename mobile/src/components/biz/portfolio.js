import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';

// /api/portfolio is loaded once and shared by the Overview, Plants and Alarms tabs
// (the web app loads it once in BusinessApp). Refreshed every 5 minutes while a tab is open.
const FIVE_MIN = 5 * 60 * 1000;
let state = { data: null, error: null, loading: false, at: 0 };
let inflight = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f(state));

export function loadPortfolio() {
  if (inflight) return inflight;
  state = { ...state, loading: true }; emit();
  inflight = api('/api/portfolio')
    .then((data) => { state = { data, error: null, loading: false, at: Date.now() }; })
    .catch((error) => { state = { ...state, error, loading: false }; })
    .finally(() => { inflight = null; emit(); });
  return inflight;
}

export function usePortfolio() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    if (!state.data || Date.now() - state.at > FIVE_MIN) loadPortfolio();
    const t = setInterval(loadPortfolio, FIVE_MIN);
    return () => { listeners.delete(setS); clearInterval(t); };
  }, []);
  return { ...s, reload: loadPortfolio };
}

// Open one plant in the full 5-tab plant app (it shows "‹ All plants" to come back).
export function useOpenPlant() {
  const { plants, setPlantId, reloadPlants } = useSession();
  return useCallback((plantId) => {
    const match = plants?.find((p) => String(p.plantId) === String(plantId));
    setPlantId(match ? match.plantId : String(plantId));
    if (!match) reloadPlants(); // e.g. a plant created since the list was loaded
    router.push('/(tabs)');
  }, [plants, setPlantId, reloadPlants]);
}

// kWh → [value, unit, digits], switching to MWh / GWh like the reference app.
export function energy(kwh) {
  const v = Number(kwh) || 0;
  if (v >= 1e6) return [v / 1e6, 'GWh', 3];
  if (v >= 1e3) return [v / 1e3, 'MWh', 3];
  return [v, 'kWh', 2];
}
