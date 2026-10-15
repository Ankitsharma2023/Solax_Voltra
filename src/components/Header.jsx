import { useNav } from '../nav.jsx';
import Messages, { useUnread } from '../screens/Messages.jsx';
import { AlarmIcon, MoreIcon } from './Icons.jsx';

// Plant header: name, status, and the bell → Message centre (badge = unread messages).
export default function Header({ plant, status = 'Normal', sub, actions, onMore, goTab }) {
  const { push } = useNav();
  const unread = useUnread();
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
            <button className="icon-btn" aria-label={`Messages (${unread} unread)`} onClick={() => push(Messages, { plant, onOpenTab: goTab })}>
              <AlarmIcon size={28} />{unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}
            </button>
            {onMore && <button className="icon-btn" aria-label="More" onClick={onMore}><MoreIcon size={28} /></button>}
          </>
        )}
      </div>
    </header>
  );
}
