import { useEffect, useState } from 'react';
import Home from './screens/Home.jsx';
import Device from './screens/Device.jsx';
import Intelligence from './screens/Intelligence.jsx';
import Service from './screens/Service.jsx';
import Me from './screens/Me.jsx';
import { HomeIcon, DeviceIcon, IntelIcon, ServiceIcon, MeIcon } from './components/Icons.jsx';

const ALL_TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon, Screen: Home },
  { id: 'device', label: 'Device', Icon: DeviceIcon, Screen: Device },
  { id: 'intelligence', label: 'Intelligence', Icon: IntelIcon, Screen: Intelligence },
  { id: 'service', label: 'Service', Icon: ServiceIcon, Screen: Service },
  { id: 'me', label: 'Me', Icon: MeIcon, Screen: Me },
];

// The SolaX-style 5-tab plant app. `embedded` = opened from the business Plants list (no Me tab, no URL hash).
export function PlantTabs({ plant, plants, onPlantChange, user, onLogout, embedded = false, MeScreen }) {
  const tabs = (embedded ? ALL_TABS.filter((t) => t.id !== 'me') : ALL_TABS)
    .map((t) => (t.id === 'me' && MeScreen ? { ...t, Screen: MeScreen } : t));
  const [tab, setTab] = useState(() => (!embedded && tabs.find((t) => t.id === location.hash.slice(1))?.id) || 'home');

  useEffect(() => {
    if (!embedded) history.replaceState(history.state, '', `#${tab}`);
    window.scrollTo(0, 0);
  }, [tab, embedded]);

  const { Screen } = tabs.find((t) => t.id === tab);
  return (
    <div className="app">
      <main className="screen">
        <div key={`${tab}-${plant.plantId}`} className="tab-view">
          <Screen plant={plant} plants={plants} onPlantChange={onPlantChange} goTab={setTab} user={user} onLogout={onLogout} />
        </div>
      </main>
      <nav className={embedded ? 'tabbar four' : 'tabbar'} aria-label="Plant">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)} aria-current={tab === id}>
            <Icon active={tab === id} size={26} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
