// Customer accounts and sessions.
// - Users live in MongoDB (or data/users.json locally, see store.js); passwords are salted scrypt hashes.
// - Sessions are HMAC-signed cookies (HttpOnly, SameSite=Lax); bumping a user's `sv` (session version)
//   logs out every device for that user (used on password change).
// - Roles (same identities as SolaX sign-up):
//     customer     = "End User"     — owns their plant(s)
//     installer    = "Installer"    — serves owners; sees the plants linked to them
//     distributor  = "Distributor"  — like installer, for dealer/partner businesses
//     admin        = Voltra staff   — sees every plant; created only with `npm run admin`
// - Installer/distributor sign-ups start as status "pending" until their superior approves them.
// - Channel hierarchy (as in SolaX): every business account has an Organization Number (`orgNo`) and a
//   superior (`parentId`, null = directly under Voltra). A superior sees all plants of everyone below it
//   and can approve / add / manage them. Voltra's own number is VOLTRA_ORG_NO (default VLT000001).

import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { usersAll, userInsert, userSave, userDelete } from './store.js';

const scrypt = promisify(scryptCb);
const COOKIE = 'voltra_session';
const LONG_SESSION_S = 30 * 24 * 3600;   // "Remember me"
const SHORT_SESSION_S = 12 * 3600;
const SECRET = process.env.SESSION_SECRET;

// ---------- user store ----------

const load = async () => ({ users: await usersAll() });

// Emails are case-insensitive; phone numbers keep digits only (and a leading +).
export function normalizeLogin(s = '') {
  const t = String(s).trim().toLowerCase();
  if (t.includes('@')) return t;
  const phone = t.replace(/[^\d+]/g, '');
  return /^\+?\d{8,15}$/.test(phone) ? phone : t;
}

export async function findUser(login) {
  const n = normalizeLogin(login);
  return (await load()).users.find((u) => u.login === n) || null;
}
export async function getUserById(id) { return (await load()).users.find((u) => u.id === id) || null; }
export async function listUsers() { return (await load()).users; }

export const ROLES = ['customer', 'installer', 'distributor', 'admin'];
export const ROOT_ORG_NO = (process.env.VOLTRA_ORG_NO || 'VLT000001').toUpperCase();

async function newOrgNo() {
  const taken = new Set((await load()).users.map((u) => u.orgNo).filter(Boolean));
  for (;;) {
    const n = `VLT${String(100000 + (randomBytes(4).readUInt32BE() % 900000))}`;
    if (!taken.has(n) && n !== ROOT_ORG_NO) return n;
  }
}

// Resolve an Organization Number typed at sign-up → { root: true } | business user | null.
export async function findByOrgNo(orgNo) {
  const n = String(orgNo || '').trim().toUpperCase();
  if (!n) return null;
  if (n === ROOT_ORG_NO) return { root: true };
  return (await load()).users.find((u) => u.orgNo === n && u.role !== 'customer') || null;
}

// Everyone below `user` in the channel tree (children, grandchildren…).
export async function descendants(user) {
  const users = (await load()).users;
  const out = [], queue = [user.id];
  while (queue.length) {
    const id = queue.shift();
    for (const u of users) if (u.parentId === id && !out.includes(u)) { out.push(u); queue.push(u.id); }
  }
  return out;
}

// 'all' for admins; otherwise the user's own plants plus every plant of their downstream partners.
export async function plantScope(user) {
  if (!isActive(user)) return new Set();
  if (user.role === 'admin') return 'all';
  const ids = new Set([...user.plantIds, ...Object.keys(user.shares ?? {})]); // own plants + plants shared with them
  if (user.role !== 'customer') for (const d of await descendants(user)) if (isActive(d)) d.plantIds.forEach((p) => ids.add(p));
  return ids;
}

// Admins manage everyone; a distributor/installer manages the partners below it.
export async function canManage(manager, target) {
  if (!isActive(manager) || !target) return false;
  if (manager.role === 'admin') return true;
  if (manager.role === 'customer') return false;
  return (await descendants(manager)).some((u) => u.id === target.id);
}
export const isBusiness = (u) => u?.role === 'installer' || u?.role === 'distributor' || u?.role === 'admin';

export async function createUser({ login, password, name = '', plantIds = [], role = 'customer', company = '', phone = '', zip = '', parentId = null, status = 'active' }) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}"`);
  const n = normalizeLogin(login);
  if (!n) throw new Error('Login is required');
  if ((await usersAll()).some((u) => u.login === n)) throw new Error('An account with this email/phone already exists');
  checkPasswordStrength(password);
  const user = {
    id: randomBytes(8).toString('hex'), login: n, name: String(name).slice(0, 80), role, status,
    company: String(company).slice(0, 120), phone: String(phone).slice(0, 20), zip: String(zip).slice(0, 12),
    parentId, orgNo: role === 'installer' || role === 'distributor' ? await newOrgNo() : null,
    plantIds: plantIds.map(String), passHash: await hash(password), sv: 1, createdAt: new Date().toISOString(),
  };
  await userInsert(user);
  return user;
}

