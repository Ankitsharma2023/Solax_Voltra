import { useState } from 'react';
import { useApi, fmt } from '../api.js';
import { Page } from '../nav.jsx';

const DAILY_COLS = [
  ['time', 'Time', (v) => v.slice(11, 16)], ['solar', 'Solar (W)'], ['battery', 'Battery (W)'],
  ['grid', 'Grid (W)'], ['consumption', 'Home (W)'], ['soc', 'SOC (%)'],
];
const ENERGY_COLS = [
  ['date', 'Date'], ['pvGeneration', 'Solar'], ['loadConsumption', 'Consumed'], ['importEnergy', 'Imported'],
  ['exportEnergy', 'Exported'], ['batteryCharged', 'Charged'], ['batteryDischarged', 'Discharged'],
];

export default function Reports({ plant }) {
  const [type, setType] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const id = plant.plantId;
  const path = type === 'daily' ? `/api/plants/${id}/day?date=${date}`
    : `/api/plants/${id}/stats?dateType=${type === 'monthly' ? 2 : 1}&date=${type === 'monthly' ? date.slice(0, 7) : date.slice(0, 4)}`;
  const res = useApi(path);

  const cols = type === 'daily' ? DAILY_COLS : ENERGY_COLS;
  const rows = type === 'daily' ? res.data?.points ?? [] : (res.data?.plantEnergyStatDataList ?? []).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.abs(v) : v])));
  const cell = ([key, , f], r) => (f ? f(r[key]) : typeof r[key] === 'number' ? (type === 'daily' ? Math.round(r[key]) : fmt(r[key])) : r[key] ?? '--');

  function exportCsv() {
    const lines = [cols.map((c) => c[1]).join(','), ...rows.map((r) => cols.map((c) => cell(c, r)).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: `${plant.plantName}-${type}-${type === 'daily' ? date : type === 'monthly' ? date.slice(0, 7) : date.slice(0, 4)}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <Page title="Plant Report" subtitle={plant.plantName}
      actions={<button className="text-btn" onClick={exportCsv} disabled={!rows.length}>Export</button>}>
      <div className="segmented">
        {['daily', 'monthly', 'yearly'].map((t) => (
          <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      <label className="field">
        <span className="muted">{type === 'daily' ? 'Day' : type === 'monthly' ? 'Month' : 'Year'}</span>
        {type === 'daily' && <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />}
        {type === 'monthly' && <input type="month" value={date.slice(0, 7)} onChange={(e) => setDate(e.target.value + '-01')} />}
        {type === 'yearly' && <input type="number" min="2020" max={new Date().getFullYear()} value={date.slice(0, 4)} onChange={(e) => setDate(e.target.value + '-01-01')} />}
      </label>
      <div className="card table-card">
        {res.error ? <div className="empty err">{res.error.message}</div>
          : !res.data ? <div className="empty">Loading…</div>
          : !rows.length ? <div className="empty">No data for this period</div>
          : (
            <div className="table-scroll">
              <table className="report">
                <thead><tr>{cols.map((c) => <th key={c[0]}>{c[1]}</th>)}</tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c[0]}>{cell(c, r)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
      </div>
      {type !== 'daily' && <p className="graph-note">Energy values in kWh.</p>}
    </Page>
  );
}
