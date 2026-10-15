import { useEffect, useState } from 'react';
import { useApi, fmt } from '../api.js';
import { useNav } from '../nav.jsx';
import { loadTariff, earnings, priceAt } from '../tariff.js';
import EnergyFlow from '../components/EnergyFlow.jsx';
import SocGauge from '../components/SocGauge.jsx';
import EnergyGraph from '../components/EnergyGraph.jsx';
import Header from '../components/Header.jsx';
import CountUp from '../components/CountUp.jsx';
import Stats from './Stats.jsx';
import Alarms from './Alarms.jsx';
import Reports from './Reports.jsx';
import { TariffSetting as TariffSettingPage } from './Me.jsx';
import { BoltIcon, ChartIcon, InfoIcon, InverterIcon, HouseBoltIcon, PylonIcon, TariffIcon } from '../components/Icons.jsx';

const FIVE_MIN = 5 * 60 * 1000;
const CO2_KG_PER_KWH = 0.997, COAL_KG_PER_KWH = 0.4, CO2_KG_PER_TREE = 18.3;

export default function Home({ plant, goTab }) {
  const { push } = useNav();
  const id = plant.plantId;
  const overview = useApi(`/api/plants/${id}/overview`, FIVE_MIN);
  const day = useApi(`/api/plants/${id}/day`, FIVE_MIN);
  const weather = useApi(`/api/plants/${id}/weather`);
  const alarms = useApi(`/api/plants/${id}/alarms`, FIVE_MIN);
  const month = new Date().toISOString().slice(0, 7);
  const stats = useApi(`/api/plants/${id}/stats?dateType=2&date=${month}`);
  const [tariff, setTariff] = useState(loadTariff);
  const [menu, setMenu] = useState(false);

  // Re-read tariff when coming back from the Tariff page.
  useEffect(() => { const f = () => setTariff(loadTariff()); addEventListener('focus', f); addEventListener('popstate', f); return () => { removeEventListener('focus', f); removeEventListener('popstate', f); }; }, []);

  const headerProps = {
    plant, alarmCount: alarms.data?.length ?? 0,
    onAlarms: () => push(Alarms, { plant }), onMore: () => setMenu(true),
  };

  if (overview.error) return <><Header {...headerProps} /><div className="empty err">{overview.error.message}</div></>;
  if (!overview.data) return <><Header {...headerProps} /><HomeSkeleton /></>;

  const { totals, inverters, batteries, devices } = overview.data;
  const inv = inverters[0] || {};
  const bat = batteries[0];

  // Sign conventions (SolaX): battery + = charging; grid + = exporting.
  const solar = inv.MPPTTotalInputPower ?? 0;
  const batteryW = bat?.chargeDischargePower ?? 0;
  const gridW = inv.gridPower ?? 0;
  const homeW = Math.max(0, solar - batteryW - gridW);

  const online = devices.some((d) => d.onlineStatus === 1);
  const status = !online ? 'Offline' : alarms.data?.length ? 'Alarm' : 'Normal';
  const batState = batteryW >= 5 ? 'Battery Charging' : batteryW <= -5 ? 'Battery Discharging' : 'Battery Standby';
  const inverterProduced = inv.dailyACOutput ?? 0;
  const homeConsumed = Math.max(0, inverterProduced + (totals.dailyImported ?? 0) - (totals.dailyExported ?? 0));

  // Earnings come from the tariff saved on this phone (SolaX has none set for this plant).
  const days = stats.data?.plantEnergyStatDataList ?? [];
  const yKey = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const yRow = days.find((d) => d.date === yKey);
  const earnToday = earnings(tariff, { consumed: homeConsumed, imported: totals.dailyImported, exported: totals.dailyExported });
  const earnYesterday = yRow && earnings(tariff, { consumed: Math.abs(yRow.loadConsumption), imported: yRow.importEnergy, exported: yRow.exportEnergy });
  const earnTotal = earnings(tariff, { consumed: Math.max(0, (totals.totalYield ?? 0) + (totals.totalImported ?? 0) - (totals.totalExported ?? 0)), imported: totals.totalImported, exported: totals.totalExported });
  const money = (v) => (tariff && v != null ? <>{tariff.currency}<CountUp value={v} /></> : '- -');

  const lifetimeKwh = totals.totalYield ?? 0;
  const co2T = (lifetimeKwh * CO2_KG_PER_KWH) / 1000;

  return (
    <>
      <Header {...headerProps} status={status}
        sub={weather.data?.min != null && <div className="temp">{fmt(weather.data.min, 1)}~{fmt(weather.data.max, 1)}<small>°C</small></div>} />

      <EnergyFlow solar={solar} home={homeW} battery={batteryW} grid={gridW} soc={bat?.batterySOC} hasBattery={!!bat}
        onOpen={() => goTab('device')} />
      <p className="updated">Updated {inv.plantLocalTime?.slice(11, 16) || '--'} · refreshes every 5 min</p>

      <section>
        <div className="section-head"><h2>Daily Energy</h2>
          <button className="icon-btn" onClick={() => push(Stats, { plant })} aria-label="Statistics"><ChartIcon className="muted" /></button></div>

        {bat && (
          <div className="card battery-card">
            <div className="battery-top">
              <div>
                <BoltIcon className={batState === 'Battery Standby' ? 'muted' : 'ok pulse'} size={20} />
                <h3>{batState}</h3>
                <p className="muted">Remaining Energy: {fmt(bat.batteryRemainings)}kWh</p>
              </div>
              <SocGauge value={bat.batterySOC} />
            </div>
            <div className="split">
              <div><span className="muted">Charged</span><b><CountUp value={totals.dailyCharged} /><small>kWh</small></b></div>
              <div><span className="muted">Discharged</span><b><CountUp value={totals.dailyDischarged} /><small>kWh</small></b></div>
            </div>
          </div>
        )}

        <div className="tiles">
          <Tile icon={<InverterIcon />} tone="blue" value={inverterProduced} label="Inverter Produced" />
          <Tile icon={<PylonIcon />} tone="grey" value={totals.dailyImported} label="Grid Imported" />
          <Tile icon={<HouseBoltIcon />} tone="teal" value={homeConsumed} label="Home Consumed" />
          <Tile icon={<PylonIcon />} tone="grey" value={totals.dailyExported} label="Grid Exported" />
        </div>

        <div className="card">
          <h3 className="card-title">Energy Graph</h3>
          {day.error ? <div className="empty err">{day.error.message}</div> : <EnergyGraph points={day.data?.points} />}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Energy Value</h2></div>
        <div className="card">
          <h3 className="card-title">Earnings Today <InfoIcon size={18} className="muted" /></h3>
          <div className="big-money">{money(earnToday)}</div>
          <div className="split soft">
            <div><span className="muted">Earnings Yesterday</span><b>{money(earnYesterday)}</b></div>
            <div><span className="muted">Total Earnings</span><b>{money(earnTotal)}</b></div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Price Trend</h3>
          <PriceTrend tariff={tariff} onSet={() => push(TariffSettingPage, { plant })} />
        </div>

        <div className="card">
          <h3 className="card-title">Environmental Benefits <InfoIcon size={18} className="muted" /></h3>
          <div className="benefits">
            <Benefit tone="peach" icon="☁" value={co2T} unit="t" label={<>CO<sub>2</sub> Saved</>} />
            <Benefit tone="mint" icon="🌲" value={(co2T * 1000) / CO2_KG_PER_TREE} digits={1} unit="Trees" label="Equivalent Planted" />
            <Benefit tone="sky" icon="⛰" value={(lifetimeKwh * COAL_KG_PER_KWH) / 1000} unit="t" label="Standard Coal Saved" />
          </div>
        </div>
      </section>

      {menu && (
        <Sheet onClose={() => setMenu(false)} items={[
          { label: 'Statistics', onClick: () => push(Stats, { plant }) },
          { label: 'Plant Report', onClick: () => push(Reports, { plant }) },
          { label: 'Alarms', onClick: () => push(Alarms, { plant }) },
          { label: 'Tariff Setting', onClick: () => push(TariffSettingPage, { plant }) },
          { label: 'Refresh now', onClick: () => { overview.reload(); day.reload(); alarms.reload(); } },
        ]} />
      )}
    </>
  );
}

