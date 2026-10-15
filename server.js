// Voltra x SolaX — backend.
// Holds the SolaX Client Secret server-side; the browser only ever talks to /api/*.
// Every /api route except login/sign-up needs a session; per-plant routes check plant ownership.
// Run: npm start   (Node 20.6+)

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pushRoutes, initPush, notifyPlant, notifyUsers } from './push.js';
import { startEvents } from './events.js';
import { sendCode, checkCode, isEmail, maskEmail, devCodes, sendEmail } from './mailer.js';
import { startTouScheduler, touStatus, TOU_MODES } from './tou.js';
import { plantSettingGet, plantSettingSet, storeKind, controlLogAdd, controlLogList, controlLogUpdate, controlLogByRequestId, messageAdd, messagesFor, messagesMarkRead, kvGet, kvSet } from './store.js';
import {
  findUser, createUser, updateUser, deleteUser, listUsers, getUserById, verifyPassword, plantOwners, canAccessPlant,
  publicUser, isActive, ROLES, checkThrottle, recordLogin, sessionCookie, clearCookie, userFromRequest,
  findByOrgNo, descendants, plantScope, canManage, ROOT_ORG_NO, checkPasswordStrength, viewOnlyShare, isBusiness,
} from './auth.js';
import { randomBytes } from 'node:crypto';

const APP_URL = process.env.APP_URL || 'https://voltra-app.onrender.com';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'info@voltra.in';
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const BASE = process.env.SOLAX_BASE_URL || 'https://openapi-in.solaxcloud.com';
const CLIENT_ID = process.env.SOLAX_CLIENT_ID;
const CLIENT_SECRET = process.env.SOLAX_CLIENT_SECRET;
const PORT = Number(process.env.PORT || 4300);
const BUSINESS_TYPE = 1; // 1 = Residential, 4 = Commercial & Industrial
// Commands that change the inverter are OFF unless explicitly enabled AND the app key has the scope.
const ALLOW_CONTROL = process.env.SOLAX_ALLOW_CONTROL === 'true';
const PUBLIC_DIR = join(import.meta.dirname, 'dist'); // built PWA (npm run build)
const SECURE_COOKIES = process.env.NODE_ENV === 'production'; // HTTPS only in production

// ---------- SolaX client ----------

let token = null; // { value, expiresAt }

async function getToken() {
  if (token && Date.now() < token.expiresAt) return token.value;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new ApiError(500, 'SOLAX_CLIENT_ID / SOLAX_CLIENT_SECRET missing in .env');
  }
  const res = await fetch(`${BASE}/openapi/auth/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.code !== 0 || !body.result?.access_token) {
    throw new ApiError(502, `SolaX auth failed: ${body.message || res.status}`);
  }
  // Token lives ~30 days; refresh a day early.
  token = {
    scopes: String(body.result.scope || '').split(/\s+/).filter(Boolean),
    value: body.result.access_token,
    expiresAt: Date.now() + (body.result.expires_in - 86400) * 1000,
  };
  return token.value;
}

// ---------- shared cache + rate guard ----------
// SolaX allows 100 calls/min for the whole app and data only changes every ~5 min, so reads are
// cached and shared by every user; identical requests in flight are merged into one.
const CACHE_TTL = [
  [/plant\/page_plant_info|device\/page_device_info/, 10 * 60e3],
  [/energy\/get_stat_data/, 10 * 60e3],
  [/history_data/, 4 * 60e3],
  [/realtime_data|alarm\/page_alarm_info/, 60e3],
];
const cache = new Map(); // key → { at, ttl, promise }
const MAX_CONCURRENT = 6, MAX_PER_MIN = 90;
let active = 0; const waiting = []; const sentAt = [];

async function slot() {
  for (;;) {
    while (sentAt.length && Date.now() - sentAt[0] > 60e3) sentAt.shift();
    if (active < MAX_CONCURRENT && sentAt.length < MAX_PER_MIN) { active++; sentAt.push(Date.now()); return; }
    await new Promise((r) => (active >= MAX_CONCURRENT ? waiting.push(r) : setTimeout(r, 60e3 - (Date.now() - sentAt[0]) + 50)));
  }
}
function release() { active--; waiting.shift()?.(); }

export const solaxStats = () => ({ cached: cache.size, callsLastMinute: sentAt.filter((t) => Date.now() - t < 60e3).length, active });

async function solax(method, path, opts = {}) {
  const isWrite = /\/(inverter_work_mode|inverter_vpp_mode|device_control|evc_control|control)\//.test(path);
  const ttl = isWrite ? 0 : (CACHE_TTL.find(([re]) => re.test(path))?.[1] ?? 0);
  if (!ttl) return solaxFetch(method, path, opts);
  const key = `${method} ${path} ${JSON.stringify(opts.query ?? null)} ${JSON.stringify(opts.json ?? null)}`;
  const hit = cache.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (age < ttl) return hit.promise;
  const refresh = () => {
    const promise = solaxFetch(method, path, opts);
    const entry = { at: Date.now(), ttl, promise, settled: false };
    promise.then(() => { entry.settled = true; cache.set(key, entry); }, () => {}); // keep the last good copy on failure
    if (!hit) { cache.set(key, entry); promise.catch(() => cache.delete(key)); }
    return promise;
  };
  // Stale-while-revalidate: up to 10× the TTL old, answer instantly from the last good copy and refresh behind it.
  if (hit?.settled !== false && age < ttl * 10) { if (!hit.refreshing) { hit.refreshing = true; refresh().catch(() => {}).finally(() => { hit.refreshing = false; }); } return hit.promise; }
  return refresh();
  if (cache.size > 2000) for (const [k, v] of cache) if (Date.now() - v.at > v.ttl) cache.delete(k);
  return promise;
}

const TOKEN_ERRORS = new Set([10400, 10402]);

async function solaxFetch(method, path, { query, json } = {}, retried = false) {
  const url = new URL(path, BASE);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);
  await slot();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `bearer ${await getToken()}`,
      'Content-Type': 'application/json',
    },
    body: json ? JSON.stringify(json) : undefined,
  }).finally(release);
  const body = await res.json().catch(() => ({}));
  if (body.code !== 10000) {
    // SolaX allows one active token per app: another server (or a restart) can invalidate ours.
    if (res.status === 401 || TOKEN_ERRORS.has(body.code)) {
      token = null;
      if (!retried) return solaxFetch(method, path, { query, json }, true);
    }
    throw new ApiError(502, `SolaX ${path} → code ${body.code}: ${body.message || res.status}`);
  }
  return body.result;
}

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------- API routes ----------

const PLANT_SETTING_KEYS = ['tariff', 'tou', 'scenes', 'workmode'];

// ---------- inverter control (SolaX "write" operations) ----------
// Every command: server switch on + app has the SolaX scope + user may control this plant + values
// validated here + logged (who/what/when) + result tracked via SolaX's request-result query.

const hhmm = (v, name) => { if (v == null || v === '') return undefined; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) throw new ApiError(400, `${name} must be HH:MM`); return String(v); };
const int = (v, name, lo, hi) => { const n = Number(v); if (!Number.isInteger(n) || n < lo || n > hi) throw new ApiError(400, `${name} must be a whole number from ${lo} to ${hi}`); return n; };
const dec = (v, name, lo, hi) => { const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) throw new ApiError(400, `${name} must be between ${lo} and ${hi}`); return Math.round(n * 100) / 100; };
const NEXT_MOTION = { exit: 160, self_consume: 161 };
const TIME_NAMES = Object.fromEntries([1, 2].flatMap((n) => [
  [`chargeStartTimePeriod${n}`, `Charge start time (period ${n})`], [`chargeEndTimePeriod${n}`, `Charge end time (period ${n})`],
  [`dischargeStartTimePeriod${n}`, `Discharge start time (period ${n})`], [`dischargeEndTimePeriod${n}`, `Discharge end time (period ${n})`],
]));

const workModeBody = (b, { grid = true } = {}) => {
  const minSoc = int(b.minSoc, 'Minimum battery level', 10, 100);
  const chargeUpperSoc = int(b.chargeUpperSoc, 'Charge limit', minSoc, 100);
  const out = { minSoc, chargeUpperSoc };
  if (grid) out.chargeFromGridEnable = b.chargeFromGridEnable ? 1 : 0;
  for (const k of ['chargeStartTimePeriod1', 'chargeEndTimePeriod1', 'dischargeStartTimePeriod1', 'dischargeEndTimePeriod1']) out[k] = hhmm(b[k], TIME_NAMES[k]);
  if (b.enableTimePeriod2) {
    out.enableTimePeriod2 = 1;
    for (const k of ['chargeStartTimePeriod2', 'chargeEndTimePeriod2', 'dischargeStartTimePeriod2', 'dischargeEndTimePeriod2']) out[k] = hhmm(b[k], TIME_NAMES[k]);
  } else out.enableTimePeriod2 = 0;
  return out;
};

// op → { scope, path, label, body(params, ctx) }
const CONTROL_OPS = {
  self_use: { scope: /Workmode/i, label: 'Work mode: Self Use', path: '/openapi/v2/device/inverter_work_mode/batch_set_spontaneity_self_use', body: (b) => workModeBody(b) },
  feed_in: { scope: /Workmode/i, label: 'Work mode: Feed-in Priority', path: '/openapi/v2/device/inverter_work_mode/batch_set_on_grid_first', body: (b) => workModeBody(b, { grid: false }) },
  backup: { scope: /Workmode/i, label: 'Work mode: Back Up', path: '/openapi/v2/device/inverter_work_mode/batch_set_peace_mode', body: (b) => workModeBody(b) },
  manual: {
    scope: /Workmode/i, label: 'Work mode: Manual', path: '/openapi/v2/device/inverter_work_mode/batch_set_manual_mode',
    body: (b, { ratedKw }) => {
      const manualMode = int(b.manualMode, 'Manual mode', 0, 2);
      return manualMode === 0 ? { manualMode } : { manualMode, power: dec(b.power, 'Power (kW)', 0.1, ratedKw), ...(b.targetSoc != null && b.targetSoc !== '' && { targetSoc: int(b.targetSoc, 'Target battery level', 10, 100) }) };
    },
  },
  export_limit: {
    scope: /RATE_CTRL|Overall/i, label: 'Export limit', path: '/openapi/v2/device/device_control/strategy/set_export_control',
    body: (b, { ratedKw }) => ({ deviceType: 1, isEnable: b.isEnable ? 1 : 0, limitValue: dec(b.isEnable ? b.limitValue : (b.limitValue ?? ratedKw), 'Export limit (kW)', 0, ratedKw) }),
  },
  battery_heating: {
    scope: /Overall/i, label: 'Battery heating', path: '/openapi/v2/device/config/battery/set_battery_heating',
    body: (b) => ({
      heatingEnable: b.heatingEnable ? 1 : 0,
      ...(b.heatingEnable && {
        heatingLevel: int(b.heatingLevel ?? 1, 'Heating level', 0, 2),
        heatingPeriod1StartTime: hhmm(b.heatingPeriod1StartTime, 'Period 1 start'), heatingPeriod1EndTime: hhmm(b.heatingPeriod1EndTime, 'Period 1 end'),
        heatingPeriod2StartTime: hhmm(b.heatingPeriod2StartTime, 'Period 2 start'), heatingPeriod2EndTime: hhmm(b.heatingPeriod2EndTime, 'Period 2 end'),
      }),
    }),
  },
  // Remote control (VPP): temporary, ends by itself after `durationS`.
  rc_exit: { scope: /Remote/i, label: 'Remote control: exit', path: '/openapi/v2/device/inverter_vpp_mode/exit_vpp_mode', body: () => ({}) },
  rc_self_consume: {
    scope: /Remote/i, label: 'Remote control: self-consume', path: '/openapi/v2/device/inverter_vpp_mode/self_consume/charge_or_discharge_mode',
    body: (b) => ({ timeOfDuration: int(b.durationS, 'Duration (s)', 60, 86400), nextMotion: NEXT_MOTION[b.then] ?? 160 }),
  },
  rc_zero: {
    scope: /Remote/i, label: 'Remote control: battery idle', path: '/openapi/v2/device/inverter_vpp_mode/push_power/zero_mode',
    body: (b) => ({ timeOfDuration: int(b.durationS, 'Duration (s)', 60, 86400), nextMotion: NEXT_MOTION[b.then] ?? 160 }),
  },
  rc_battery_power: {
    scope: /Remote/i, label: 'Remote control: battery power', path: '/openapi/v2/device/inverter_vpp_mode/push_power/positive_or_negative_mode',
    body: (b, { ratedKw }) => ({ batteryPower: int(b.batteryPower, 'Battery power (W, + charge / − discharge)', -ratedKw * 1000, ratedKw * 1000), timeOfDuration: int(b.durationS, 'Duration (s)', 60, 86400), nextMotion: NEXT_MOTION[b.then] ?? 160 }),
  },
  rc_soc_target: {
    scope: /Remote/i, label: 'Remote control: battery to target %', path: '/openapi/v2/device/inverter_vpp_mode/soc_target_control_mode',
    body: (b, { ratedKw }) => ({ targetSoc: int(b.targetSoc, 'Target battery level', 10, 100), chargeDischargPower: int(b.power, 'Power (W, + charge / − discharge)', -ratedKw * 1000, ratedKw * 1000) }),
  },
};
const COMMAND_STATUS = { 1: 'Device offline', 2: 'Sending failed', 3: 'Sent to device', 4: 'Device started', 5: 'Device failed', 6: 'Timed out' };
const FINAL_STATUSES = new Set([1, 2, 4, 5, 6]);

// Writes bypass the cache and need SolaX's requestId, so they use their own call.
async function solaxControl(path, json, retried = false) {
  await slot();
  const res = await fetch(new URL(path, BASE), {
    method: 'POST', headers: { Authorization: `bearer ${await getToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(json),
  }).finally(release);
  const body = await res.json().catch(() => ({}));
  if (TOKEN_ERRORS.has(body.code) && !retried) { token = null; return solaxControl(path, json, true); }
  if (body.code !== 10000) {
    const hint = { 10403: 'the SolaX app does not have this control permission yet', 10404: 'no callback address is set on the SolaX app' }[body.code];
    throw new ApiError(502, `SolaX refused the command (code ${body.code}${hint ? `: ${hint}` : ''})${body.message ? ` — ${body.message}` : ''}`);
  }
  return body;
}

