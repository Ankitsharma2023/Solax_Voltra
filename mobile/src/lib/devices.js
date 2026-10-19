import { useApi } from './api';
import { fmt, modelName, power } from './format';
import { usePlantSetting } from './settings';

// Device cards and data sections — ported from the web app's src/screens/Device.jsx.

// Realtime Power = AC output on-grid + EPS (backup) output, as the SolaX app shows it.
export const sum = (a) => (a.every((v) => v == null) ? null : a.reduce((x, v) => x + (v || 0), 0));
export const inverterPower = (l = {}) => sum([l.acPower1, l.acPower2, l.acPower3, l.EPSL1ActivePower, l.EPSL2ActivePower, l.EPSL3ActivePower]);
export const watts = (w) => { const [n, u] = power(w ?? 0); return `${n} ${u}`; };

export const BATTERY_TYPE = { 0: 'Lead-acid', 1: 'Lithium' };

export function buildCards({ devices, inverters, batteries, batteryDevices = [] }, names = {}) {
  const cards = devices.flatMap((d) => {
    const live = inverters.find((i) => i.deviceSn === d.deviceSn) || {};
    const online = d.onlineStatus === 1;
    return [
      { key: d.deviceSn, kind: 'inverter', model: modelName(d.deviceModel), name: names?.[d.deviceSn] || modelName(d.deviceModel), sn: d.deviceSn, online, device: d, live, battery: batteries[0],
        summary: online ? watts(inverterPower(live)) : 'Offline' },
      d.registerNo && { key: d.registerNo, kind: 'dongle', model: 'WiFi 4.0', name: names?.[d.registerNo] || 'WiFi Dongle', sn: d.registerNo, online, device: d, live,
        summary: online ? 'Online' : 'Offline' },
    ].filter(Boolean);
  });
  if (batteries[0]) {
    const inv = devices[0], b = batteries[0], info = batteryDevices[0] || {};
    const sn = info.deviceSn || b.deviceSn;
    cards.push({ key: 'battery', kind: 'battery', model: BATTERY_TYPE[info.batteryType] || 'Battery', name: names?.[sn || 'battery'] || 'Battery', sn: sn || `Connected to ${inv?.deviceSn}`, nameKey: sn || 'battery',
      online: (info.onlineStatus ?? 1) === 1, live: b, device: inv, info,
      summary: `${fmt(b.batterySOC, 0)}% · ${watts(Math.abs(b.chargeDischargePower ?? 0))}` });
  }
  return cards;
}

// Overview (refreshed every minute) + saved device names → cards.
export function useDeviceCards(plantId, refreshMs = 60 * 1000) {
  const overview = useApi(`/api/plants/${plantId}/overview`, refreshMs);
  const [names, saveNames] = usePlantSetting(plantId, 'deviceNames', {});
  const cards = overview.data ? buildCards(overview.data, names) : null;
  return { overview, cards, names, saveNames };
}

// ---------- detail: Live Data (sections) ----------
// Every value SolaX Cloud sends, grouped like the SolaX app. Signs: grid + = export, battery + = charging.
const unit = (v, u) => (v == null ? null : `${fmt(v, 1)} ${u}`);
function mpptRows(map = {}, lower = 'mppt', upper = 'MPPT') {
  const re = new RegExp(`^${lower}(\\d+)`, 'i');
  const n = new Set(Object.keys(map || {}).map((k) => k.match(re)?.[1]).filter(Boolean));
  return [...n].sort((a, b) => a - b).map((i) => {
    const g = (f) => map[`${lower}${i}${f}`] ?? map[`${upper}${i}${f}`];
    return [`${upper}${i}`, fmt(g('Voltage'), 1), fmt(g('Current')), fmt(g('Power'), 0)];
  });
}

