import { useState } from 'react';
import { useApi, fmt, modelName } from '../api.js';
import { Page } from '../nav.jsx';

// Reports, as in SolaX: Plant report · Device report · Statistical report (all with CSV export).

const today = () => new Date().toISOString().slice(0, 10);

function downloadCsv(filename, cols, rows, cell) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.map((c) => esc(c[1])).join(','), ...rows.map((r) => cols.map((c) => esc(cell(c, r))).join(','))];
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
}

function Table({ res, cols, rows, cell, empty = 'No data for this period', footer }) {
  return (
    <div className="card table-card">
      {res.error ? <div className="empty err">{res.error.message}</div>
        : !res.data ? <div className="empty">Loading…</div>
        : !rows.length ? <div className="empty">{empty}</div>
        : (
          <div className="table-scroll">
            <table className="report">
              <thead><tr>{cols.map((c) => <th key={c[0]}>{c[1]}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c[0]}>{cell(c, r)}</td>)}</tr>)}</tbody>
              {footer && <tfoot><tr>{cols.map((c) => <td key={c[0]}><b>{cell(c, footer)}</b></td>)}</tr></tfoot>}
            </table>
          </div>
        )}
    </div>
  );
}

function PeriodPicker({ type, date, setDate }) {
  return (
    <label className="field">
      <span className="muted">{type === 'daily' ? 'Day' : type === 'monthly' ? 'Month' : 'Year'}</span>
      {type === 'daily' && <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />}
      {type === 'monthly' && <input type="month" value={date.slice(0, 7)} onChange={(e) => setDate(e.target.value + '-01')} />}
      {type === 'yearly' && <input type="number" min="2020" max={new Date().getFullYear()} value={date.slice(0, 4)} onChange={(e) => setDate(e.target.value + '-01-01')} />}
    </label>
  );
}

export default function Reports({ plant, initial = 'plant' }) {
  const [kind, setKind] = useState(plant ? initial : 'statistical');
  const kinds = plant ? [['plant', 'Plant'], ['device', 'Device'], ['statistical', 'Statistical']] : [['statistical', 'Statistical']];
  return (
    <Page title="Reports" subtitle={plant?.plantName ?? 'All your plants'}>
      {kinds.length > 1 && (
        <div className="segmented">{kinds.map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
      )}
      {kind === 'plant' && <PlantReport plant={plant} />}
      {kind === 'device' && <DeviceReport plant={plant} />}
      {kind === 'statistical' && <StatisticalReport />}
    </Page>
  );
}

// ---------- Plant report ----------

const DAILY_COLS = [
  ['time', 'Time', (v) => v.slice(11, 16)], ['solar', 'Solar (W)'], ['battery', 'Battery (W)'],
  ['grid', 'Grid (W)'], ['consumption', 'Home (W)'], ['soc', 'SOC (%)'],
];
const ENERGY_COLS = [
  ['date', 'Date'], ['pvGeneration', 'Solar'], ['loadConsumption', 'Consumed'], ['importEnergy', 'Imported'],
  ['exportEnergy', 'Exported'], ['batteryCharged', 'Charged'], ['batteryDischarged', 'Discharged'],
];

function PlantReport({ plant }) {
  const [type, setType] = useState('daily');
  const [date, setDate] = useState(today());
  const id = plant.plantId;
  const res = useApi(type === 'daily' ? `/api/plants/${id}/day?date=${date}`
    : `/api/plants/${id}/stats?dateType=${type === 'monthly' ? 2 : 1}&date=${type === 'monthly' ? date.slice(0, 7) : date.slice(0, 4)}`);
  const cols = type === 'daily' ? DAILY_COLS : ENERGY_COLS;
  const rows = type === 'daily' ? res.data?.points ?? [] : (res.data?.plantEnergyStatDataList ?? []).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.abs(v) : v])));
  const cell = ([key, , f], r) => (f ? f(r[key]) : typeof r[key] === 'number' ? (type === 'daily' ? Math.round(r[key]) : fmt(r[key])) : r[key] ?? '--');
  const period = type === 'daily' ? date : type === 'monthly' ? date.slice(0, 7) : date.slice(0, 4);
  return (
    <>
      <div className="segmented">{['daily', 'monthly', 'yearly'].map((t) => (
        <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t[0].toUpperCase() + t.slice(1)}</button>))}</div>
      <PeriodPicker type={type} date={date} setDate={setDate} />
      <Table res={res} cols={cols} rows={rows} cell={cell} />
      <div className="report-foot">
        {type !== 'daily' && <span className="graph-note">Energy values in kWh.</span>}
        <button className="text-btn" disabled={!rows.length} onClick={() => downloadCsv(`${plant.plantName}-plant-${period}.csv`, cols, rows, cell)}>Export CSV</button>
      </div>
    </>
  );
}

// ---------- Device report ----------