let scopeCheckedAt = 0;
async function controlScopes() {
  await getToken();
  // After control permissions are added in the Developer Portal, fetch a fresh token (at most every 10 min).
  if (ALLOW_CONTROL && !token.scopes.some((x) => /Workmode|Remote|Overall|RATE_CTRL/i.test(x)) && Date.now() - scopeCheckedAt > 10 * 60e3) {
    scopeCheckedAt = Date.now(); token = null; await getToken();
  }
  return token.scopes;
}
// End users control their own plant, installers the plants they service, admins any; distributors only watch.
const mayControl = (user) => ['customer', 'installer', 'admin'].includes(user?.role);

async function refreshStatuses(entries) {
  for (const e of entries) {
    if (!e.requestId || FINAL_STATUSES.has(e.status) || Date.now() - Date.parse(e.at) > 24 * 3600e3) continue;
    try {
      const r = await solaxControl('/openapi/apiRequestLog/listByCondition', { requestId: e.requestId });
      const st = (Array.isArray(r.result) ? r.result : [])[0]?.status;
      if (st && st !== e.status) { e.status = st; e.statusText = COMMAND_STATUS[st] ?? `Status ${st}`; await controlLogUpdate(e.id, { status: st, statusText: e.statusText, checkedAt: new Date().toISOString() }); }
    } catch { /* keep last known status */ }
  }
  return entries;
}

// Send one command to a plant's inverter(s): validate, check switch + scope + online, send, log.
// Used by the app (POST /control/:op) and by the TOU scheduler (actor = { login: 'TOU schedule', role: 'system' }).
async function runControl(plantId, op, body, actor) {
  const id = String(plantId);
  const def = CONTROL_OPS[op];
  if (!def) throw new ApiError(400, `Unknown command "${op}"`);
  const devices = (await solax('GET', '/openapi/v2/device/page_device_info', { query: { plantId: id, deviceType: 1, businessType: BUSINESS_TYPE } })).records ?? [];
  if (!devices.length) throw new ApiError(400, 'No inverter on this plant.');
  const ratedKw = Math.max(...devices.map((d) => Number(d.ratedPower) || 0)) || 10;
  const params = def.body(body ?? {}, { ratedKw }); // value checks first, so mistakes are explained clearly
  for (const k of Object.keys(params)) if (params[k] === undefined) delete params[k];
  if (!ALLOW_CONTROL) throw new ApiError(403, 'Inverter control is switched off on this server.');
  if (!(await controlScopes()).some((x) => def.scope.test(x))) throw new ApiError(403, 'The SolaX app does not have permission for this command yet.');
  if (!devices.some((d) => d.onlineStatus === 1)) throw new ApiError(409, 'The inverter is offline, so it cannot receive commands right now.');
  const json = { snList: devices.map((d) => d.deviceSn).slice(0, 10), businessType: BUSINESS_TYPE, ...params };

  const entry = { id: randomBytes(8).toString('hex'), plantId: id, op, label: def.label, params, by: actor.login, byRole: actor.role, at: new Date().toISOString() };
  try {
    const r = await solaxControl(def.path, json);
    const st = Object.values(r.result ?? {})[0]?.status;
    Object.assign(entry, { requestId: r.requestId ?? null, status: st ?? 3, statusText: COMMAND_STATUS[st ?? 3] });
  } catch (e) {
    Object.assign(entry, { status: 0, statusText: 'Refused', error: e.message });
    await controlLogAdd(entry);
    throw e;
  }
  await controlLogAdd(entry);
  if (actor.role !== 'system') {
    await messageAdd({ plantId: id, type: 'control', title: def.label, body: `Changed by ${actor.login}`, link: 'history' }).catch(() => {});
  }
  console.log(`control ${op} plant=${id} by=${actor.login} request=${entry.requestId} status=${entry.status}`);
  return entry;
}