export const SECTIONS = {
  inverter: (l, d, card) => {
    const bat = card.battery;
    return [
      { title: 'PV', tiles: [['PV Power', l.MPPTTotalInputPower, 'W', 0], ['PV Yield Today', l.dailyYield, 'kWh', 2], ['PV Yield Total', l.totalYield, 'kWh', 1]],
        table: { head: ['MPPT', 'Voltage (V)', 'Current (A)', 'Power (W)'], rows: mpptRows(l.mpptMap) },
        table2: { head: ['String', 'Voltage (V)', 'Current (A)', 'Power (W)'], rows: mpptRows(l.pvMap, 'pv', 'PV') } },
      bat && { title: 'Battery', tiles: [['SOC', bat.batterySOC, '%', 0], [(bat.chargeDischargePower ?? 0) >= 0 ? 'Charging' : 'Discharging', Math.abs(bat.chargeDischargePower ?? 0), 'W', 0],
        ['Voltage', bat.batteryVoltage, 'V', 1], ['Current', bat.batteryCurrent, 'A', 1], ['Temperature', bat.batteryTemperature, '°C', 0], ['Remaining', bat.batteryRemainings, 'kWh', 2]] },
      { title: 'AC (On-grid)', tiles: [['Active Power', l.totalActivePower ?? sum([l.acPower1, l.acPower2, l.acPower3]), 'W', 0], ['Reactive Power', l.totalReactivePower, 'var', 0],
        ['Power Factor', l.totalPowerFactor, '', 2], ['Grid Frequency', l.gridFrequency ?? l.acFrequency1, 'Hz', 2]],
        table: { head: ['Phase', 'Voltage (V)', 'Current (A)', 'Power (W)', 'Freq (Hz)'],
          rows: [1, 2, 3].map((n) => [`L${n}`, fmt(l[`acVoltage${n}`], 1), fmt(l[`acCurrent${n}`]), fmt(l[`acPower${n}`], 0), fmt(l[`acFrequency${n}`])]) },
        info: [['L1-L2 Voltage', unit(l.l1l2Voltage, 'V')], ['L2-L3 Voltage', unit(l.l2l3Voltage, 'V')], ['L1-L3 Voltage', unit(l.l1l3Voltage, 'V')]] },
      { title: 'Grid / Meter', tiles: [[(l.gridPower ?? 0) >= 0 ? 'Exporting' : 'Importing', Math.abs(l.gridPower ?? 0), 'W', 0],
        ['Imported Today', l.todayImportEnergy, 'kWh', 2], ['Exported Today', l.todayExportEnergy, 'kWh', 2], ['Imported Total', l.totalImportEnergy, 'kWh', 1], ['Exported Total', l.totalExportEnergy, 'kWh', 1],
        ...(l.gridPowerM2 || l.totalImportEnergyM2 || l.totalExportEnergyM2 ? [['Meter 2 Power', l.gridPowerM2, 'W', 0], ['Meter 2 Imported', l.totalImportEnergyM2, 'kWh', 1], ['Meter 2 Exported', l.totalExportEnergyM2, 'kWh', 1]] : [])] },
      { title: 'EPS (Backup)', tiles: [['EPS Power', sum([1, 2, 3].map((n) => l[`EPSL${n}ActivePower`])), 'W', 0]],
        table: { head: ['Phase', 'Voltage (V)', 'Current (A)', 'Power (W)', 'Apparent (VA)'],
          rows: [1, 2, 3].map((n) => [`L${n}`, fmt(l[`EPSL${n}Voltage`], 1), fmt(l[`EPSL${n}Current`]), fmt(l[`EPSL${n}ActivePower`], 0), fmt(l[`EPSL${n}ApparentPower`], 0)]) } },
      { title: 'Energy', tiles: [['AC Output Today', l.dailyACOutput, 'kWh', 2], ['AC Output Total', l.totalACOutput, 'kWh', 1], ['AC Input Today', l.dailyACInput, 'kWh', 2], ['AC Input Total', l.totalACInput, 'kWh', 1]] },
      { title: 'Inverter', tiles: [['Temperature', l.inverterTemperature, '°C', 1], ['Rated Power', d.ratedPower, 'kW', 1]],
        info: [['Status code', l.deviceStatus], ['Firmware ARM', d.armVersion], ['Firmware DSP', d.dspVersion]] },
    ].filter(Boolean);
  },
  battery: (l, _d, card, plant) => {
    const w = l.chargeDischargePower ?? 0;
    // Usable capacity from the BMS's own numbers (remaining ÷ SOC) — the plant's recorded capacity can be wrong.
    const measured = l.batterySOC >= 20 && l.batteryRemainings > 0 ? Math.round((l.batteryRemainings / (l.batterySOC / 100)) * 10) / 10 : null;
    const cap = measured || Number(card.info?.ratedCapacity) || Number(plant?.batteryCapacity) || null;
    const hours = (kwh) => { if (!(kwh > 0) || Math.abs(w) < 5) return '--'; const h = kwh / (Math.abs(w) / 1000); return h > 99 ? '> 99 h' : `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`; };
    return [
      { title: 'Battery Data', tiles: [['SOC', l.batterySOC, '%', 0], [w >= 0 ? 'Charging Power' : 'Discharging Power', Math.abs(w), 'W', 0], ['Remaining', l.batteryRemainings, 'kWh', 2],
        ['Voltage', l.batteryVoltage, 'V', 1], ['Current', l.batteryCurrent, 'A', 1], ['Temperature', l.batteryTemperature, '°C', 0]] },
      { title: 'BMS', tiles: [['SOH', l.batterySOH, '%', 0], ['Cycles (BMS)', l.batteryCycleTimes, '', 0], ['Total Charged', l.totalDeviceCharge, 'kWh', 1], ['Total Discharged', l.totalDeviceDischarge, 'kWh', 1]],
        info: [
          ['BMS State', Math.abs(w) < 5 ? 'Standby' : w > 0 ? 'Charging' : 'Discharging'],
          ['Battery Type', BATTERY_TYPE[card.info?.batteryType] ?? card.info?.batteryType],
          ['Usable Capacity', cap ? `${cap} kWh${measured ? ' (measured)' : ''}` : null],
          ['Capacity on plant record', plant?.batteryCapacity != null && measured && Math.abs(plant.batteryCapacity - measured) > 0.5 ? `${plant.batteryCapacity} kWh` : null],
          ['Pack Power (V × A)', l.batteryVoltage != null && l.batteryCurrent != null ? `${fmt(l.batteryVoltage * l.batteryCurrent, 0)} W` : null],
          [w > 0 ? 'Time to full' : 'Time to empty', w > 0 ? hours(cap && l.batterySOC != null ? cap * (100 - l.batterySOC) / 100 : null) : hours(l.batteryRemainings)],
          ['Round-trip (discharged ÷ charged)', l.totalDeviceCharge > 0 ? `${fmt((l.totalDeviceDischarge / l.totalDeviceCharge) * 100, 0)} %` : null],
          ['Equivalent full cycles', cap && l.totalDeviceDischarge != null ? fmt(l.totalDeviceDischarge / cap, 1) : null],
          ['BMS status code', l.deviceStatus],
          ['Hardware Version', card.info?.hardwareVersion || null], ['Software Version', card.info?.softwareVersion || null],
        ].filter(([, v]) => v != null && v !== ''),
        note: 'Cell voltages and cell temperatures are not sent to SolaX Cloud by this battery, so they can only be read on site.' },
    ];
  },
  dongle: () => [],
};

