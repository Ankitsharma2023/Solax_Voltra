import { useState } from 'react';
import { useApi, modelName } from '../api.js';
import { Page } from '../nav.jsx';

const LEVEL = { 1: 'Notice', 2: 'Warning', 3: 'Fault' };

export default function Alarms({ plant }) {
  const [tab, setTab] = useState('current');
  const res = useApi(`/api/plants/${plant.plantId}/alarms?state=${tab === 'current' ? 1 : 0}`);
  return (
    <Page title="Alarms" subtitle={plant.plantName}>
      <div className="segmented">
        <button className={tab === 'current' ? 'on' : ''} onClick={() => setTab('current')}>Current</button>
        <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History</button>
      </div>
      {res.error ? <div className="empty err">{res.error.message}</div>
        : !res.data ? <div className="empty">Loading…</div>
        : !res.data.length ? (
          <div className="card empty-state">
            <div className="ok-circle">✓</div>
            <b>{tab === 'current' ? 'No active alarms' : 'No alarm history'}</b>
            <span className="muted">{tab === 'current' ? 'Your system is running normally.' : 'Nothing has been recorded yet.'}</span>
          </div>
        ) : res.data.map((a, i) => (
          <div key={i} className="card alarm-card">
            <div className="alarm-top">
              <span className={`level l${a.alarmLevel}`}>{LEVEL[a.alarmLevel] || 'Alarm'}</span>
              <span className="muted">Code {a.errorCode}</span>
            </div>
            <b>{a.alarmName}</b>
            <span className="muted">{modelName(Number(a.deviceModel))} · {a.deviceSn}</span>
            <span className="muted">
              {a.alarmStartTime}{a.alarmEndTime ? ` → ${a.alarmEndTime.slice(11)}` : ' · ongoing'}
            </span>
            {a.suggestion && <p className="hint">{a.suggestion}</p>}
          </div>
        ))}
    </Page>
  );
}