const routes = {
  // What this user may do on this deployment (the app greys out control screens otherwise).
  'GET /api/capabilities': async (_p, q, _b, { user }) => {
    const scopes = await controlScopes();
    const viewOnly = q.get('plant') ? await viewOnlyShare(user, q.get('plant')) : false;
    const ops = Object.fromEntries(Object.entries(CONTROL_OPS).map(([k, op]) => [k, ALLOW_CONTROL && scopes.some((x) => op.scope.test(x))]));
    const may = mayControl(user) && !viewOnly;
    return { control: may && Object.values(ops).some(Boolean), ops, controlEnabledOnServer: ALLOW_CONTROL, mayControl: may, viewOnly, scopes };
  },

  // Send one inverter command. Body = the operation's parameters (validated per op).
  'POST /api/plants/:id/control/:op': async ({ id, op }, _q, body, { user }) => {
    if (!mayControl(user) || (await viewOnlyShare(user, id))) throw new ApiError(403, 'Your account can view this plant but not change inverter settings.');
    return runControl(id, op, body, { login: user.login, role: user.role });
  },

  // Recent commands for a plant, with their latest status from SolaX.
  'GET /api/plants/:id/control/log': async ({ id }) => refreshStatuses(await controlLogList(id, 30)),

  // Plants the signed-in user may see (admins: all plants on the Voltra SolaX account).
  'GET /api/plants': async (_p, _q, _b, { user }) => {
    const scope = await plantScope(user);
    const all = await allPages('/openapi/v2/plant/page_plant_info', {});
    return all.filter((pl) => scope === 'all' || scope.has(String(pl.plantId)))
      .map((pl) => (user.shares?.[pl.plantId] && !user.plantIds.includes(String(pl.plantId)) ? { ...pl, sharedPerm: user.shares[pl.plantId].perm } : pl));
  },

  // Everything the dashboard needs for one plant in a single call.
  'GET /api/plants/:id/overview': async ({ id }) => {
    const [totals, devices] = await Promise.all([
      solax('GET', '/openapi/v2/plant/realtime_data', { query: { plantId: id, businessType: BUSINESS_TYPE } }),
      solax('GET', '/openapi/v2/device/page_device_info', { query: { plantId: id, deviceType: 1, businessType: BUSINESS_TYPE } }),
    ]);
    const inverterSns = (devices.records ?? []).map((d) => d.deviceSn).slice(0, 10);

    let inverters = [], batteries = [];
    if (inverterSns.length) {
      const snList = inverterSns.join(',');
      [inverters, batteries] = await Promise.all([
        solax('GET', '/openapi/v2/device/realtime_data', { query: { snList, deviceType: 1, businessType: BUSINESS_TYPE } }),
        // Batteries looked up via their inverter's SN (requestSnType=1).
        solax('GET', '/openapi/v2/device/realtime_data', { query: { snList, deviceType: 2, requestSnType: 1, businessType: BUSINESS_TYPE } })
          .catch(() => []), // plant may have no battery
      ]);
    }
    return { totals, devices: devices.records ?? [], inverters, batteries };
  },

  // Monthly (dateType=2, date=YYYY-MM) or yearly (dateType=1, date=YYYY) energy stats.
  'GET /api/plants/:id/stats': async ({ id }, q) =>
    solax('POST', '/openapi/v2/plant/energy/get_stat_data', {
      json: { plantId: id, dateType: q.get('dateType') || '2', date: q.get('date'), businessType: String(BUSINESS_TYPE) },
    }),

  // ?state=1 ongoing (default), ?state=0 closed/history
  'GET /api/plants/:id/alarms': async ({ id }, q) =>
    ((await solax('GET', '/openapi/v2/alarm/page_alarm_info', {
      query: { plantId: id, alarmState: q.get('state') ?? 1, businessType: BUSINESS_TYPE, pageNo: q.get('page') ?? 1 },
    })).records ?? []).map(fixAlarmTimes),

  // Raw 5-min history rows for one device over a plant-local day (for the Live Data "Curve" view).
  // ?type=1 inverter (default) | 2 battery (looked up via inverter SN)
  'GET /api/plants/:id/devices/:sn/history': async ({ id, sn }, q) => {
    const plant = await getPlant(id);
    const offsetMs = tzOffsetMs(plant.plantTimeZone);
    const date = q.get('date') || new Date(Date.now() + offsetMs).toISOString().slice(0, 10);
    const start = Date.parse(`${date}T00:00:00Z`) - offsetMs;
    const end = Math.min(start + 24 * 3600e3 - 1, Date.now());
    const type = Number(q.get('type') || 1);
    const halves = [[start, Math.min(start + 12 * 3600e3, end)], [start + 12 * 3600e3, end]].filter(([a, b]) => b > a);
    const rows = (await Promise.all(halves.map(([startTime, endTime]) =>
      solax('GET', '/openapi/v2/device/history_data', {
        query: { snList: sn, deviceType: type, businessType: BUSINESS_TYPE, startTime, endTime, timeInterval: 5, ...(type === 2 && { requestSnType: 1 }) },
      }).catch(() => [])))).flat();
    return { date, rows: rows.sort((a, b) => a.plantLocalTime.localeCompare(b.plantLocalTime)) };
  },

  // Power curve for one day (plant local date, YYYY-MM-DD; default today).
  // SolaX caps each history query at 12h, so the day is fetched in two halves.
  'GET /api/plants/:id/day': async ({ id }, q) => {
    const plant = await getPlant(id);
    const offsetMs = tzOffsetMs(plant.plantTimeZone);
    const date = q.get('date') || new Date(Date.now() + offsetMs).toISOString().slice(0, 10);
    const start = Date.parse(`${date}T00:00:00Z`) - offsetMs;
    const end = Math.min(start + 24 * 3600e3 - 1, Date.now());
    const sn = (await listInverterSns(id))[0];
    if (!sn) return { date, points: [] };

    const halves = [[start, Math.min(start + 12 * 3600e3, end)], [start + 12 * 3600e3, end]].filter(([a, b]) => b > a);
    const fetchHistory = (deviceType, extra = {}) => Promise.all(halves.map(([startTime, endTime]) =>
      solax('GET', '/openapi/v2/device/history_data', {
        query: { snList: sn, deviceType, businessType: BUSINESS_TYPE, startTime, endTime, timeInterval: 5, ...extra },
      }).catch(() => []))).then((r) => r.flat());

    const [inv, bat] = await Promise.all([fetchHistory(1), fetchHistory(2, { requestSnType: 1 })]);
    const batByTime = new Map(bat.map((b) => [b.plantLocalTime, b]));
    const points = inv.map((r) => {
      const b = batByTime.get(r.plantLocalTime) || {};
      const solar = r.MPPTTotalInputPower ?? sumKeys(r.mpptMap, /^mppt\d+power$/i) ?? 0;
      const battery = b.chargeDischargePower ?? null; // + charging, − discharging
      const grid = r.gridPower ?? 0;                  // + export, − import
      return {
        time: r.plantLocalTime,
        solar,
        inverter: sumKeys(r, /^acPower\d$/) ?? r.totalActivePower ?? null,
        eps: sumKeys(r, /^EPSL\dActivePower$/) ?? null,
        soc: b.batterySOC ?? null,
        battery,
        grid,
        consumption: Math.max(0, solar - (battery ?? 0) - grid),
      };
    }).sort((a, b) => a.time.localeCompare(b.time));
    return { date, points };
  },

  // Per-plant app settings stored by Voltra (SolaX has no endpoints for these).
  'GET /api/plants/:id/settings': async ({ id }) => {
    const out = {};
    for (const k of PLANT_SETTING_KEYS) out[k] = await plantSettingGet(id, k);
    return out;
  },
  'POST /api/plants/:id/settings/:key': async ({ id, key }, _q, body, { user }) => {
    if (!PLANT_SETTING_KEYS.includes(key)) throw new ApiError(400, `Unknown setting "${key}"`);
    if (await viewOnlyShare(user, id)) throw new ApiError(403, 'This system was shared with you as view only.');
    if (JSON.stringify(body?.value ?? null).length > 20_000) throw new ApiError(413, 'Setting too large');
    let value = body?.value ?? null;
    if (key === 'tou' && value) value = validateTou(value, user);
    if (key === 'scenes' && value) value = validateScenes(value, user);
    await plantSettingSet(id, key, value, user.login);
    return { ok: true };
  },

  // Statistical report: energy totals per plant for a month (dateType=2, YYYY-MM) or year (1, YYYY).
  'GET /api/reports/statistics': async (_p, q, _b, { user }) => {
    const scope = await plantScope(user);
    const plants = (await allPages('/openapi/v2/plant/page_plant_info', {})).filter((pl) => scope === 'all' || scope.has(String(pl.plantId)));
    const dateType = q.get('dateType') === '1' ? '1' : '2';
    const date = q.get('date') || new Date().toISOString().slice(0, dateType === '1' ? 4 : 7);
    const keys = ['pvGeneration', 'loadConsumption', 'importEnergy', 'exportEnergy', 'batteryCharged', 'batteryDischarged'];
    const rows = await Promise.all(plants.map(async (pl) => {
      const list = await solax('POST', '/openapi/v2/plant/energy/get_stat_data', {
        json: { plantId: String(pl.plantId), dateType, date, businessType: String(BUSINESS_TYPE) },
      }).then((r) => r.plantEnergyStatDataList ?? []).catch(() => []);
      const sum = Object.fromEntries(keys.map((k) => [k, Math.round(list.reduce((a, r) => a + Math.abs(Number(r[k]) || 0), 0) * 100) / 100]));
      return { plantId: String(pl.plantId), plantName: pl.plantName, pvCapacity: pl.pvCapacity, ...sum, yieldPerKwp: pl.pvCapacity ? Math.round((sum.pvGeneration / pl.pvCapacity) * 100) / 100 : null };
    }));
    return { date, dateType, rows: rows.sort((a, b) => a.plantName.localeCompare(b.plantName)) };
  },

  // What the TOU schedule is doing right now.
  'GET /api/plants/:id/tou/status': async ({ id }) => touStatus(id, await plantSettingGet(id, 'tou'), await getPlant(id), tzOffsetMs),

  // Today's min/max temperature at the plant. Open-Meteo first; MET Norway as a fallback (free APIs often
  // throttle shared cloud IPs). Cached 30 min per plant.
  'GET /api/plants/:id/weather': async ({ id }) => {
    const hit = weatherCache.get(id);
    if (hit && Date.now() - hit.at < 30 * 60e3) return hit.value;
    const { latitude: lat, longitude: lon } = await getPlant(id);
    if (lat == null) return null;
    const value = await openMeteo(lat, lon).catch((e) => { console.error('weather open-meteo:', e.message); return null; })
      ?? await metNorway(lat, lon).catch((e) => { console.error('weather met.no:', e.message); return null; });
    if (value) weatherCache.set(id, { at: Date.now(), value });
    return value ?? hit?.value ?? null;
  },
};

