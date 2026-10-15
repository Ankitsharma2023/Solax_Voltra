import { useEffect, useState } from 'react';
import { api, useApi } from './api.js';
import { NavProvider } from './nav.jsx';
import Login from './screens/Login.jsx';
import BusinessApp, { PendingApproval } from './screens/business/Business.jsx';
import { PlantTabs } from './PlantTabs.jsx';
import { disablePush } from './push.js';

// Each identity gets its own app, as in SolaX:
//   End User                        → their plant (Home / Device / Intelligence / Service / Me)
//   Installer / Distributor / Admin → portfolio of plants (Overview / Plants / Alarms / Me)
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    api('/api/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null));
    const onUnauth = () => setUser(null);
    addEventListener('voltra:unauthorized', onUnauth);
    return () => removeEventListener('voltra:unauthorized', onUnauth);
  }, []);

  async function logout() {
    await disablePush().catch(() => {}); // stop this phone getting another account's alerts
    await fetch('/api/auth/logout', { method: 'POST' });
    try { ['voltra.plant', 'voltra.scenes', 'voltra.tou', 'voltra.workmode'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
    history.replaceState(null, '', '/');
    setUser(null);
  }

  if (user === undefined) return <div className="app"><Splash loading /></div>;
  if (!user) return <Login onLoggedIn={setUser} />;
  if (user.status !== 'active') return <PendingApproval user={user} onLogout={logout} />;
  const business = ['installer', 'distributor', 'admin'].includes(user.role);
  return (
    <NavProvider key={user.id}>
      {business ? <BusinessApp user={user} onLogout={logout} /> : <CustomerApp user={user} onLogout={logout} />}
    </NavProvider>
  );
}

function CustomerApp({ user, onLogout }) {
  const plants = useApi('/api/plants');
  const [plantId, setPlantId] = useState(() => { try { return localStorage.getItem('voltra.plant'); } catch { return null; } });

  useEffect(() => {
    if (plants.data?.length && !plants.data.some((p) => p.plantId === plantId)) setPlantId(plants.data[0].plantId);
  }, [plants.data, plantId]);
  useEffect(() => { try { plantId && localStorage.setItem('voltra.plant', plantId); } catch { /* ignore */ } }, [plantId]);

  const plant = plants.data?.find((p) => p.plantId === plantId);
  if (plants.error) return <div className="app"><div className="empty err">{plants.error.message}</div></div>;
  if (!plant) return <div className="app"><Splash loading={plants.loading} onLogout={onLogout} /></div>;
  return <PlantTabs key={plant.plantId} plant={plant} plants={plants.data} onPlantChange={setPlantId} user={user} onLogout={onLogout} />;
}

function Splash({ loading, onLogout }) {
  return (
    <div className="splash">
      <img src="/voltra-logo.png" alt="Voltra" width="163" height="72" className="splash-logo" />
      <span className="muted">{loading ? 'Connecting to your system…' : 'No system is linked to this account yet. Please contact Voltra support.'}</span>
      {!loading && onLogout && <button className="text-btn" onClick={onLogout}>Log out</button>}
    </div>
  );
}
