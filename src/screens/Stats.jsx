import { useEffect, useState } from 'react';
import { api, useApi, fmt } from '../api.js';
import { Page } from '../nav.jsx';
import EnergyGraph from '../components/EnergyGraph.jsx';
import BarChart from '../components/BarChart.jsx';
import { BackIcon, ChevronIcon } from '../components/Icons.jsx';

// Same hues as the Energy Graph so a series keeps its colour across screens.
const BAR_SERIES = [
  { key: 'pvGeneration', label: 'Solar', color: '#eda100', on: true },
  { key: 'loadConsumption', label: 'Consumption', color: '#6250d6', on: true },
  { key: 'exportEnergy', label: 'Exported', color: '#008300', on: false },
  { key: 'importEnergy', label: 'Imported', color: '#2a78d6', on: false },
  { key: 'batteryCharged', label: 'Charged', color: '#1baf7a', on: false },
  { key: 'batteryDischarged', label: 'Discharged', color: '#eb6834', on: false },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const today = () => new Date().toISOString().slice(0, 10);

export default function Stats({ plant }) {
  return <Page title="Statistics" subtitle={plant.plantName}><StatsPanel plant={plant} /></Page>;
}

// Day / Month / Year / All switcher with date arrows — the Statistics page and the device page both use it.
export function StatsPanel({ plant }) {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(today());

  const shift = (dir) => {
    const d = new Date(date + 'T00:00:00Z');
    if (period === 'day') d.setUTCDate(d.getUTCDate() + dir);
    if (period === 'month') d.setUTCMonth(d.getUTCMonth() + dir);
    if (period === 'year') d.setUTCFullYear(d.getUTCFullYear() + dir);
    const next = d.toISOString().slice(0, 10);
    if (next <= today()) setDate(next);
  };
  const label = period === 'day' ? date : period === 'month' ? `${MONTHS[+date.slice(5, 7) - 1]} ${date.slice(0, 4)}`
    : period === 'year' ? date.slice(0, 4) : 'Lifetime';

  return (
    <>
      <div className="segmented">
        {['day', 'month', 'year', 'total'].map((p) => (
          <button key={p} className={period === p ? 'on' : ''} onClick={() => { setPeriod(p); setDate(today()); }}>
            {p === 'total' ? 'All' : p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      {period !== 'total' && (
        <div className="date-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous"><BackIcon size={22} /></button>
          <span>{label}</span>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next" disabled={date >= today()}><ChevronIcon size={22} /></button>
        </div>
      )}
      {period === 'day' ? <DayView plant={plant} date={date} /> : <BarsView plant={plant} period={period} date={date} />}
    </>
  );
}

function DayView({ plant, date }) {
  const day = useApi(`/api/plants/${plant.plantId}/day?date=${date}`);
  const month = useApi(`/api/plants/${plant.plantId}/stats?dateType=2&date=${date.slice(0, 7)}`);
  const row = month.data?.plantEnergyStatDataList?.find((d) => d.date === date);
  return (
    <>
      <Summary row={row} />
      <div className="card">
        <h3 className="card-title">Power</h3>
        {day.loading && !day.data ? <div className="empty">Loading…</div> : <EnergyGraph points={day.data?.points} />}
      </div>
    </>
  );
}

function BarsView({ plant, period, date }) {
  const [on, setOn] = useState(() => new Set(BAR_SERIES.filter((s) => s.on).map((s) => s.key)));
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setRows(null); setError(null);
    (async () => {
      const id = plant.plantId;
      if (period === 'month' || period === 'year') {
        const r = await api(`/api/plants/${id}/stats?dateType=${period === 'month' ? 2 : 1}&date=${period === 'month' ? date.slice(0, 7) : date.slice(0, 4)}`);
        const byDate = new Map((r.plantEnergyStatDataList ?? []).map((d) => [d.date, d]));
        // Every day of the month / every month of the year, zero where SolaX has no data.
        const keys = period === 'month'
          ? Array.from({ length: new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7), 0)).getUTCDate() }, (_, i) => `${date.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`)
          : Array.from({ length: 12 }, (_, i) => `${date.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`);
        return keys.map((k) => ({
          ...(byDate.get(k) || {}), date: k, label: k, short: period === 'month' ? String(+k.slice(8)) : MONTHS[+k.slice(5, 7) - 1],
        }));
      }
      // Total: one bar per year since the plant was created.
      const first = +plant.createTime.slice(0, 4), last = new Date().getFullYear();
      const years = await Promise.all(Array.from({ length: last - first + 1 }, (_, i) => first + i).map(async (y) => {
        const r = await api(`/api/plants/${id}/stats?dateType=1&date=${y}`);
        const sum = (k) => (r.plantEnergyStatDataList ?? []).reduce((a, d) => a + Math.abs(d[k] || 0), 0);
        return Object.fromEntries([['label', String(y)], ...BAR_SERIES.map((s) => [s.key, sum(s.key)])]);
      }));
      return years;
    })().then((r) => alive && setRows(r)).catch((e) => alive && setError(e));
    return () => { alive = false; };
  }, [plant, period, date]);

  const totals = rows && Object.fromEntries(BAR_SERIES.map((s) => [s.key, rows.reduce((a, r) => a + Math.abs(r[s.key] || 0), 0)]));
  const series = BAR_SERIES.filter((s) => on.has(s.key));
  const toggle = (k) => setOn((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <>
      <Summary row={totals} />
      <div className="card">
        <h3 className="card-title">Energy</h3>
        <div className="graph-unit">kWh</div>
        {error ? <div className="empty err">{error.message}</div>
          : !rows ? <div className="empty">Loading…</div>
          : <BarChart rows={rows} series={series} />}
        <div className="chips">
          {BAR_SERIES.map((s) => (
            <button key={s.key} className={on.has(s.key) ? 'chip on' : 'chip'} onClick={() => toggle(s.key)} aria-pressed={on.has(s.key)}>
              <span className="dot" style={{ background: on.has(s.key) ? s.color : '#c9ced4' }} />{s.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Summary({ row }) {
  const v = (k) => (row ? Math.abs(row[k] || 0) : null);
  return (
    <div className="summary">
      {[['pvGeneration', 'Solar'], ['loadConsumption', 'Consumed'], ['importEnergy', 'Imported'],
        ['exportEnergy', 'Exported'], ['batteryCharged', 'Charged'], ['batteryDischarged', 'Discharged']].map(([k, l]) => (
        <div key={k}><b>{fmt(v(k))}</b><span className="muted">{l} (kWh)</span></div>
      ))}
    </div>
  );
}