// ---------- auth routes ----------

const PUBLIC_ROUTES = new Set([
  'POST /api/auth/login', 'POST /api/auth/register', 'POST /api/auth/logout', 'GET /api/auth/me', 'GET /api/push/key',
  'POST /api/auth/send-code', 'POST /api/auth/forgot', 'POST /api/auth/reset-password', 'GET /api/auth/config',
  'GET /api/health', 'POST /api/solax/callback',
]);
// Behind Render's proxy every request comes from the proxy; the visitor is the first X-Forwarded-For entry.
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.RENDER === 'true';
const clientIp = (req) => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

Object.assign(routes, {
  // Message centre: everything about the plants this user can see, plus messages addressed to them.
  'GET /api/messages': async (_p, _q, _b, { user }) => {
    const list = await messagesFor(user.id, await plantScope(user), 80);
    return { unread: list.filter((m) => !m.read).length, messages: list };
  },
  'POST /api/messages/read': async (_p, _q, body, { user }) => {
    const ids = body?.all ? 'all' : (Array.isArray(body?.ids) ? body.ids.slice(0, 200).map(String) : []);
    await messagesMarkRead(user.id, await plantScope(user), ids);
    return { ok: true };
  },
  // Personal preferences (e-mail alarm alerts).
  'POST /api/me/prefs': async (_p, _q, body, { user }) => {
    const patch = {};
    if (body?.emailAlerts != null) patch.emailAlerts = !!body.emailAlerts;
    if (body?.notify) patch.notify = Object.fromEntries(['alarm', 'automation'].filter((k) => k in body.notify).map((k) => [k, !!body.notify[k]]));
    if (body?.name != null) patch.name = String(body.name).trim();
    const u = await updateUser(user.id, patch);
    return { user: publicUser(u) };
  },

  // Render health check: process up and storage reachable.
  'GET /api/health': async () => { await listUsers(); return { ok: true, storage: storeKind }; },

  'GET /api/auth/me': async (_p, _q, _b, { user }) => ({ user: publicUser(user) }),

  // devCodes = no SMTP configured (local testing): codes go to the server log.
  'GET /api/auth/config': async () => ({ devCodes }),

  // Sign-up step: "Send Verification Code" to the e-mail address.
  'POST /api/auth/send-code': async (_p, _q, body, { req }) => {
    const email = String(body?.email || '').trim().toLowerCase();
    if (!isEmail(email)) throw new ApiError(400, 'Please enter a valid e-mail address.');
    if (await findUser(email)) throw new ApiError(409, 'An account with this e-mail already exists. Please log in.');
    const locked = checkThrottle(clientIp(req), 'send-code');
    if (locked) throw new ApiError(429, locked);
    try { await sendCode(email, 'signup'); } catch (e) { throw new ApiError(429, e.message); }
    return { sentTo: maskEmail(email), devCodes };
  },

  // Forgot password, step 1 (as in SolaX): account → code sent to its registered e-mail.
  'POST /api/auth/forgot': async (_p, _q, body, { req }) => {
    const locked = checkThrottle(clientIp(req), 'forgot');
    if (locked) throw new ApiError(429, locked);
    const user = await findUser(body?.login || '');
    recordLogin(clientIp(req), 'forgot', !!user);
    if (!user) throw new ApiError(404, 'Account not found. Please check your user name/e-mail/mobile number.');
    if (!isEmail(user.login)) throw new ApiError(400, 'This account has no e-mail address. Please contact Voltra support to reset your password.');
    try { await sendCode(user.login, 'reset'); } catch (e) { throw new ApiError(429, e.message); }
    return { sentTo: maskEmail(user.login), devCodes };
  },

  // Forgot password, step 2: code + new password → signed in.
  'POST /api/auth/reset-password': async (_p, _q, body, { res }) => {
    const user = await findUser(body?.login || '');
    if (!user || !isEmail(user.login)) throw new ApiError(400, 'Incorrect verification code.');
    try { checkPasswordStrength(body?.password); } catch (e) { throw new ApiError(400, e.message); } // before the code is used up
    const bad = checkCode(user.login, 'reset', body?.code);
    if (bad) throw new ApiError(400, bad);
    let updated;
    try { updated = await updateUser(user.id, { password: body?.password }); } catch (e) { throw new ApiError(400, e.message); }
    res.setHeader('Set-Cookie', sessionCookie(updated, true, SECURE_COOKIES)); // other devices are signed out
    return { user: publicUser(updated) };
  },

  'POST /api/auth/login': async (_p, _q, body, { req, res }) => {
    const { login, remember } = body || {};
    const password = typeof body?.password === 'string' ? body.password.trim() : ''; // ignore copy-paste spaces
    if (!login || !password) throw new ApiError(400, 'Enter your email/mobile number and password.');
    const locked = checkThrottle(clientIp(req), login);
    if (locked) throw new ApiError(429, locked);
    const user = await findUser(login);
    const ok = await verifyPassword(user, password);
    recordLogin(clientIp(req), login, ok);
    if (!ok) throw new ApiError(401, 'Incorrect account or password.');
    res.setHeader('Set-Cookie', sessionCookie(user, !!remember, SECURE_COOKIES));
    return { user: publicUser(user) };
  },

  'POST /api/auth/logout': async (_p, _q, _b, { res }) => {
    res.setHeader('Set-Cookie', clearCookie(SECURE_COOKIES));
    return { ok: true };
  },

  // Sign-up, by identity (as in SolaX): "end_user" proves ownership with the inverter SN + dongle
  // registration no. printed on the hardware; "installer"/"distributor" accounts wait for Voltra approval.
  'POST /api/auth/register': async (_p, _q, body, { req, res }) => {
    const { identity = 'end_user', name, password, inverterSn, registerNo, company, phone, agree, code } = body || {};
    const login = String(body?.login || '').trim().toLowerCase();
    if (!agree) throw new ApiError(400, 'Please accept the Privacy Policy and User Terms.');
    if (!login || !password) throw new ApiError(400, 'Please fill in all fields.');
    if (!isEmail(login)) throw new ApiError(400, 'Please enter a valid e-mail address.');
    if (await findUser(login)) throw new ApiError(409, 'An account with this e-mail already exists. Please log in.');
    try { checkPasswordStrength(password); } catch (e) { throw new ApiError(400, e.message); } // before the code is used up
    // E-mail verification code (SolaX "Verification Code*") — checked last so other mistakes don't burn the code.
    const verify = () => { const bad = checkCode(login, 'signup', code); if (bad) throw new ApiError(400, bad); };
    let user;
    if (identity === 'installer' || identity === 'distributor') {
      const { zip, orgNo } = body;
      if (!company) throw new ApiError(400, 'Please enter your company name.');
      if (identity === 'installer' && !zip) throw new ApiError(400, 'Please enter your zip code.');
      if (identity === 'distributor' && !orgNo) throw new ApiError(400, 'Please enter the Distributor Organization Number of your superior channel partner.');
      let parent = null;
      if (orgNo) {
        parent = await findByOrgNo(orgNo);
        if (!parent) throw new ApiError(400, 'Distributor Organization Number not found. Please check it with your superior channel partner.');
        if (!parent.root && (parent.role !== 'distributor' || !isActive(parent))) throw new ApiError(400, 'That Organization Number does not belong to an active distributor.');
      }
      const parentId = parent && !parent.root ? parent.id : null;
      verify();
      try { user = await createUser({ login, password, name, company, phone, zip, parentId, role: identity, status: 'pending' }); }
      catch (e) { throw new ApiError(400, e.message); }
      await notifySignup(user, parentId);
    } else {
      const invites = (await kvGet('share_invites', [])).filter((i) => i.email === login);
      if (!(inverterSn || registerNo) && invites.length) {
        // Someone shared their system with this e-mail: no hardware numbers needed.
        verify();
        try { user = await createUser({ login, password, name, phone }); }
        catch (e) { throw new ApiError(400, e.message); }
      } else {
        if (!inverterSn || !registerNo) throw new ApiError(400, 'Please enter the inverter SN and registration number.');
        const plantId = await claimablePlant(req, inverterSn, registerNo, 'customer');
        verify();
        try { user = await createUser({ login, password, name, phone, plantIds: [plantId] }); }
        catch (e) { throw new ApiError(400, e.message); }
      }
      if (invites.length) {
        user = await updateUser(user.id, { shares: Object.fromEntries(invites.map((i) => [i.plantId, { perm: i.perm, by: i.by, at: i.at }])) });
        await kvSet('share_invites', (await kvGet('share_invites', [])).filter((i) => i.email !== login));
      }
    }
    res.setHeader('Set-Cookie', sessionCookie(user, true, SECURE_COOKIES));
    return { user: publicUser(user) };
  },

  // Link another plant to the signed-in account (end users: second home; installers: a new site).
  'POST /api/me/plants': async (_p, _q, body, { req, user }) => {
    if (!isActive(user)) throw new ApiError(403, 'Your account is waiting for approval by Voltra.');
    if (user.role === 'admin') throw new ApiError(400, 'Admins already see every plant.');
    const plantId = await claimablePlant(req, body?.inverterSn, body?.registerNo, user.role);
    if (user.plantIds.includes(plantId)) throw new ApiError(409, 'This system is already in your list.');
    await updateUser(user.id, { addPlant: plantId });
    return { plantId };
  },

  // ---------- Plant Sharing (SolaX "Plant Sharing"): the owner, their installer or Voltra share a system
  // by e-mail, view only or with control. Someone without an account gets an invitation and can sign up
  // with that e-mail without the inverter numbers.
  'GET /api/plants/:id/shares': async ({ id }, _q, _b, { user }) => {
    if (!(await canShare(user, id))) return { canShare: false, shares: [] };
    const people = (await listUsers()).filter((u) => u.shares?.[id])
      .map((u) => ({ email: u.login, name: u.name, perm: u.shares[id].perm, at: u.shares[id].at, status: 'active' }));
    const invited = (await kvGet('share_invites', [])).filter((i) => i.plantId === String(id))
      .map((i) => ({ email: i.email, perm: i.perm, at: i.at, status: 'invited' }));
    return { canShare: true, shares: [...people, ...invited] };
  },
  'POST /api/plants/:id/shares': async ({ id }, _q, body, { user }) => {
    if (!(await canShare(user, id))) throw new ApiError(403, 'Only the owner of this system, their installer or Voltra can share it.');
    const email = String(body?.email || '').trim().toLowerCase();
    const perm = body?.perm === 'control' ? 'control' : 'view';
    if (!isEmail(email)) throw new ApiError(400, 'Please enter a valid e-mail address.');
    if (email === user.login) throw new ApiError(400, 'You cannot share a system with yourself.');
    const plant = await getPlant(id);
    const at = new Date().toISOString();
    const target = await findUser(email);
    if (target) {
      if (target.role === 'admin' || target.plantIds.includes(String(id))) throw new ApiError(409, 'This person already has this system.');
      await updateUser(target.id, { shares: { ...(target.shares ?? {}), [id]: { perm, by: user.login, at } } });
      await messageAdd({ userIds: [target.id], type: 'share', title: 'A system was shared with you', body: `${user.name || user.login} shared ${plant.plantName} (${perm === 'view' ? 'view only' : 'view and control'}).`, link: 'home' });
    } else {
      const list = (await kvGet('share_invites', [])).filter((i) => !(i.email === email && i.plantId === String(id)));
      if (list.length >= 500) throw new ApiError(429, 'Too many open invitations.');
      await kvSet('share_invites', [...list, { email, plantId: String(id), perm, by: user.login, at }]);
    }
    await sendEmail(email, `${user.name || user.login} shared a solar system with you`,
      `${user.name || user.login} shared the system "${plant.plantName}" with you in the Voltra app (${perm === 'view' ? 'view only' : 'view and control'}).\n\n`
      + (target ? `Log in to see it: ${APP_URL}` : `Create your account with this e-mail address (choose End User and leave the inverter numbers empty): ${APP_URL}`),
      `<div style="font-family:Arial,sans-serif;max-width:480px;color:#111827"><p><b>${esc(user.name || user.login)}</b> shared the system <b>${esc(plant.plantName)}</b> with you in the Voltra app (${perm === 'view' ? 'view only' : 'view and control'}).</p>
       <p>${target ? 'Log in to see it.' : 'Create your account with this e-mail address. Choose <b>End User</b> and leave the inverter numbers empty.'}</p>
       <p><a href="${APP_URL}" style="color:#0f9488">Open the Voltra app</a></p></div>`).catch((e) => console.error('share e-mail:', e.message));
    return { ok: true, status: target ? 'active' : 'invited' };
  },
  'POST /api/plants/:id/shares/remove': async ({ id }, _q, body, { user }) => {
    const email = String(body?.email || '').trim().toLowerCase();
    // The owner side removes anyone; the person it was shared with can remove themselves.
    if (email !== user.login && !(await canShare(user, id))) throw new ApiError(403, 'Only the owner can remove people.');
    const target = await findUser(email);
    if (target?.shares?.[id]) { const { [id]: _gone, ...rest } = target.shares; await updateUser(target.id, { shares: rest }); }
    await kvSet('share_invites', (await kvGet('share_invites', [])).filter((i) => !(i.email === email && i.plantId === String(id))));
    return { ok: true };
  },

  // Backup Password (SolaX device "Backup Password"): keep the inverter's local settings password safe in
  // the cloud. Only people who may control the plant can read or change it.
  'GET /api/plants/:id/backup-password': async ({ id }, _q, _b, { user }) => {
    await needControl(user, id);
    return (await plantSettingGet(id, 'backupPassword')) ?? { value: null };
  },
  'POST /api/plants/:id/backup-password': async ({ id }, _q, body, { user }) => {
    await needControl(user, id);
    const value = body?.value == null || body.value === '' ? null : String(body.value).slice(0, 64);
    await plantSettingSet(id, 'backupPassword', value && { value, by: user.login, at: new Date().toISOString() }, user.login);
    return { ok: true };
  },

  // Device Replacement / service request: goes to Voltra (inbox + e-mail) — the swap itself is done on site.
  'POST /api/plants/:id/service-request': async ({ id }, _q, body, { user }) => {
    const kind = { replacement: 'Device replacement', service: 'Service visit' }[body?.kind] || 'Service visit';
    const note = String(body?.note || '').slice(0, 1000);
    const device = String(body?.deviceSn || '').slice(0, 40);
    const plant = await getPlant(id);
    const admins = (await listUsers()).filter((u) => u.role === 'admin').map((u) => u.id);
    const text = `${kind} request for ${plant.plantName}${device ? ` · ${device}` : ''} from ${user.name || user.login} (${user.login}${user.phone ? `, ${user.phone}` : ''}).`;
    await messageAdd({ userIds: admins, type: 'service', title: `${kind} request`, body: `${text}${note ? ` ${note}` : ''}`, link: null });
    await messageAdd({ plantId: id, type: 'service', title: `${kind} requested`, body: 'Voltra has your request and will contact you.', link: null });
    await sendEmail(SUPPORT_EMAIL, `[Voltra app] ${kind} request: ${plant.plantName}`, `${text}\n\n${note}`,
      `<div style="font-family:Arial,sans-serif;color:#111827"><p>${esc(text)}</p>${note ? `<p>${esc(note)}</p>` : ''}</div>`)
      .catch((e) => console.error('service e-mail:', e.message));
    return { ok: true };
  },

  // Delete my account (end users and partners; Voltra admins are removed by another admin).
  'POST /api/me/delete': async (_p, _q, body, { user, res }) => {
    if (user.role === 'admin') throw new ApiError(400, 'Admin accounts are removed by another Voltra admin.');
    if (!(await verifyPassword(user, body?.password))) throw new ApiError(400, 'Password is incorrect.');
    await deleteUser(user.id);
    res.setHeader('Set-Cookie', clearCookie(SECURE_COOKIES));
    return { ok: true };
  },

  'POST /api/auth/change-password': async (_p, _q, body, { user, res }) => {
    if (!(await verifyPassword(user, body?.current))) throw new ApiError(400, 'Current password is incorrect.');
    let updated;
    try { updated = await updateUser(user.id, { password: body?.next }); } catch (e) { throw new ApiError(400, e.message); }
    res.setHeader('Set-Cookie', sessionCookie(updated, true, SECURE_COOKIES)); // other devices are signed out
    return { ok: true };
  },
});