export async function updateUser(id, patch) {
  const found = (await usersAll()).find((x) => x.id === id);
  if (!found) throw new Error('User not found');
  const u = structuredClone(found); // edit a copy; the stored record changes only if the save succeeds
  if (patch.password) { checkPasswordStrength(patch.password); u.passHash = await hash(patch.password); u.sv += 1; }
  if (patch.plantIds) u.plantIds = [...new Set(patch.plantIds.map(String))];
  if (patch.role) {
    if (!ROLES.includes(patch.role)) throw new Error(`Unknown role "${patch.role}"`);
    u.role = patch.role;
    if ((u.role === 'installer' || u.role === 'distributor') && !u.orgNo) u.orgNo = await newOrgNo();
  }
  if (patch.status) u.status = patch.status;
  if (patch.addPlant) u.plantIds = [...new Set([...u.plantIds, String(patch.addPlant)])];
  if (patch.removePlant) u.plantIds = u.plantIds.filter((p) => p !== String(patch.removePlant));
  if (patch.name != null) u.name = String(patch.name).slice(0, 80);
  if (patch.emailAlerts != null) u.emailAlerts = !!patch.emailAlerts;
  if (patch.notify) u.notify = { ...(u.notify ?? {}), ...patch.notify };
  if (patch.shares) u.shares = patch.shares; // { plantId: { perm: 'view'|'control', by, at } }
  await userSave(u);
  return u;
}

export async function deleteUser(id) {
  const gone = (await usersAll()).find((u) => u.id === id);
  // Partners of a deleted distributor move up to its superior (or to Voltra) instead of being orphaned.
  await userDelete(id, gone?.parentId ?? null);
}

export async function plantOwners(plantId) {
  return (await load()).users.filter((u) => u.role === 'customer' && u.plantIds.includes(String(plantId)));
}

export const isActive = (u) => u && (u.status ?? 'active') === 'active';
export async function canAccessPlant(user, plantId) {
  const scope = await plantScope(user);
  return scope === 'all' || scope.has(String(plantId));
}
export const publicUser = (u) => u && {
  id: u.id, login: u.login, name: u.name, role: u.role, status: u.status ?? 'active',
  company: u.company ?? '', phone: u.phone ?? '', zip: u.zip ?? '', plantIds: u.plantIds, createdAt: u.createdAt,
  orgNo: u.role === 'admin' ? ROOT_ORG_NO : u.orgNo ?? null, parentId: u.parentId ?? null,
  emailAlerts: !!u.emailAlerts, notify: { alarm: true, automation: true, ...(u.notify ?? {}) }, shares: u.shares ?? {},
};

// A plant shared "view only" (and not the user's own by any other route) may be looked at but not changed.
export async function viewOnlyShare(user, plantId) {
  const id = String(plantId);
  if (user?.shares?.[id]?.perm !== 'view' || user.role === 'admin' || user.plantIds.includes(id)) return false;
  if (user.role !== 'customer') for (const d of await descendants(user)) if (isActive(d) && d.plantIds.includes(id)) return false;
  return true;
}

// ---------- passwords ----------

export function checkPasswordStrength(p) {
  if (typeof p !== 'string' || p.length < 8) throw new Error('Password must be at least 8 characters');
  if (p !== p.trim()) throw new Error('Password cannot start or end with a space');
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) throw new Error('Password must contain letters and numbers');
}
async function hash(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(user, password) {
  if (!user || typeof password !== 'string') {
    await scrypt('dummy-password', 'dummy-salt-value', 64); // keep timing similar for unknown users
    return false;
  }
  const [, salt, stored] = user.passHash.split('$');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), 64);
  return timingSafeEqual(key, Buffer.from(stored, 'base64'));
}

// ---------- login throttling (per IP + login, in memory) ----------

const attempts = new Map(); // key → { fails, lockedUntil }
export function checkThrottle(ip, login) {
  const a = attempts.get(`${ip}|${normalizeLogin(login)}`);
  if (a?.lockedUntil > Date.now()) {
    const mins = Math.ceil((a.lockedUntil - Date.now()) / 60000);
    return `Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`;
  }
  return null;
}
export function recordLogin(ip, login, ok) {
  const k = `${ip}|${normalizeLogin(login)}`;
  if (ok) return attempts.delete(k);
  const a = attempts.get(k) || { fails: 0, lockedUntil: 0 };
  a.fails += 1;
  if (a.fails >= 5) { a.lockedUntil = Date.now() + 15 * 60e3; a.fails = 0; }
  attempts.set(k, a);
}

// ---------- sessions ----------

const sign = (data) => createHmac('sha256', SECRET).update(data).digest('base64url');

export function sessionCookie(user, remember, secure) {
  if (!SECRET) throw new Error('SESSION_SECRET missing in .env');
  const maxAge = remember ? LONG_SESSION_S : SHORT_SESSION_S;
  const payload = Buffer.from(JSON.stringify({ uid: user.id, sv: user.sv, exp: Date.now() + maxAge * 1000 })).toString('base64url');
  const value = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}${remember ? `; Max-Age=${maxAge}` : ''}`;
}
export const clearCookie = (secure) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}; Max-Age=0`;

export async function userFromRequest(req) {
  if (!SECRET) return null;
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let s; try { s = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  if (!s.exp || s.exp < Date.now()) return null;
  const user = await getUserById(s.uid);
  return user && user.sv === s.sv ? user : null;
}
