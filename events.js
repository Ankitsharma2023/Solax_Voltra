// Events engine: every 5 minutes, for every plant on the account —
//   • new alarms     → inbox message + push to the plant's phones + e-mail to users who opted in
//   • cleared alarms → inbox message
//   • automation scenes (plant setting "scenes"): "notify" → inbox + push; "switch work mode" → inverter
//     command (once per scene per day) + inbox + push
// State (alarms already seen, scenes already fired today) is kept in kv "events_state".

import { kvGet, kvSet } from './store.js';

const TICK_MS = 5 * 60_000;
const MODE_OPS = { mode_self_use: 'self_use', mode_backup: 'backup', mode_feed_in: 'feed_in' };
const MODE_NAMES = { self_use: 'Self Use', backup: 'Back Up', feed_in: 'Feed-in Priority' };

const alarmId = (a) => `${a.deviceSn}|${a.errorCode}|${a.alarmStartTime}`;

function describeCondition(c, soc) {
  if (c.type === 'offline') return 'the inverter went offline';
  if (c.type === 'time') return `it is ${c.time}`;
  if (c.type === 'soc_below') return `the battery is at ${soc}% (below ${c.value}%)`;
  if (c.type === 'soc_above') return `the battery is at ${soc}% (above ${c.value}%)`;
  return 'its condition was met';
}

// deps: { allPlants, getAlarms, getOverview, plantSettingGet, runControl, controlEnabled, notifyPlant,
//         messageAdd, emailRecipients, sendEmail, appUrl, tzOffsetMs }
export function startEvents(deps) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const state = await kvGet('events_state', {});
      for (const plant of await deps.allPlants()) {
        const id = String(plant.plantId);
        const st = (state[id] ??= { alarms: null, fired: {} });
        try {
          await checkAlarms(deps, plant, st);
          await runScenes(deps, plant, st);
        } catch (e) { console.error(`events ${id}:`, e.message); }
      }
      await kvSet('events_state', state);
    } catch (e) { console.error('events tick:', e.message); }
    finally { running = false; }
  };
  setTimeout(tick, 20_000);
  setInterval(tick, TICK_MS);
  console.log('events: watching alarms and automation every 5 min');
}

export async function checkAlarms(deps, plant, st) {
  const id = String(plant.plantId);
  const alarms = await deps.getAlarms(id);
  const ids = alarms.map(alarmId);
  if (st.alarms) { // first run only records what is already there
    const fresh = alarms.filter((a) => !st.alarms.includes(alarmId(a)));
    const cleared = st.alarms.filter((x) => !ids.includes(x));
    for (const a of fresh) {
      await deps.messageAdd({ plantId: id, type: 'alarm', title: a.alarmName, body: `${plant.plantName} · ${a.deviceSn} · since ${a.alarmStartTime.slice(11, 16)}`, link: 'alarms' });
      await deps.notifyPlant(id, (sub) => (sub.business
        ? { title: `⚠️ ${plant.plantName}: ${a.alarmName}`, body: `${a.deviceSn} · since ${a.alarmStartTime.slice(11, 16)}`, tag: alarmId(a), url: '/#alarms' }
        : { title: `⚠️ ${a.alarmName}`, body: `${a.deviceSn} · since ${a.alarmStartTime.slice(11, 16)}`, tag: alarmId(a), url: '/#messages' }));
    }
    for (const x of cleared) {
      const [sn, code] = x.split('|');
      await deps.messageAdd({ plantId: id, type: 'alarm_cleared', title: `Alarm cleared (code ${code})`, body: `${plant.plantName} · ${sn}`, link: 'alarms' });
    }
    if (fresh.length) {
      const to = await deps.emailRecipients(id);
      if (to.length) {
        const list = fresh.map((a) => `• ${a.alarmName} (code ${a.errorCode}) on ${a.deviceSn}, since ${a.alarmStartTime}`).join('\n');
        const htmlList = fresh.map((a) => `<li><b>${a.alarmName}</b> (code ${a.errorCode}) on ${a.deviceSn}, since ${a.alarmStartTime}</li>`).join('');
        for (const u of to) {
          await deps.sendEmail(u.login, `⚠️ Voltra alarm at ${plant.plantName}`,
            `New alarm${fresh.length > 1 ? 's' : ''} at ${plant.plantName}:\n${list}\n\nOpen the app: ${deps.appUrl}\nTurn these e-mails off in Me → Notifications.`,
            `<div style="font-family:Arial,sans-serif;max-width:480px;color:#111827"><p>New alarm${fresh.length > 1 ? 's' : ''} at <b>${plant.plantName}</b>:</p><ul>${htmlList}</ul>
             <p><a href="${deps.appUrl}" style="color:#0f9488">Open the Voltra app</a></p><p style="font-size:12px;color:#6b7280">Turn these e-mails off in Me → Notifications.</p></div>`);
        }
      }
    }
  }
  st.alarms = ids;
}