// Tell the superior channel partner (and Voltra admins) that a new partner is waiting for approval.
async function notifySignup(user, parentId) {
  const admins = (await listUsers()).filter((u) => u.role === 'admin' && isActive(u)).map((u) => u.id);
  const label = user.role === 'distributor' ? 'distributor' : 'installer';
  const to = [...new Set([parentId, ...admins].filter(Boolean))];
  await messageAdd({ userIds: to, type: 'partner', title: `New ${label} waiting for approval`, body: `${user.company} (${user.login})`, link: 'partners' }).catch(() => {});
  await notifyUsers(to, {
    title: `New ${label} waiting for approval`,
    body: `${user.company} (${user.login}) signed up. Tap to review.`,
    tag: `signup-${user.id}`, url: '/#partners',
  }).catch((e) => console.error('signup notify:', e.message));
}

// Checks the SN + registration no., and that an end user isn't taking a plant someone else owns.
async function claimablePlant(req, inverterSn, registerNo, role) {
  if (!inverterSn || !registerNo) throw new ApiError(400, 'Please enter the inverter SN and registration number.');
  const throttleKey = `claim:${String(inverterSn).toUpperCase()}`;
  const locked = checkThrottle(clientIp(req), throttleKey);
  if (locked) throw new ApiError(429, locked);
  const device = await findDevice(inverterSn, registerNo);
  recordLogin(clientIp(req), throttleKey, !!device);
  if (!device) throw new ApiError(404, 'No system found with this inverter SN and registration number. Check the labels on the devices.');
  if (role === 'customer' && (await plantOwners(device.plantId)).length) {
    throw new ApiError(409, 'This system is already registered to another owner. Please contact Voltra support.');
  }
  return String(device.plantId);
}