function Tile({ icon, tone, value, label }) {
  return (
    <div className="card tile">
      <span className={`tile-icon ${tone}`}>{icon}</span>
      <div><b><CountUp value={value} /><small>kWh</small></b><span className="muted">{label}</span></div>
    </div>
  );
}

function Benefit({ tone, icon, value, digits = 2, unit, label }) {
  return (
    <div className={`benefit ${tone}`}>
      <b><CountUp value={value} digits={digits} /> <small>{unit}</small></b>
      <span>{label}</span>
      <span className="benefit-art" aria-hidden="true">{icon}</span>
    </div>
  );
}

function PriceTrend({ tariff, onSet }) {
  const W = 320, H = 170, L = 30, B = 22, T = 8;
  const hours = Array.from({ length: 97 }, (_, i) => i / 4);
  const max = tariff ? Math.max(1, ...hours.map((h) => Math.max(priceAt(tariff, h), priceAt(tariff, h, 'exportPrice')))) : 1;
  const top = Math.ceil(max * 1.2);
  const x = (h) => L + (h / 24) * (W - L - 6), y = (v) => T + (1 - v / top) * (H - T - B);
  const path = (k) => hours.map((h, i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(priceAt(tariff, h, k)).toFixed(1)}`).join('');
  const ticks = Array.from({ length: 6 }, (_, i) => (top * i) / 5);
  return (
    <div className="price">
      <div className="graph-unit">{tariff ? `${tariff.currency}/kWh` : '-/kWh'}</div>
      <div className={tariff ? 'graph-plot' : 'graph-plot price-empty'}>
        <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg" role="img" aria-label="Electricity price through the day">
          {ticks.map((t) => <g key={t}><line x1={L} x2={W - 6} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={L - 5} y={y(t) + 3} textAnchor="end" className="tick">{+t.toFixed(1)}</text></g>)}
          {[0, 4, 8, 12, 16, 20].map((h) => <text key={h} x={x(h)} y={H - 6} textAnchor="middle" className="tick">{String(h).padStart(2, '0')}:00</text>)}
          {tariff && <>
            <path d={path('importPrice')} fill="none" stroke="#eda100" strokeWidth="2" />
            <path d={path('exportPrice')} fill="none" stroke="#eb6834" strokeWidth="2" />
          </>}
        </svg>
        {!tariff && <button className="pill" onClick={onSet}><TariffIcon /> Tariff Setting</button>}
      </div>
      <div className="chips static">
        <span className="chip on"><span className="dot" style={{ background: '#eda100' }} />Import Price</span>
        <span className="chip on"><span className="dot" style={{ background: '#eb6834' }} />Export Price</span>
        {tariff && <button className="chip" onClick={onSet}>Edit</button>}
      </div>
    </div>
  );
}

function Sheet({ items, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {items.map((it) => <button key={it.label} className="sheet-item" onClick={() => { onClose(); it.onClick(); }}>{it.label}</button>)}
        <button className="sheet-item muted" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="skeleton-wrap" aria-label="Loading">
      <div className="skeleton" style={{ height: 300, borderRadius: 20 }} />
      <div className="skeleton" style={{ height: 22, width: 140, margin: '24px 0 12px' }} />
      <div className="skeleton" style={{ height: 190, borderRadius: 18 }} />
      <div className="tiles" style={{ marginTop: 12 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 18 }} />)}</div>
    </div>
  );
}
