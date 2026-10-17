// Default tariff for the Tariff Setting editor (same as the web app's src/tariff.js DEFAULT_TARIFF).
// The tariff itself is saved per plant on the Voltra server (plant setting "tariff").
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

export const isHHMM = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