// Look an inverter up across every plant on the account (paged), matching SN + registration no.
async function findDevice(inverterSn, registerNo) {
  const sn = String(inverterSn).trim().toUpperCase(), reg = String(registerNo).trim().toUpperCase();
  for (let page = 1; page <= 50; page++) {
    const r = await solax('GET', '/openapi/v2/device/page_device_info', { query: { deviceType: 1, businessType: BUSINESS_TYPE, pageNo: page } });
    const hit = (r.records ?? []).find((d) => d.deviceSn?.toUpperCase() === sn && d.registerNo?.toUpperCase() === reg);
    if (hit) return hit;
    if (!r.pages || page >= r.pages) return null;
  }
  return null;
}

// SolaX posts the final result of asynchronous commands here (the app's "Callback Address").
Object.assign(routes, {
  'POST /api/solax/callback': async (_p, _q, body) => {
    console.log('solax callback:', JSON.stringify(body).slice(0, 500));
    const requestId = body?.requestId ?? body?.data?.requestId;
    const st = body?.status ?? body?.data?.status ?? (Array.isArray(body?.result) ? body.result[0]?.status : undefined);
    if (requestId) {
      const e = await controlLogByRequestId(String(requestId));
      if (e && st) await controlLogUpdate(e.id, { status: st, statusText: COMMAND_STATUS[st] ?? `Status ${st}`, callbackAt: new Date().toISOString() });
    }
    return { code: 0, message: 'ok' };
  },
});

// ---------- business: portfolio ----------

