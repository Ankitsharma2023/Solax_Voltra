import { useEffect, useState } from 'react';
import { useApi, fmt } from '../api.js';
import { Page } from '../nav.jsx';
import { buildCards, DataSections } from './Device.jsx';

const EVERY_S = 60;

// Live Data (SolaX Me → Application → Live Data): every reading of every device on one screen,
// refreshed every minute while it is open.
export default function LiveData({ plant }) {
  const overview = useApi(`/api/plants/${plant.plantId}/overview`, EVERY_S * 1000);
  const [left, setLeft] = useState(EVERY_S);
  const [pick, setPick] = useState(null);

  useEffect(() => { setLeft(EVERY_S); }, [overview.data]);
  useEffect(() => {
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const cards = overview.data ? buildCards(overview.data).filter((c) => c.kind !== 'dongle') : [];
  const card = cards.find((c) => c.key === pick) || cards[0];
  const inv = overview.data?.inverters?.[0] || {};
  const bat = overview.data?.batteries?.[0];
  const solar = inv.MPPTTotalInputPower ?? 0, batteryW = bat?.chargeDischargePower ?? 0, gridW = inv.gridPower ?? 0;
  const flows = [
    ['Solar', solar, 'W', '#eda100'],
    ['Home', Math.max(0, solar - batteryW - gridW), 'W', '#6250d6'],
    bat && [batteryW >= 0 ? 'Battery charging' : 'Battery discharging', Math.abs(batteryW), 'W', '#1baf7a'],
    [gridW >= 0 ? 'Grid export' : 'Grid import', Math.abs(gridW), 'W', '#2a78d6'],
  ].filter(Boolean);

  return (
    <Page title="Live Data" subtitle={plant.plantName}
      actions={<button className="icon-btn live-pill" onClick={() => overview.reload()} aria-label="Refresh now"><span className="live-dot" />LIVE</button>}>
      <div className="live-bar">
        <span className="muted">{inv.plantLocalTime ? `Reading from ${inv.plantLocalTime.slice(11, 16)}` : 'Connecting…'}</span>
        <span className="live-count"><svg width="18" height="18" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e8eb" strokeWidth="4" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="#14b8a6" strokeWidth="4" strokeDasharray={`${(left / EVERY_S) * 94.2} 94.2`} transform="rotate(-90 18 18)" />
        </svg>{left}s</span>
      </div>

      {overview.error && <div className="empty err">{overview.error.message}</div>}
      {!overview.data ? <div className="skeleton" style={{ height: 160, borderRadius: 18 }} /> : (
        <>
          <div className="card">
            <div className="data-tiles two">
              {flows.map(([label, v, unit, color]) => (
                <div key={label} className="data-tile live-tile" style={{ '--c': color }}>
                  <span className="muted">{label}</span><b className="big">{fmt(v, 0)} <small>{unit}</small></b>
                </div>
              ))}
              {bat && <div className="data-tile live-tile" style={{ '--c': '#1baf7a' }}><span className="muted">Battery SOC</span><b className="big">{fmt(bat.batterySOC, 0)} <small>%</small></b></div>}
              <div className="data-tile live-tile" style={{ '--c': '#9aa2aa' }}><span className="muted">Inverter temperature</span><b className="big">{fmt(inv.inverterTemperature, 0)} <small>°C</small></b></div>
            </div>
          </div>

          {cards.length > 1 && (
            <div className="chips device-chips">
              {cards.map((c) => (
                <button key={c.key} className={c === card ? 'chip on' : 'chip'} onClick={() => setPick(c.key)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {card && <DataSections card={card} />}
        </>
      )}
    </Page>
  );
}
