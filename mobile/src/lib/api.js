import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Same backend as the web app (server.js). The session travels as a bearer token kept in the
// phone's secure storage; the "X-Voltra-Client: app" header makes the server hand it out at login.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'https://voltra-app.onrender.com';

// SecureStore on the phone; localStorage when the app runs in a browser (expo start --web) for testing.
export const storage = Platform.OS === 'web'
  ? {
    get: async (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: async (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } },
  }
  : {
    get: (k) => SecureStore.getItemAsync(k).catch(() => null),
    set: (k, v) => (v == null ? SecureStore.deleteItemAsync(k) : SecureStore.setItemAsync(k, v)).catch(() => {}),
  };

const TOKEN_KEY = 'voltra.token';
let token = null;
let onUnauthorized = () => {};

export async function loadToken() { token = await storage.get(TOKEN_KEY); return token; }
export async function saveToken(t) { token = t || null; await storage.set(TOKEN_KEY, token); }
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  let r;
  try {
    r = await fetch(API_URL + path, {
      method,
      credentials: 'omit',
      headers: {
        'X-Voltra-Client': 'app',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No internet connection. Pull down to try again.');
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) onUnauthorized();
  if (!r.ok) throw new ApiError(r.status, data.error || `Request failed (${r.status})`);
  return data;
}

// Fetch on mount / when `path` changes, and every `refreshMs` after that (same hook as the web app).
export function useApi(path, refreshMs = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await api(path), error: null, loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }));
    }
  }, [path]);

  useEffect(() => {
    load();
    if (!refreshMs) return undefined;
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);

  return { ...state, reload: load };
}