async function allPages(path, query) {
  const out = [];
  for (let page = 1; page <= 100; page++) {
    const r = await solax('GET', path, { query: { ...query, businessType: BUSINESS_TYPE, pageNo: page } });
    out.push(...(r.records ?? []));
    if (!r.pages || page >= r.pages) break;
  }
  return out;
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

Object.assign(routes, {
  // One row per plant the user can see, with live status — the installer/distributor/admin home.
  'GET /api/portfolio': async (_p, _q, _b, { user }) => buildPortfolio(user),

  // Energy statistics summed over every plant the user can see (Overview chart).
  // ?dateType=2&date=YYYY-MM (days of a month) | ?dateType=1&date=YYYY (months of a year)
  'GET /api/portfolio/stats': async (_p, q, _b, { user }) => {
    const scope = await plantScope(user);
    const plants = (await allPages('/openapi/v2/plant/page_plant_info', {})).filter((pl) => scope === 'all' || scope.has(String(pl.plantId)));
    const dateType = q.get('dateType') === '1' ? '1' : '2';
    const date = q.get('date') || new Date().toISOString().slice(0, dateType === '1' ? 4 : 7);
    const lists = await Promise.all(plants.map((pl) => solax('POST', '/openapi/v2/plant/energy/get_stat_data', {
      json: { plantId: String(pl.plantId), dateType, date, businessType: String(BUSINESS_TYPE) },
    }).then((r) => r.plantEnergyStatDataList ?? []).catch(() => [])));
    const keys = ['pvGeneration', 'loadConsumption', 'importEnergy', 'exportEnergy', 'batteryCharged', 'batteryDischarged', 'inverterACOutputEnergy'];
    const byDate = new Map();
    for (const row of lists.flat()) {
      const acc = byDate.get(row.date) ?? Object.fromEntries([['date', row.date], ...keys.map((k) => [k, 0])]);
      for (const k of keys) acc[k] += Math.abs(Number(row[k]) || 0);
      byDate.set(row.date, acc);
    }
    return { date, dateType, plants: plants.length, plantEnergyStatDataList: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  },
});

async function buildPortfolio(user) {
  {
    const scope = await plantScope(user);
    const plants = (await allPages('/openapi/v2/plant/page_plant_info', {})).filter((pl) => scope === 'all' || scope.has(String(pl.plantId)));
    const devices = (await allPages('/openapi/v2/device/page_device_info', { deviceType: 1 }))
      .filter((d) => plants.some((pl) => String(pl.plantId) === String(d.plantId)));
    const sns = devices.map((d) => d.deviceSn);
    const [inv, bat] = await Promise.all([
      Promise.all(chunk(sns, 10).map((c) => solax('GET', '/openapi/v2/device/realtime_data', { query: { snList: c.join(','), deviceType: 1, businessType: BUSINESS_TYPE } }).catch(() => []))),
      Promise.all(chunk(sns, 10).map((c) => solax('GET', '/openapi/v2/device/realtime_data', { query: { snList: c.join(','), deviceType: 2, requestSnType: 1, businessType: BUSINESS_TYPE } }).catch(() => []))),
    ]);
    const invBySn = new Map(inv.flat().map((r) => [r.deviceSn, r]));
    const batByReg = new Map(bat.flat().map((r) => [r.registerNo, r]));

    const rows = await Promise.all(plants.map(async (pl) => {
      const id = String(pl.plantId);
      const devs = devices.filter((d) => String(d.plantId) === id);
      const [totals, alarms] = await Promise.all([
        solax('GET', '/openapi/v2/plant/realtime_data', { query: { plantId: id, businessType: BUSINESS_TYPE } }).catch(() => null),
        solax('GET', '/openapi/v2/alarm/page_alarm_info', { query: { plantId: id, alarmState: 1, businessType: BUSINESS_TYPE } })
          .then((r) => (r.records ?? []).map(fixAlarmTimes)).catch(() => []),
      ]);
      const live = devs.map((d) => invBySn.get(d.deviceSn)).filter(Boolean);
      const b = devs.map((d) => batByReg.get(d.registerNo)).find(Boolean);
      const online = devs.some((d) => d.onlineStatus === 1);
      return {
        plantId: id, plantName: pl.plantName, address: pl.plantAddress, pvCapacity: pl.pvCapacity, batteryCapacity: pl.batteryCapacity,
        owner: (await plantOwners(id)).map((u) => u.name || u.login)[0] ?? null,
        status: !devs.length ? 'No device' : !online ? 'Offline' : alarms.length ? 'Alarm' : 'Normal',
        devices: devs.length, alarms,
        solarW: live.reduce((a, r) => a + (r.MPPTTotalInputPower ?? 0), 0),
        gridW: live.reduce((a, r) => a + (r.gridPower ?? 0), 0),
        soc: b?.batterySOC ?? null, batteryW: b?.chargeDischargePower ?? null,
        dailyYield: totals?.dailyYield ?? 0, totalYield: totals?.totalYield ?? 0,
        dailyImported: totals?.dailyImported ?? 0, dailyExported: totals?.dailyExported ?? 0,
        lastData: live[0]?.plantLocalTime ?? totals?.plantLocalTime ?? null,
      };
    }));
    const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    return {
      summary: {
        plants: rows.length, normal: rows.filter((r) => r.status === 'Normal').length,
        alarm: rows.filter((r) => r.status === 'Alarm').length, offline: rows.filter((r) => r.status === 'Offline').length,
        capacityKwp: sum('pvCapacity'), solarW: sum('solarW'), dailyYield: sum('dailyYield'), totalYield: sum('totalYield'),
      },
      plants: rows,
    };
  }
}

// Keep the whole portfolio warm so a large first load is instant (refreshes SolaX data behind the scenes).
const WARM_USER = { role: 'admin', status: 'active', plantIds: [] };
setTimeout(() => buildPortfolio(WARM_USER).catch(() => {}), 5_000);
setInterval(() => buildPortfolio(WARM_USER).catch(() => {}), 4 * 60e3);

// ---------- channel partners (SolaX "superior channel partner") ----------

const partnerView = async (u, all) => ({
  ...publicUser(u), plantCount: u.plantIds.length,
  parentCompany: u.parentId ? (all.find((x) => x.id === u.parentId)?.company || '') : 'Voltra',
  downstream: (await descendants(u)).length,
});

Object.assign(routes, {
  // My downstream partners (admins: every business account).
  'GET /api/partners': async (_p, _q, _b, { user }) => {
    if (user.role === 'customer') throw new ApiError(403, 'Business accounts only.');
    const all = await listUsers();
    const list = user.role === 'admin' ? all.filter((u) => u.role === 'installer' || u.role === 'distributor') : await descendants(user);
    return Promise.all(list.map((u) => partnerView(u, all)));
  },

  // "Contact the superior channel partner to add it directly": add an installer/distributor under me.
  'POST /api/partners': async (_p, _q, body, { user }) => {
    if (!['distributor', 'admin'].includes(user.role) || !isActive(user)) throw new ApiError(403, 'Only distributors can add partners.');
    const role = body?.role === 'distributor' ? 'distributor' : 'installer';
    if (!body?.company || !body?.login) throw new ApiError(400, 'Company name and email/mobile are required.');
    const password = tempPassword();
    try {
      const u = await createUser({
        login: body.login, password, name: body.name, company: body.company, phone: body.phone, zip: body.zip,
        role, parentId: user.role === 'admin' ? null : user.id, status: 'active',
      });
      return { user: publicUser(u), tempPassword: password };
    } catch (e) { throw new ApiError(400, e.message); }
  },

  'POST /api/partners/:uid': async ({ uid }, _q, body, { user }) => {
    const target = await getUserById(uid);
    if (!(await canManage(user, target))) throw new ApiError(403, 'This partner is not in your organization.');
    switch (body?.action) {
      case 'approve': await updateUser(uid, { status: 'active' }); return { ok: true };
      case 'suspend': await updateUser(uid, { status: 'suspended' }); return { ok: true };
      case 'reset': { const password = tempPassword(); await updateUser(uid, { password }); return { ok: true, tempPassword: password }; }
      default: throw new ApiError(400, 'Unknown action');
    }
  },
});

// ---------- admin: accounts ----------

const tempPassword = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) { const p = [...randomBytes(12)].map((b) => abc[b % abc.length]).join(''); if (/\d/.test(p) && /[a-z]/i.test(p)) return p; }
};
const needAdmin = (user) => { if (user?.role !== 'admin') throw new ApiError(403, 'Admins only.'); };

Object.assign(routes, {
  'GET /api/admin/users': async (_p, _q, _b, { user }) => {
    needAdmin(user);
    return (await listUsers()).map(publicUser);
  },

  // Body: { action: approve|suspend|reset|role|assign|unassign|delete, role?, plantId? }
  'POST /api/admin/users/:uid': async ({ uid }, _q, body, { user }) => {
    needAdmin(user);
    const target = await getUserById(uid);
    if (!target) throw new ApiError(404, 'Account not found');
    if (target.id === user.id && ['suspend', 'delete', 'role'].includes(body?.action)) throw new ApiError(400, "You can't change your own admin account here.");
    switch (body?.action) {
      case 'approve': await updateUser(uid, { status: 'active' }); return { ok: true };
      case 'suspend': await updateUser(uid, { status: 'suspended' }); return { ok: true };
      case 'reset': { const password = tempPassword(); await updateUser(uid, { password }); return { ok: true, tempPassword: password }; }
      case 'role':
        if (!ROLES.includes(body.role)) throw new ApiError(400, 'Unknown role');
        await updateUser(uid, { role: body.role }); return { ok: true };
      case 'assign': await updateUser(uid, { addPlant: body.plantId }); return { ok: true };
      case 'unassign': await updateUser(uid, { removePlant: body.plantId }); return { ok: true };
      case 'delete': await deleteUser(uid); return { ok: true };
      default: throw new ApiError(400, 'Unknown action');
    }
  },

  'POST /api/admin/users': async (_p, _q, body, { user }) => {
    needAdmin(user);
    const password = tempPassword();
    try {
      const u = await createUser({
        login: body?.login, password, name: body?.name, company: body?.company, phone: body?.phone,
        role: body?.role || 'customer', plantIds: body?.plantId ? [body.plantId] : [],
      });
      return { user: publicUser(u), tempPassword: password };
    } catch (e) { throw new ApiError(400, e.message); }
  },

  'GET /api/admin/stats': async (_p, _q, _b, { user }) => { needAdmin(user); return solaxStats(); },
});

Object.assign(routes, pushRoutes({ ApiError, canAccessPlant }));

const scopeOfUser = async (userId) => { const u = await getUserById(userId); return u ? plantScope(u) : null; };
initPush({ scopeOf: scopeOfUser, wants: async (userId, type) => (await getUserById(userId))?.notify?.[type] !== false });

// Alarms, automation scenes, inbox messages, push and alarm e-mails for every plant (events.js).
startEvents({
  allPlants: () => allPages('/openapi/v2/plant/page_plant_info', {}),
  getAlarms: (id) => routes['GET /api/plants/:id/alarms']({ id }, new URLSearchParams('state=1')),
  getOverview: (id) => routes['GET /api/plants/:id/overview']({ id }),
  plantSettingGet, runControl, controlEnabled: () => ALLOW_CONTROL, notifyPlant, messageAdd, sendEmail, tzOffsetMs,
  appUrl: APP_URL,
  // Users who asked for alarm e-mails and can see this plant.
  emailRecipients: async (plantId) => {
    const out = [];
    for (const u of await listUsers()) if (u.emailAlerts && isEmail(u.login) && (await canAccessPlant(u, plantId))) out.push(u);
    return out;
  },
});

// ---------- automation scenes ----------

