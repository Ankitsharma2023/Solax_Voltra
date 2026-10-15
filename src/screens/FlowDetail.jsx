import { useMemo, useState } from 'react';
import { useApi, fmt, power } from '../api.js';
import { useNav, Page } from '../nav.jsx';
import { buildCards, DeviceDetailPage, LineChart, Live, toPoints, inverterPower } from './Device.jsx';

// Tapping Solar / Battery / Grid / Home in the energy flow opens its real-time data, as in the SolaX app:
// the reading now, the related values, and today's curve. Refreshed every minute while open.
const META = {
  solar: { title: 'Solar', color: '#eda100' },
  battery: { title: 'Battery', color: '#1baf7a' },
  grid: { title: 'Grid', color: '#2a78d6' },
  home: { title: 'Home', color: '#6250d6' },
};

export default function FlowDetail({ plant, kind }) {
  const { push } = useNav();
  const overview = useApi(`/api/plants/${plant.plantId}/overview`, 60 * 1000);
  const day = useApi(`/api/plants/${plant.plantId}/day`, 5 * 60 * 1000);
  const [series, setSeries] = useState(0);
  const m = META[kind];

  const data = overview.data;
  const inv = data?.inverters?.[0] || {}, bat = data?.batteries?.[0], t = data?.totals || {};
  const solar = inv.MPPTTotalInputPower ?? 0, batteryW = bat?.chargeDischargePower ?? 0, gridW = inv.gridPower ?? 0;
  const homeW = Math.max(0, solar - batteryW - gridW);
  const eps = [1, 2, 3].map((n) => inv[`EPSL${n}ActivePower`]);

  const view = {
    solar: {
      now: solar, status: solar >= 5 ? 'Producing' : 'Not producing',
      tiles: [['Today', t.dailyYield, 'kWh', 2], ['Total', t.totalYield, 'kWh', 1],
        ...Object.keys(inv.mpptMap || {}).filter((k) => /power$/i.test(k)).sort().map((k) => [k.replace(/power$/i, '').toUpperCase(), inv.mpptMap[k], 'W', 0])],
      curves: [['Solar power (W)', (p) => p.solar]],
      device: 'inverter',
    },
    battery: {
      now: Math.abs(batteryW), status: batteryW >= 5 ? 'Charging' : batteryW <= -5 ? 'Discharging' : 'Standby',
      tiles: [['SOC', bat?.batterySOC, '%', 0], ['Remaining', bat?.batteryRemainings, 'kWh', 2], ['Charged today', t.dailyCharged, 'kWh', 2],
        ['Discharged today', t.dailyDischarged, 'kWh', 2], ['Voltage', bat?.batteryVoltage, 'V', 1], ['Temperature', bat?.batteryTemperature, '°C', 0]],
      curves: [['Battery power (W, + charging)', (p) => p.battery], ['SOC (%)', (p) => p.soc]],
      device: 'battery',
    },
    grid: {
      now: Math.abs(gridW), status: gridW >= 5 ? 'Exporting' : gridW <= -5 ? 'Importing' : 'Idle',
      tiles: [['Imported today', t.dailyImported, 'kWh', 2], ['Exported today', t.dailyExported, 'kWh', 2], ['Total imported', t.totalImported, 'kWh', 1],
        ['Total exported', t.totalExported, 'kWh', 1], ...[1, 2, 3].map((n) => [`L${n} voltage`, inv[`acVoltage${n}`], 'V', 1]), ['Frequency', inv.acFrequency1, 'Hz', 2]],
      curves: [['Grid power (W, + export)', (p) => p.grid]],
      device: 'inverter',
    },
    home: {
      now: homeW, status: homeW >= 5 ? 'Consuming' : 'Idle',
      tiles: [['Inverter output', inverterPower(inv), 'W', 0], ...eps.map((v, i) => [`Backup L${i + 1}`, v, 'W', 0]),
        ['Inverter produced today', inv.dailyACOutput, 'kWh', 2], ['Imported today', t.dailyImported, 'kWh', 2]],
      curves: [['Home consumption (W)', (p) => p.consumption]],
      device: 'inverter',
    },
  }[kind];

  const [label, get] = view.curves[Math.min(series, view.curves.length - 1)];
  const pts = useMemo(() => toPoints(day.data?.points, get), [day.data, get]);
  const [n, u] = power(view.now);
  const card = data && buildCards(data).find((c) => c.kind === view.device);

  return (
    <Page title={m.title} subtitle={plant.plantName}>
      <div className="card flow-hero" style={{ '--c': m.color }}>
        <span className="flow-hero-status"><span className="live-dot" style={{ background: m.color }} />{data ? view.status : 'Loading…'}</span>
        <b className="flow-hero-val"><Live value={data ? n : '--'} /><small>{u}</small></b>
        <span className="muted small-text">Updated {inv.plantLocalTime?.slice(11, 16) || '--'} · refreshes every minute</span>
      </div>

      {data && (
        <div className="card">
          <h3 className="card-title">Realtime Data</h3>
          <div className="data-tiles">{view.tiles.map(([lbl, v, unit, d]) => (
            <div key={lbl} className="data-tile"><span className="muted">{lbl}</span><b><Live value={fmt(v, d)} /> <small>{unit}</small></b></div>
          ))}</div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Today</h3>
        {view.curves.length > 1 && (
          <div className="segmented">{view.curves.map(([l], i) => (
            <button key={l} className={series === i ? 'on' : ''} onClick={() => setSeries(i)}>{l.replace(/ \(.*/, '')}</button>
          ))}</div>
        )}
        {!day.data ? <div className="empty">Loading…</div> : <LineChart pts={pts} label={label} color={m.color} fill />}
      </div>

      {card && <button className="btn ghost" onClick={() => push(DeviceDetailPage, { plant, card })}>{card.name} details ›</button>}
    </Page>
  );
}
