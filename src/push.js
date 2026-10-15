// Phone side of server push: subscribe this device, keep its Automation scenes in sync with the server.

const scenes = () => { try { return JSON.parse(localStorage.getItem('voltra.scenes')) || []; } catch { return []; } };
const post = async (path, body) => {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || r.statusText);
  return b;
};

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(plantId) {
  if (!pushSupported()) throw new Error('Push notifications are not supported in this browser. On iPhone, add the app to your Home Screen first.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission was not given.');
  const { publicKey } = await (await fetch('/api/push/key')).json();
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) });
  await post('/api/push/subscribe', { subscription: sub.toJSON(), plantId, scenes: scenes() });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush() {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Notifications are not turned on.');
  return post('/api/push/test', { endpoint: sub.endpoint });
}

// Called whenever Automation scenes change.
export async function syncScenes() {
  const sub = await currentSubscription().catch(() => null);
  if (sub) await post('/api/push/scenes', { endpoint: sub.endpoint, scenes: scenes() }).catch(() => {});
}

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
