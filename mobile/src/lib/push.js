import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { api, storage } from './api';

// Phone push notifications (alarms, automation, "system connected"). The server sends them through
// Expo's push service (push.js → /api/push/expo-*), next to the website's web push.

const OFF_KEY = 'voltra.pushOff'; // the user switched push off on this phone
let token = null;

// Show alerts while the app is open, too.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export const pushSupported = Platform.OS !== 'web' && Device.isDevice;
export const pushSwitchedOff = async () => (await storage.get(OFF_KEY)) === '1';

async function getToken(ask) {
  if (!pushSupported) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Alerts', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#14b8a6',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

// Register this phone for the signed-in user. `ask` = show the permission prompt if not decided yet.
// Returns 'on' | 'denied' | 'off' | 'unsupported'.
export async function registerPush({ plantId, ask = true } = {}) {
  if (!pushSupported) return 'unsupported';
  if (await pushSwitchedOff()) return 'off';
  try {
    token = await getToken(ask);
    if (!token) return 'denied';
    await api('/api/push/expo-register', { method: 'POST', body: { token, plantId, platform: Platform.OS } });
    return 'on';
  } catch (e) {
    console.warn('push register:', e.message);
    return 'denied';
  }
}

// Stop alerts on this phone (switch off, or before logging out).
export async function unregisterPush({ remember = false } = {}) {
  if (remember) await storage.set(OFF_KEY, '1');
  if (!pushSupported) return;
  try {
    token = token || (await getToken(false));
    if (token) await api('/api/push/expo-unregister', { method: 'POST', body: { token } });
  } catch { /* already gone */ }
}

export async function switchPushOn(plantId) {
  await storage.set(OFF_KEY, null);
  return registerPush({ plantId, ask: true });
}

export async function sendTestPush() {
  token = token || (await getToken(false));
  if (!token) throw new Error('Notifications are not allowed for Voltra on this phone.');
  await api('/api/push/expo-test', { method: 'POST', body: { token } });
}

// Tapping a notification opens the matching screen (the server sends web-style links like "/#alarms").
const ROUTES = { '#alarms': '/alarms', '#messages': '/messages', '#partners': '/partners' };
export function routeForLink(url, business) {
  const hash = String(url || '').replace(/^\//, '');
  if (hash === '#alarms' && business) return '/all-alarms';
  return ROUTES[hash] || (business ? '/overview' : '/');
}

export function listenForTaps(business) {
  if (Platform.OS === 'web') return () => {};
  const open = (r) => { const url = r?.notification?.request?.content?.data?.url; if (url !== undefined) router.push(routeForLink(url, business)); };
  const last = Notifications.getLastNotificationResponse?.();
  if (last) setTimeout(() => open(last), 300);
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
