// Voltra staff tool for customer accounts.
//
//   npm run admin -- list
//   npm run admin -- create  --login <email|phone> --plant <plantId> [--name "Full Name"] [--admin]
//   npm run admin -- reset   --login <email|phone>
//   npm run admin -- assign  --login <email|phone> --plant <plantId>[,<plantId>...]
//   npm run admin -- delete  --login <email|phone>
//
// `create` and `reset` generate a temporary password and print it once; the customer should change it
// in the app (Me → Change password).

import { randomBytes } from 'node:crypto';
import { listUsers, findUser, createUser, updateUser, deleteUser } from './auth.js';
import { closeStore } from './store.js';

const [cmd, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith('--')) continue;
  const k = rest[i].slice(2), v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
  args[k] = v;
}

// 12 chars, letters + digits, no look-alikes.
const tempPassword = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  const p = [...bytes].map((b) => abc[b % abc.length]).join('');
  return /\d/.test(p) && /[a-z]/i.test(p) ? p : tempPassword();
};
const need = async () => {
  const u = await findUser(args.login || '');
  if (!u) { console.error(`No account for "${args.login}"`); await closeStore(); process.exit(1); }
  return u;
};

try {
  switch (cmd) {
    case 'list': {
      const users = await listUsers();
      if (!users.length) console.log('No accounts yet.');
      for (const u of users) console.log(`${u.role.padEnd(8)} ${u.login.padEnd(32)} ${u.name.padEnd(20)} plants: ${u.role === 'admin' ? 'ALL' : u.plantIds.join(', ') || '-'}`);
      break;
    }
    case 'create': {
      if (!args.login || (!args.plant && !args.admin)) throw new Error('Usage: create --login <email|phone> --plant <plantId> [--name "..."] [--admin]');
      const password = tempPassword();
      const u = await createUser({
        login: args.login, password, name: typeof args.name === 'string' ? args.name : '',
        role: args.admin ? 'admin' : 'customer', plantIds: args.plant ? String(args.plant).split(',') : [],
      });
      console.log(`Created ${u.role} ${u.login}\nTemporary password: ${password}\n(Share it privately; they should change it in Me → Change password.)`);
      break;
    }
    case 'reset': {
      const u = await need();
      const password = tempPassword();
      await updateUser(u.id, { password });
      console.log(`Password reset for ${u.login} (all their devices are signed out)\nTemporary password: ${password}`);
      break;
    }
    case 'assign': {
      const u = await need();
      if (!args.plant) throw new Error('--plant required');
      await updateUser(u.id, { plantIds: String(args.plant).split(',') });
      console.log(`${u.login} → plants ${args.plant}`);
      break;
    }
    case 'delete': {
      const u = await need();
      await deleteUser(u.id);
      console.log(`Deleted ${u.login}`);
      break;
    }
    default:
      console.log('Commands: list | create | reset | assign | delete   (see the top of admin.js)');
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await closeStore(); // let the process exit (the MongoDB connection would keep it alive)
}