const INVERTER_COLS = [
  ['plantLocalTime', 'Time', (v) => String(v).slice(11, 16)], ['MPPTTotalInputPower', 'PV (W)'],
  ['acPower1', 'AC L1 (W)'], ['acPower2', 'AC L2 (W)'], ['acPower3', 'AC L3 (W)'], ['gridPower', 'Grid (W)'],
  ['acVoltage1', 'V L1'], ['acVoltage2', 'V L2'], ['acVoltage3', 'V L3'], ['acFrequency1', 'Hz'],
  ['inverterTemperature', 'Temp (°C)'], ['dailyYield', 'Yield today (kWh)'],
];
const BATTERY_COLS = [
  ['plantLocalTime', 'Time', (v) => String(v).slice(11, 16)], ['batterySOC', 'SOC (%)'], ['chargeDischargePower', 'Power (W)'],
  ['batteryVoltage', 'Voltage (V)'], ['batteryCurrent', 'Current (A)'], ['batteryTemperature', 'Temp (°C)'], ['batteryRemainings', 'Remaining (kWh)'],
];

function DeviceReport({ plant }) {
  const ov = useApi(`/api/plants/${plant.plantId}/overview`);
  const inverters = ov.data?.devices ?? [];
  const options = [...inverters.map((d) => ({ key: `1:${d.deviceSn}`, sn: d.deviceSn, type: 1, label: `${modelName(d.deviceModel)} · ${d.deviceSn}` })),
    ...(ov.data?.batteries?.length && inverters[0] ? [{ key: `2:${inverters[0].deviceSn}`, sn: inverters[0].deviceSn, type: 2, label: 'Battery' }] : [])];
  const [pick, setPick] = useState(null);
  const [date, setDate] = useState(today());
  const dev = options.find((o) => o.key === pick) ?? options[0];
  const res = useApi(dev ? `/api/plants/${plant.plantId}/devices/${dev.sn}/history?type=${dev.type}&date=${date}` : null);
  const cols = dev?.type === 2 ? BATTERY_COLS : INVERTER_COLS;
  const rows = res.data?.rows ?? [];
  const cell = ([key, , f], r) => (f ? f(r[key]) : r[key] == null ? '--' : typeof r[key] === 'number' ? (Number.isInteger(r[key]) ? r[key] : fmt(r[key], 1)) : r[key]);
  return (
    <>
      <label className="field"><span className="muted">Device</span>
        <select value={dev?.key ?? ''} onChange={(e) => setPick(e.target.value)} disabled={!options.length}>
          {!options.length && <option>Loading…</option>}
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select></label>
      <PeriodPicker type="daily" date={date} setDate={setDate} />
      <Table res={dev ? res : { data: null }} cols={cols} rows={rows} cell={cell} empty="No readings for this day" />
      <div className="report-foot">
        <span className="graph-note">Readings every 5 minutes (plant local time).</span>
        <button className="text-btn" disabled={!rows.length} onClick={() => downloadCsv(`${plant.plantName}-${dev?.type === 2 ? 'battery' : dev?.sn}-${date}.csv`, cols, rows, cell)}>Export CSV</button>
      </div>
    </>
  );
}

// ---------- Statistical report (all plants the user can see) ----------

const STAT_COLS = [
  ['plantName', 'Plant'], ['pvCapacity', 'kWp'], ['pvGeneration', 'Solar'], ['yieldPerKwp', 'kWh/kWp'], ['loadConsumption', 'Consumed'],
  ['importEnergy', 'Imported'], ['exportEnergy', 'Exported'], ['batteryCharged', 'Charged'], ['batteryDischarged', 'Discharged'],
];

export function StatisticalReport() {
  const [type, setType] = useState('monthly');
  const [date, setDate] = useState(today());
  const period = type === 'monthly' ? date.slice(0, 7) : date.slice(0, 4);
  const res = useApi(`/api/reports/statistics?dateType=${type === 'monthly' ? 2 : 1}&date=${period}`);
  const rows = res.data?.rows ?? [];
  const keys = ['pvCapacity', 'pvGeneration', 'loadConsumption', 'importEnergy', 'exportEnergy', 'batteryCharged', 'batteryDischarged'];
  const total = rows.length > 1 ? Object.fromEntries([['plantName', `Total (${rows.length} plants)`], ...keys.map((k) => [k, rows.reduce((a, r) => a + (r[k] || 0), 0)])]) : null;
  if (total) total.yieldPerKwp = total.pvCapacity ? total.pvGeneration / total.pvCapacity : null;
  const cell = ([key], r) => (typeof r[key] === 'number' ? fmt(r[key], key === 'pvCapacity' ? 1 : 2) : r[key] ?? '--');
  return (
    <>
      <div className="segmented">
        <button className={type === 'monthly' ? 'on' : ''} onClick={() => setType('monthly')}>Monthly</button>
        <button className={type === 'yearly' ? 'on' : ''} onClick={() => setType('yearly')}>Yearly</button>
      </div>
      <PeriodPicker type={type} date={date} setDate={setDate} />
      <Table res={res} cols={STAT_COLS} rows={rows} cell={cell} footer={total} empty="No plants" />
      <div className="report-foot">
        <span className="graph-note">Energy in kWh. kWh/kWp = solar produced per kW of panels (compares plants of different sizes).</span>
        <button className="text-btn" disabled={!rows.length} onClick={() => downloadCsv(`voltra-statistics-${period}.csv`, STAT_COLS, total ? [...rows, total] : rows, cell)}>Export CSV</button>
      </div>
    </>
  );
}
