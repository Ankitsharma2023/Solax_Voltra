import { useCallback, useEffect, useState } from 'react';

export async function api(path) {
  const r = await fetch(path);
  const body = await r.json().catch(() => ({}));
  // Session expired / signed out elsewhere → App shows the login screen.
  if (r.status === 401) dispatchEvent(new Event('voltra:unauthorized'));
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}

// Fetch on mount / when `path` changes, and every `refreshMs` after that.
export function useApi(path, refreshMs = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await api(path), error: null, loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }));
    }
  }, [path]);

  useEffect(() => {
    load();
    if (!refreshMs) return;
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);

  return { ...state, reload: load };
}

// ---------- formatting ----------

export const fmt = (v, digits = 2) => (v == null || Number.isNaN(Number(v)) ? '--' : Number(v).toFixed(digits));

// Returns [number, unit] with W / kW switching.
export function power(w) {
  if (w == null || Number.isNaN(w)) return ['--', 'W'];
  const a = Math.abs(w);
  return a >= 1000 ? [(a / 1000).toFixed(2), 'kW'] : [String(Math.round(a)), 'W'];
}

// SolaX residential deviceModel codes (Developer Portal, Appendix 4).
const MODELS = {
  1: 'X1-LX', 2: 'X-Hybrid', 3: 'X1-Hybrid-G3', 4: 'X1-Boost/Air/Mini', 5: 'X3-Hybrid-G1/G2', 6: 'X3-20K/30K',
  7: 'X3-MIC/PRO', 8: 'X1-Smart', 9: 'X1-AC', 10: 'A1-Hybrid', 11: 'A1-FIT', 12: 'A1', 13: 'J1-ESS',
  14: 'X3-Hybrid-G4', 15: 'X1-Hybrid-G4', 16: 'X3-MIC/PRO-G2', 17: 'X1-SPT', 18: 'X1-Boost-G4', 19: 'A1-HYB-G2',
  20: 'A1-AC-G2', 21: 'A1-SMT-G2', 22: 'X1-Mini-G4', 23: 'X1-IES', 24: 'X3-IES', 25: 'X3-ULT', 26: 'X1-SMART-G2',
  31: 'X3-AELIO', 32: 'X3-HYB-G4 PRO', 33: 'X3-NEO-LV', 34: 'X1-VAST',
};
export const modelName = (code) => MODELS[code] || `Inverter (model ${code})`;
