// Persistent storage for the app's own data (SolaX data is never stored — it's read live).
//   MONGODB_URI set → MongoDB (collections: users, kv, plant_settings)
//   otherwise       → JSON files in data/ (local testing only; wiped on hosts without a disk)

import { MongoClient } from 'mongodb';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const URI = process.env.MONGODB_URI;
export const storeKind = URI ? 'mongodb' : 'files';
const DATA = join(import.meta.dirname, 'data');

// ---------- MongoDB ----------

let mongo = null;
async function col(name) {
  if (!mongo) {
    mongo = (async () => {
      const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10_000 });
      await client.connect();
      const db = client.db(); // database named in the URI (voltra_app)
      await Promise.all([
        db.collection('users').createIndex({ id: 1 }, { unique: true }),
        db.collection('users').createIndex({ login: 1 }, { unique: true }),
        // Organization Numbers are unique among business accounts (customers have none).
        db.collection('users').createIndex({ orgNo: 1 }, { unique: true, partialFilterExpression: { orgNo: { $type: 'string' } } }),
        db.collection('users').createIndex({ parentId: 1 }),
      ]);
      return { client, db };
    })().catch((e) => { mongo = null; throw e; });
  }
  return (await mongo).db.collection(name);
}
const strip = ({ _id, ...doc }) => doc;

// ---------- users ----------
// Short in-process cache so per-request auth checks don't hit the network each time.
// Writes from this process clear it; `npm run admin` (another process) is picked up within 3 s.
let usersCache = null, usersAt = 0, usersMtime = -1;
const USERS_FILE = join(DATA, 'users.json');

export async function usersAll() {
  if (URI) {
    if (!usersCache || Date.now() - usersAt > 3000) {
      usersCache = (await (await col('users')).find({}).toArray()).map(strip);
      usersAt = Date.now();
    }
    return usersCache;
  }
  const mtime = await stat(USERS_FILE).then((s) => s.mtimeMs).catch(() => 0);
  if (!usersCache || mtime !== usersMtime) {
    try { usersCache = JSON.parse(await readFile(USERS_FILE, 'utf8')).users; } catch { usersCache = []; }
    usersMtime = mtime;
  }
  return usersCache;
}

async function writeUsersFile(users) {
  await mkdir(DATA, { recursive: true });
  await writeFile(USERS_FILE, JSON.stringify({ users }, null, 2), { mode: 0o600 });
  usersCache = users; usersMtime = (await stat(USERS_FILE)).mtimeMs;
}

export async function userInsert(user) {
  if (URI) {
    try { await (await col('users')).insertOne({ ...user }); }
    catch (e) { if (e.code === 11000) throw new Error('An account with this email/phone already exists'); throw e; }
    usersCache = null; return;
  }
  const users = await usersAll();
  if (users.some((u) => u.login === user.login)) throw new Error('An account with this email/phone already exists');
  await writeUsersFile([...users, user]);
}

export async function userSave(user) {
  if (URI) { await (await col('users')).replaceOne({ id: user.id }, { ...user }); usersCache = null; return; }
  await writeUsersFile((await usersAll()).map((u) => (u.id === user.id ? user : u)));
}

// Delete a user; their downstream partners move up to `newParentId`.
export async function userDelete(id, newParentId) {
  if (URI) {
    const users = await col('users');
    await users.updateMany({ parentId: id }, { $set: { parentId: newParentId ?? null } });
    await users.deleteOne({ id });
    usersCache = null; return;
  }
  const next = (await usersAll()).filter((u) => u.id !== id).map((u) => (u.parentId === id ? { ...u, parentId: newParentId ?? null } : u));
  await writeUsersFile(next);
}

// ---------- small key/value documents (push subscriptions & state) ----------

export async function kvGet(key, fallback) {
  if (URI) return (await (await col('kv')).findOne({ _id: key }))?.value ?? fallback;
  try { return JSON.parse(await readFile(join(DATA, `${key}.json`), 'utf8')); } catch { return fallback; }
}
export async function kvSet(key, value) {
  if (URI) { await (await col('kv')).replaceOne({ _id: key }, { _id: key, value, updatedAt: new Date() }, { upsert: true }); return; }
  await mkdir(DATA, { recursive: true });
  await writeFile(join(DATA, `${key}.json`), JSON.stringify(value, null, 2), { mode: 0o600 });
}

// ---------- per-plant settings (tariff, TOU plan, automation scenes, work-mode draft) ----------

const settingsFile = join(DATA, 'plant_settings.json');
async function settingsFileAll() { try { return JSON.parse(await readFile(settingsFile, 'utf8')); } catch { return {}; } }

export async function plantSettingGet(plantId, key) {
  if (URI) return (await (await col('plant_settings')).findOne({ _id: `${plantId}:${key}` }))?.value ?? null;
  return (await settingsFileAll())[`${plantId}:${key}`]?.value ?? null;
}
export async function plantSettingSet(plantId, key, value, by) {
  const doc = { _id: `${plantId}:${key}`, plantId: String(plantId), key, value, updatedBy: by, updatedAt: new Date().toISOString() };
  if (URI) { await (await col('plant_settings')).replaceOne({ _id: doc._id }, doc, { upsert: true }); return; }
  const all = await settingsFileAll();
  all[doc._id] = doc;
  await mkdir(DATA, { recursive: true });
  await writeFile(settingsFile, JSON.stringify(all, null, 2), { mode: 0o600 });
}
export async function plantSettingsByKey(key) {
  if (URI) return (await (await col('plant_settings')).find({ key }).toArray()).map(strip);
  return Object.values(await settingsFileAll()).filter((d) => d.key === key);
}

export async function closeStore() { if (mongo) (await mongo).client.close(); }