const SCENE_CONDITIONS = ['time', 'soc_below', 'soc_above', 'offline'];
const SCENE_ACTIONS = ['notify', 'mode_self_use', 'mode_backup', 'mode_feed_in'];
function validateScenes(list, user) {
  if (!Array.isArray(list)) throw new ApiError(400, 'Scenes must be a list');
  return list.slice(0, 30).map((sc, i) => {
    const n = `Scene ${i + 1}`;
    if (!SCENE_ACTIONS.includes(sc.action)) throw new ApiError(400, `${n}: unknown action`);
    if (sc.action !== 'notify' && sc.enabled && !mayControl(user)) throw new ApiError(403, 'Only the owner, their installer or Voltra can create scenes that change the inverter.');
    const c = sc.condition || {};
    if (!SCENE_CONDITIONS.includes(c.type)) throw new ApiError(400, `${n}: unknown condition`);
    const condition = { type: c.type };
    if (c.type === 'time') condition.time = hhmm(c.time, `${n} time`);
    if (c.type === 'soc_below' || c.type === 'soc_above') condition.value = int(c.value, `${n} battery level`, 5, 100);
    const days = [...new Set((sc.days ?? []).map(Number).filter((d) => d >= 0 && d <= 6))];
    return { id: sc.id ?? Date.now() + i, name: String(sc.name || n).slice(0, 60), enabled: !!sc.enabled, days, condition, action: sc.action };
  });
}

// ---------- TOU ----------

function validateTou(plan, user) {
  if (plan.enabled && !mayControl(user)) throw new ApiError(403, 'Only the owner, their installer or Voltra can switch on automatic TOU.');
  const time = (v, n) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) throw new ApiError(400, `${n} must be HH:MM`); return v; };
  const mode = (m) => { if (!TOU_MODES.includes(m)) throw new ApiError(400, `Unknown TOU mode "${m}"`); return m; };
  const periods = (plan.periods ?? []).slice(0, 10).map((p, i) => {
    const out = { start: time(p.start, `Period ${i + 1} start`), end: time(p.end, `Period ${i + 1} end`), mode: mode(p.mode),
      minSoc: int(p.minSoc ?? 10, `Period ${i + 1} min battery`, 10, 100), powerKw: dec(p.powerKw ?? 2, `Period ${i + 1} power (kW)`, 0.1, 30) };
    if (p.end !== '23:59' && p.end <= p.start) throw new ApiError(400, `Period ${i + 1} must end after it starts`);
    return out;
  });
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) if (sorted[i].start < sorted[i - 1].end && sorted[i - 1].end !== '23:59') throw new ApiError(400, 'TOU periods overlap');
  return { enabled: !!plan.enabled, defaultMode: mode(plan.defaultMode ?? 'Self Use'), minSoc: int(plan.minSoc ?? 10, 'Default min battery', 10, 100),
    defaultPowerKw: dec(plan.defaultPowerKw ?? 2, 'Default power (kW)', 0.1, 30), periods, updatedAt: new Date().toISOString() };
}

startTouScheduler({
  runControl, getPlant, tzOffsetMs, enabled: () => ALLOW_CONTROL,
  getSoc: async (plantId) => (await routes['GET /api/plants/:id/overview']({ id: plantId })).batteries?.[0]?.batterySOC ?? null,
});

// ---------- weather ----------

const weatherCache = new Map();
async function openMeteo(lat, lon) {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&daily=temperature_2m_max,temperature_2m_min&current=temperature_2m,weather_code&timezone=auto&forecast_days=1',
    { signal: AbortSignal.timeout(8000) });
  const w = await r.json();
  if (!r.ok || w.error || w.daily?.temperature_2m_min?.[0] == null) throw new Error(w.reason || `HTTP ${r.status}`);
  return { min: w.daily.temperature_2m_min[0], max: w.daily.temperature_2m_max[0], now: w.current?.temperature_2m, code: w.current?.weather_code, source: 'open-meteo' };
}
async function metNorway(lat, lon) {
  const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${(+lat).toFixed(3)}&lon=${(+lon).toFixed(3)}`,
    { headers: { 'User-Agent': 'VoltraEnergyApp/1.0 https://voltra.in' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const series = (await r.json()).properties?.timeseries ?? [];
  const next24 = series.filter((t) => Date.parse(t.time) < Date.now() + 24 * 3600e3).map((t) => t.data.instant.details.air_temperature);
  if (!next24.length) throw new Error('no data');
  return { min: Math.min(...next24), max: Math.max(...next24), now: next24[0], source: 'met.no' };
}

// ---------- helpers ----------

async function canShare(user, id) {
  if (!isActive(user) || !mayControl(user)) return false;
  return user.role === 'admin' || user.plantIds.includes(String(id)) || (isBusiness(user) && !(await viewOnlyShare(user, id)) && !user.shares?.[id]);
}
async function needControl(user, id) {
  if (!mayControl(user) || (await viewOnlyShare(user, id))) throw new ApiError(403, 'Only people who may change this system can do this.');
}

const plantCache = new Map();
async function getPlant(id) {
  if (!plantCache.has(id)) {
    const r = await solax('GET', '/openapi/v2/plant/page_plant_info', { query: { plantId: id, businessType: BUSINESS_TYPE } });
    const plant = r.records?.[0];
    if (!plant) throw new ApiError(404, `Plant ${id} not found`);
    plantCache.set(id, plant);
  }
  return plantCache.get(id);
}

async function listInverterSns(plantId) {
  const d = await solax('GET', '/openapi/v2/device/page_device_info', { query: { plantId, deviceType: 1, businessType: BUSINESS_TYPE } });
  return (d.records ?? []).map((x) => x.deviceSn);
}

// The alarm API returns times 8 h ahead of the plant's local time (checked 2026-10-15 against the
// SolaX Cloud portal: API 21:04:27 vs portal 13:04:27 for the same alarm). Shift them back.
const ALARM_TIME_SHIFT_MS = -8 * 3600e3;
function shiftTime(t) {
  if (!t) return t;
  const d = new Date(Date.parse(t.replace(' ', 'T') + 'Z') + ALARM_TIME_SHIFT_MS);
  return Number.isNaN(d.getTime()) ? t : d.toISOString().slice(0, 19).replace('T', ' ');
}
const fixAlarmTimes = (a) => ({ ...a, alarmStartTime: shiftTime(a.alarmStartTime), alarmEndTime: shiftTime(a.alarmEndTime) });

// "(UTC+05:30)Chennai,..." → +19800000
function tzOffsetMs(label = '') {
  const m = /UTC([+-])(\d{2}):(\d{2})/.exec(label);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60e3 : 0;
}

function sumKeys(obj, re) {
  const vals = Object.entries(obj || {}).filter(([k, v]) => re.test(k) && typeof v === 'number').map(([, v]) => v);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

function matchRoute(method, pathname) {
  for (const [key, handler] of Object.entries(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const names = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => (names.push(n), '([^/]+)')) + '$');
    const hit = pathname.match(re);
    if (hit) return { handler, pattern, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(hit[i + 1])])) };
  }
  return null;
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 1e5) throw new ApiError(413, 'Body too large'); }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new ApiError(400, 'Invalid JSON'); }
}

// ---------- static files ----------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};

async function serveStatic(pathname, res) {
  const rel = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const data = await readFile(join(PUBLIC_DIR, rel));
    // Hashed build assets never change → cache forever; the page, manifest and service worker must stay fresh.
    const cache = rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

// ---------- server ----------

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = matchRoute(req.method, url.pathname);
  if (!route) return serveStatic(url.pathname, res);
  try {
    const user = await userFromRequest(req);
    const key = `${req.method} ${route.pattern}`;
    if (!PUBLIC_ROUTES.has(key) && !user) throw new ApiError(401, 'Please log in.');
    // Every per-plant route is checked here, so a customer can never read another customer's plant.
    if (route.params.id && !(await canAccessPlant(user, route.params.id))) throw new ApiError(403, 'You do not have access to this plant.');
    const body = req.method === 'POST' ? await readJson(req) : undefined;
    const data = await route.handler(route.params, url.searchParams, body, { req, res, user });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
  } catch (err) {
    console.error(err.message);
    res.writeHead(err.status || 500, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ error: err.message }));
  }
}).listen(PORT, () => {
  console.log(`Voltra x SolaX dashboard → http://localhost:${PORT}  (storage: ${storeKind})`);
  if (!CLIENT_SECRET) console.warn('⚠  SOLAX_CLIENT_SECRET is empty — paste it into .env and restart.');
});

// Last line of defence: log unexpected async errors instead of letting them stop the server.
process.on('unhandledRejection', (e) => console.error('unhandled:', e?.message ?? e));
