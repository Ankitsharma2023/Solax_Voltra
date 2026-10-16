// Formatting shared with the web app (src/api.js).

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
