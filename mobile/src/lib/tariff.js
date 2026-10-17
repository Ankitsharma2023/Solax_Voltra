// Electricity tariff helpers. The tariff itself is saved per plant on the Voltra server (see settings.js). Copy of the web app's src/tariff.js.
// Used to turn kWh into money for "Energy Value" and the Price Trend chart.
export const DEFAULT_TARIFF = {
  currency: '₹',
  mode: 'flat',            // 'flat' | 'tou'
  importPrice: 8,          // per kWh
  exportPrice: 3,
  periods: [               // used when mode === 'tou'
    { start: '00:00', end: '06:00', importPrice: 6, exportPrice: 3 },
    { start: '06:00', end: '18:00', importPrice: 8, exportPrice: 3 },
    { start: '18:00', end: '23:59', importPrice: 10, exportPrice: 3 },
  ],
};

// Price at a given hour (0–24) for the price-trend chart.
export function priceAt(t, hour, kind = 'importPrice') {
  if (t.mode !== 'tou') return t[kind];
  hour = Math.min(hour, 23.99);
  const hhmm = (s) => { const [h, m] = s.split(':').map(Number); return h + m / 60; };
  const p = t.periods.find((p) => hour >= hhmm(p.start) && hour < hhmm(p.end === '23:59' ? '24:00' : p.end));
  return p ? p[kind] : t[kind];
}

// Earnings for a day = money saved by not importing (self-consumed solar/battery) + money earned exporting.
// selfUseKwh = consumption − import (never negative).
export function earnings(t, { consumed = 0, imported = 0, exported = 0 }) {
  if (!t) return null;
  const avgImport = t.mode === 'tou'
    ? t.periods.reduce((a, p) => a + p.importPrice, 0) / t.periods.length : t.importPrice;
  const avgExport = t.mode === 'tou'
    ? t.periods.reduce((a, p) => a + p.exportPrice, 0) / t.periods.length : t.exportPrice;
  return Math.max(0, consumed - imported) * avgImport + exported * avgExport;
}
