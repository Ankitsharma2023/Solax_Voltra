// One-off: copy the local data/ files (accounts, push state, plant settings) into MongoDB.
// Safe to re-run: existing records are kept, only missing ones are added.
//   npm run migrate

import { MongoClient } from 'mongodb';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DATA = join(import.meta.dirname, 'data');
const read = async (f) => { try { return JSON.parse(await readFile(join(DATA, f), 'utf8')); } catch { return null; } };

if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set in .env'); process.exit(1); }
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db();

const users = (await read('users.json'))?.users ?? [];
let added = 0;
for (const u of users) {
  const r = await db.collection('users').updateOne({ id: u.id }, { $setOnInsert: u }, { upsert: true });
  added += r.upsertedCount;
}
console.log(`users: ${added} added, ${users.length - added} already there`);

const push = await read('push.json');
if (push && !(await db.collection('kv').findOne({ _id: 'push' }))) {
  await db.collection('kv').insertOne({ _id: 'push', value: push, updatedAt: new Date() });
  console.log(`push: ${push.subs?.length ?? 0} subscriptions copied`);
} else console.log('push: nothing to copy');

const settings = await read('plant_settings.json');
let s = 0;
for (const doc of Object.values(settings ?? {})) {
  const r = await db.collection('plant_settings').updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
  s += r.upsertedCount;
}
console.log(`plant settings: ${s} copied`);
await client.close();
