// Server push notifications (Web Push / VAPID): stores phone subscriptions and sends to them.
// What to send and when is decided by events.js (alarms, automation, partner sign-ups).

import webpush from 'web-push';
import { kvGet, kvSet } from './store.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'https://voltra.in' } = process.env;
export const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// { subs: [{ endpoint, keys, plantId, scenes: [], createdAt }], state: { [plantId]: { alarms: [ids], fired: { [sceneId]: 'YYYY-MM-DD' } } } }
let db = { subs: [], state: {} };
// Stored as one small document ("push") in MongoDB, or data/push.json locally (see store.js).
const loaded = kvGet('push', null).then((v) => { if (v) db = { subs: [], state: {}, ...v }; }).catch((e) => console.error('push load:', e.message));
const persist = () => kvSet('push', db);

async function send(sub, payload) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 3600 });
    return true;
  } catch (err) {
    // 404/410 = the browser dropped this subscription; forget it.
    if (err.statusCode === 404 || err.statusCode === 410) {
      db.subs = db.subs.filter((s) => s.endpoint !== sub.endpoint);
      await persist();
    } else console.error('push failed:', err.statusCode || err.message);
    return false;
  }
}

// Send to every phone of the given user ids (e.g. "new installer waiting for approval").
export async function notifyUsers(userIds, payload) {
  if (!pushEnabled || !userIds.length) return;
  await loaded;
  for (const s of db.subs.filter((x) => userIds.includes(x.userId))) await send(s, payload);
}

// ---------- routes (merged into server.js routes) ----------

export function pushRoutes({ ApiError, canAccessPlant }) {
  const need = () => { if (!pushEnabled) throw new ApiError(503, 'Push is not configured (VAPID keys missing in .env).'); };
  const valid = (s) => s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.keys?.p256dh && s.keys?.auth;
  // A subscription can only be managed by the user who created it.
  const own = (endpoint, user) => {
    const sub = db.subs.find((s) => s.endpoint === endpoint);
    if (!sub || sub.userId !== user.id) throw new ApiError(404, 'Not subscribed');
    return sub;
  };

  return {
    'GET /api/push/key': async () => { need(); return { publicKey: VAPID_PUBLIC_KEY }; },

    'POST /api/push/subscribe': async (_p, _q, body, { user }) => {
      need(); await loaded;
      if (!valid(body?.subscription)) throw new ApiError(400, 'subscription required');
      const business = user.role !== 'customer';
      // End users subscribe for one plant; installers/distributors/admins get alerts for every plant they look after.
      if (!business && !body.plantId) throw new ApiError(400, 'plantId required');
      if (body.plantId && !(await canAccessPlant(user, body.plantId))) throw new ApiError(403, 'You do not have access to this plant.');
      const { endpoint, keys } = body.subscription;
      const existing = db.subs.find((s) => s.endpoint === endpoint);
      const fields = { keys, plantId: business ? null : String(body.plantId), userId: user.id, business, scenes: body.scenes ?? existing?.scenes ?? [] };
      if (existing) Object.assign(existing, fields);
      else db.subs.push({ endpoint, ...fields, createdAt: new Date().toISOString() });
      await persist();
      return { ok: true };
    },

    'POST /api/push/unsubscribe': async (_p, _q, body, { user }) => {
      await loaded;
      db.subs = db.subs.filter((s) => !(s.endpoint === body?.endpoint && s.userId === user.id));
      await persist();
      return { ok: true };
    },

    // (Kept for older app versions; scenes now live in the plant's settings.)
    'POST /api/push/scenes': async (_p, _q, body, { user }) => {
      await loaded;
      const sub = own(body?.endpoint, user);
      sub.scenes = Array.isArray(body.scenes) ? body.scenes.slice(0, 50) : [];
      await persist();
      return { ok: true, count: sub.scenes.length };
    },

    'POST /api/push/test': async (_p, _q, body, { user }) => {
      need(); await loaded;
      const sub = own(body?.endpoint, user);
      const ok = await send(sub, { title: 'Voltra', body: 'Notifications are working ✓', tag: 'test' });
      if (!ok) throw new ApiError(502, 'Push service rejected the message');
      return { ok: true };
    },
  };
}

// ---------- sending to the phones that follow a plant ----------
// End users follow the plant they subscribed with; installers/distributors/admins follow every plant in
// their scope. `scopeOf(userId)` → 'all' | Set of plant ids | null is supplied by the server (initPush).
let scopeOf = async () => null, wants = async () => true;
export function initPush(deps) { scopeOf = deps.scopeOf; wants = deps.wants ?? wants; if (!pushEnabled) console.log('push: disabled (no VAPID keys)'); }

// payloadFor(sub) lets end users and business users get different wording (business titles include the plant).
// `type` ('alarm' | 'automation') is checked against each user's Notification Settings.
export async function notifyPlant(plantId, payloadFor, type) {
  if (!pushEnabled) return;
  await loaded;
  const pid = String(plantId);
  for (const sub of [...db.subs]) {
    let follows = !sub.business && sub.plantId === pid;
    if (sub.business) { const sc = await scopeOf(sub.userId); follows = sc === 'all' || !!sc?.has?.(pid); }
    if (follows && type && !(await wants(sub.userId, type))) continue;
    const payload = follows && (typeof payloadFor === 'function' ? payloadFor(sub) : payloadFor);
    if (payload) await send(sub, payload); // null = this subscriber doesn't get this one
  }
}