export async function runScenes(deps, plant, st) {
  const id = String(plant.plantId);
  const scenes = ((await deps.plantSettingGet(id, 'scenes')) ?? []).filter((s) => s?.enabled);
  if (!scenes.length) return;
  const local = new Date(Date.now() + deps.tzOffsetMs(plant.plantTimeZone));
  const today = local.toISOString().slice(0, 10), hhmm = local.toISOString().slice(11, 16), weekday = local.getUTCDay();
  const ov = await deps.getOverview(id);
  const soc = ov.batteries?.[0]?.batterySOC;
  const online = ov.devices?.some((d) => d.onlineStatus === 1);
  st.fired ??= {};

  for (const sc of scenes) {
    if (!sc.days?.includes(weekday) || st.fired[sc.id] === today) continue;
    const c = sc.condition || {};
    const hit = (c.type === 'soc_below' && soc != null && soc < c.value)
      || (c.type === 'soc_above' && soc != null && soc > c.value)
      || (c.type === 'offline' && !online)
      || (c.type === 'time' && c.time && hhmm >= c.time);
    if (!hit) continue;
    st.fired[sc.id] = today;
    const why = describeCondition(c, soc);

    if (sc.action === 'notify') {
      await deps.messageAdd({ plantId: id, type: 'automation', title: sc.name, body: `${plant.plantName}: ${why}.`, link: 'home' });
      await deps.notifyPlant(id, (sub) => (sub.business ? null : { title: `Voltra: ${sc.name}`, body: `${why[0].toUpperCase()}${why.slice(1)}.`, tag: `scene-${sc.id}`, url: '/#messages' }));
      continue;
    }

    const op = MODE_OPS[sc.action];
    if (!op) continue;
    if (!deps.controlEnabled()) {
      await deps.messageAdd({ plantId: id, type: 'automation', title: `${sc.name}: not run`, body: `Inverter control is switched off, so the switch to ${MODE_NAMES[op]} was skipped.`, link: 'intelligence' });
      continue;
    }
    const settings = { minSoc: 10, chargeUpperSoc: 100, chargeFromGridEnable: 0, ...((await deps.plantSettingGet(id, 'workmode')) ?? {}) };
    try {
      await deps.runControl(id, op, settings, { login: `Automation: ${sc.name}`, role: 'system' });
      await deps.messageAdd({ plantId: id, type: 'automation', title: `${sc.name}: switched to ${MODE_NAMES[op]}`, body: `${plant.plantName}: ${why}.`, link: 'intelligence' });
      await deps.notifyPlant(id, (sub) => (sub.business ? null : { title: `Voltra: ${sc.name}`, body: `Switched to ${MODE_NAMES[op]} because ${why}.`, tag: `scene-${sc.id}`, url: '/#messages' }));
    } catch (e) {
      await deps.messageAdd({ plantId: id, type: 'automation', title: `${sc.name}: failed`, body: `Could not switch to ${MODE_NAMES[op]}: ${e.message}`, link: 'intelligence' });
    }
  }
}
