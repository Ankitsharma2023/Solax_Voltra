import { useNav } from '../nav.jsx';
import Alarms from '../screens/Alarms.jsx';
import { AlarmIcon, MoreIcon } from './Icons.jsx';

export default function Header({ plant, status = 'Normal', alarmCount = 0, sub, actions, onAlarms, onMore }) {
  const { push } = useNav();
  return (
    <header className="header">
      <div>
        <h1>{plant.plantName}</h1>
        <span className={`badge ${status.toLowerCase()}`}>{status}</span>
        {sub}
      </div>
      <div className="header-actions">
        {actions ?? (
          <>
            <button className="icon-btn" aria-label={`Alarms (${alarmCount})`} onClick={onAlarms ?? (() => push(Alarms, { plant }))}>
              <AlarmIcon size={28} />{alarmCount > 0 && <span className="count">{alarmCount}</span>}
            </button>
            {onMore && <button className="icon-btn" aria-label="More" onClick={onMore}><MoreIcon size={28} /></button>}
          </>
        )}
      </div>
    </header>
  );
}