export const CURVE_FIELDS = {
  inverter: [['MPPTTotalInputPower', 'PV Power (W)'], ['gridPower', 'Grid Power (W)'], ['acPower1', 'AC Power L1 (W)'], ['acVoltage1', 'AC Voltage L1 (V)'], ['inverterTemperature', 'Temperature (°C)']],
  battery: [['batterySOC', 'SOC (%)'], ['chargeDischargePower', 'Power (W)'], ['batteryVoltage', 'Voltage (V)'], ['batteryTemperature', 'Temperature (°C)']],
};

// Device Replacement / Reconfigure / Local Access: done on site by Voltra; the app sends the request.
export const SERVICE = {
  replacement: { kind: 'replacement', title: 'Device Replacement', button: 'Request replacement',
    intro: 'If this device is faulty, Voltra replaces it on site and moves your system\'s history to the new device, so nothing is lost.',
    steps: ['Send a request below (or call Voltra).', 'A Voltra engineer checks the alarm history and contacts you.', 'After the swap your app keeps working as before.'] },
  reconfigure: { kind: 'reconfigure', title: 'Reconfigure WiFi', button: 'Ask Voltra to help instead', solaxApp: true,
    intro: 'Your WiFi dongle is connected to the home WiFi with the SolaX Cloud app (SolaX’s own app, over Bluetooth next to the dongle). Do this when you get a new router or change the WiFi name or password.',
    steps: ['Stand next to the WiFi dongle with your phone’s Bluetooth on.', 'Open the SolaX Cloud app (button below) and log in.', 'Go to Device → WiFi dongle → Reconfigure.', 'Choose your 2.4 GHz WiFi (5 GHz does not work), enter the password and tap Next.', 'When the dongle shows Online, your data appears here again within about 5 minutes.'] },
  local_access: { kind: 'local_access', title: 'Local Access', button: 'Request local access help',
    intro: 'Local Access talks to the inverter directly over Bluetooth, without internet. It is coming in a later version of this app. Until then Voltra can make local changes for you.',
    steps: ['Tell us what you need changed (optional).', 'Send the request. Voltra contacts you and does it on site or by phone.'] },
};

// Service & maintenance contact (see lib/company.js).
export const SUPPORT_PHONE = '+91 70181 52711';
export const telHref = (p) => `tel:${p.replace(/[^\d+]/g, '')}`;
