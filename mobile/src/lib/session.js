import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, loadToken, saveToken, setUnauthorizedHandler, storage } from './api';

// Signed-in user + the plant being looked at (same rules as the web app's App.jsx).
const Session = createContext(null);
export const useSession = () => useContext(Session);

const PLANT_KEY = 'voltra.plant';

export function SessionProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [plants, setPlants] = useState(null);
  const [plantId, setPlantIdState] = useState(null);
  const [plantsError, setPlantsError] = useState(null);

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await saveToken(null);
    await storage.set(PLANT_KEY, null);
    setPlants(null); setPlantIdState(null); setUser(null);
  }, []);

  const loadPlants = useCallback(async () => {
    setPlantsError(null);
    try {
      const list = await api('/api/plants');
      const saved = await storage.get(PLANT_KEY);
      setPlants(list);
      setPlantIdState(list.some((p) => p.plantId === saved) ? saved : list[0]?.plantId ?? null);
    } catch (e) { setPlantsError(e); }
  }, []);

  // Restore the saved session on launch (with no internet, Splash shows the error and a retry).
  const [bootError, setBootError] = useState(null);
  const boot = useCallback(async () => {
    setBootError(null);
    if (!(await loadToken())) return setUser(null);
    try { setUser((await api('/api/auth/me')).user); } catch (e) { if (e.status === 401) setUser(null); else setBootError(e); }
  }, []);
  useEffect(() => {
    setUnauthorizedHandler(() => { saveToken(null); setUser(null); });
    boot();
  }, [boot]);

  useEffect(() => { if (user?.status === 'active') loadPlants(); }, [user, loadPlants]);

  const signIn = useCallback(async (login, password) => {
    const r = await api('/api/auth/login', { method: 'POST', body: { login, password, remember: true } });
    await saveToken(r.token);
    setUser(r.user);
  }, []);

  const setPlantId = useCallback((id) => { setPlantIdState(id); storage.set(PLANT_KEY, id); }, []);

  const value = useMemo(() => ({
    user, bootError, retryBoot: boot, plants, plantsError, plant: plants?.find((p) => p.plantId === plantId) ?? null,
    signIn, signOut, setPlantId, reloadPlants: loadPlants,
  }), [user, bootError, boot, plants, plantsError, plantId, signIn, signOut, setPlantId, loadPlants]);

  return <Session.Provider value={value}>{children}</Session.Provider>;
}
