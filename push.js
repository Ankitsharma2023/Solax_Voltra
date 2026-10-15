// Server push notifications (Web Push / VAPID).
// Stores subscriptions in data/push.json and, every 5 minutes, checks each subscribed plant for
// new SolaX alarms and for the user's Automation scenes ("battery below 20%", "inverter offline"…).

import webpush from 'web-push';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_FILE = join(import.meta.dirname, 'data', 'push.json');
const POLL_MS = 5 * 60 * 1000;

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'https://voltra.in' } = process.env;
export const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// { subs: [{ endpoint, keys, plantId, scenes: [], createdAt }], state: { [plantId]: { alarms: [ids], fired: { [sceneId]: 'YYYY-MM-DD' } } } }
let db = { subs: [], state: {} };
const loaded = readFile(DATA_FILE, 'utf8').then((t) => { db = { subs: [], state: {}, ...JSON.parse(t) }; }).catch(() => {});
const persist = async () => { await mkdir(join(DATA_FILE, '..'), { recursive: true }); await writeFile(DATA_FILE, JSON.stringify(db, null, 2)); };

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

    // Keep the server's copy of this phone's Automation scenes in sync.
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

// ---------- poller ----------

// `load(plantId)` returns { alarms, overview, plantNow } using the same SolaX client as the API routes.
// `load(plantId)` → { alarms, overview, plantNow }; `scopeOf(userId)` → 'all' | Set of plant ids | null.
export function startPushPoller(load, scopeOf, allPlantIds) {
  if (!pushEnabled) { console.log('push: disabled (no VAPID keys)'); return; }
  const tick = async () => {
    await loaded;
    // Which subscriptions care about which plant (end users: their plant; business: their whole scope).
    const watchers = new Map(); // plantId → subs
    const add = (pid, sub) => { const k = String(pid); if (!watchers.has(k)) watchers.set(k, []); watchers.get(k).push(sub); };
    let everyPlant = null;
    for (const sub of db.subs) {
      if (!sub.business) { if (sub.plantId) add(sub.plantId, sub); continue; }
      const scope = await scopeOf(sub.userId);
      if (!scope) continue;
      const ids = scope === 'all' ? (everyPlant ??= await allPlantIds()) : [...scope];
      ids.forEach((pid) => add(pid, sub));
    }
    for (const [plantId, subs] of watchers) {
      try { await checkPlant(plantId, subs, await load(plantId, subs.some((s) => !s.business))); }
      catch (e) { console.error(`push poll ${plantId}:`, e.message); }
    }
  };
  setTimeout(tick, 10_000);
  setInterval(tick, POLL_MS);
  console.log('push: poller running every 5 min');
}

async function checkPlant(plantId, subs, { alarms, overview, plantName, plantNow }) {
  const st = (db.state[plantId] ??= { alarms: null, fired: {} });
  const today = plantNow.slice(0, 10), hhmm = plantNow.slice(11, 16), weekday = new Date(today + 'T12:00:00Z').getUTCDay();

  // 1) New ongoing alarms → everyone on this plant. (First run only records what's already there.)
  const ids = alarms.map((a) => `${a.deviceSn}|${a.errorCode}|${a.alarmStartTime}`);
  if (st.alarms) {
    for (const [i, a] of alarms.entries()) {
      if (st.alarms.includes(ids[i])) continue;
      for (const s of subs) {
        await send(s, s.business
          ? { title: `⚠️ ${plantName}: ${a.alarmName}`, body: `${a.deviceSn} · since ${a.alarmStartTime.slice(11, 16)}`, tag: ids[i], url: '/#alarms' }
          : { title: `⚠️ ${a.alarmName}`, body: `${a.deviceSn} · since ${a.alarmStartTime.slice(11, 16)}`, tag: ids[i], url: '/#service' });
      }
    }
  }
  st.alarms = ids;

  // 2) Automation scenes with a "notify" action (end users only), at most once per day each.
  if (!overview) { await persist(); return; }
  const soc = overview.batteries?.[0]?.batterySOC;
  const online = overview.devices?.some((d) => d.onlineStatus === 1);
  for (const s of subs.filter((x) => !x.business)) {
    for (const sc of s.scenes ?? []) {
      if (!sc.enabled || sc.action !== 'notify' || !sc.days?.includes(weekday)) continue;
      const c = sc.condition || {};
      const hit = (c.type === 'soc_below' && soc != null && soc < c.value)
        || (c.type === 'soc_above' && soc != null && soc > c.value)
        || (c.type === 'offline' && !online)
        || (c.type === 'time' && c.time && hhmm >= c.time);
      const key = `${s.endpoint.slice(-24)}|${sc.id}`;
      if (!hit || st.fired[key] === today) continue;
      st.fired[key] = today;
      const body = c.type === 'offline' ? 'Your inverter is offline.'
        : c.type === 'time' ? `Scheduled reminder (${c.time}).` : `Battery is at ${soc}%.`;
      await send(s, { title: `Voltra: ${sc.name}`, body, tag: `scene-${sc.id}`, url: '/#home' });
    }
  }
  await persist();
}
