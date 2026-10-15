// TOU (Time Of Use) scheduler.
// SolaX's API has no TOU command, so the server acts as the clock: every minute it looks at each plant's
// saved TOU plan (plant setting "tou") and, when a new period starts, sends the matching command.
//
// Every period is a SolaX *remote-control* command with a duration that ends at the period's end, after
// which the inverter returns to its normal work mode by itself. So if this server stops, nothing stays stuck.
//   Self Use         → exit remote control (normal mode)
//   Charging         → charge the battery at the period's power until the period ends
//   Discharging      → discharge at the period's power; stopped early at the period's minimum battery %
//   Battery Standby  → battery idle (solar still runs) until the period ends

import { kvGet, kvSet, plantSettingsByKey } from './store.js';

export const TOU_MODES = ['Self Use', 'Charging', 'Discharging', 'Battery Standby'];
const TICK_MS = 60_000;
const RETRY_MS = 10 * 60_000;
const ACTOR = { login: 'TOU schedule', role: 'system' };

const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const endMin = (hhmm) => (hhmm === '23:59' ? 1440 : toMin(hhmm));

// The segment of the day that `minute` falls in: a planned period, or a gap that runs the default mode.
export function currentSegment(plan, minute) {
  const periods = (plan.periods ?? [])
    .map((p) => ({ ...p, s: toMin(p.start), e: endMin(p.end) }))
    .filter((p) => p.e > p.s)
    .sort((a, b) => a.s - b.s);
  const hit = periods.find((p) => minute >= p.s && minute < p.e);
  if (hit) return { mode: hit.mode, minSoc: hit.minSoc ?? plan.minSoc ?? 10, powerKw: hit.powerKw ?? 2, s: hit.s, e: hit.e };
  const prevEnd = Math.max(0, ...periods.filter((p) => p.e <= minute).map((p) => p.e));
  const nextStart = Math.min(1440, ...periods.filter((p) => p.s > minute).map((p) => p.s));
  return { mode: plan.defaultMode ?? 'Self Use', minSoc: plan.minSoc ?? 10, powerKw: plan.defaultPowerKw ?? 2, s: prevEnd, e: nextStart, gap: true };
}

function commandFor(seg, remainingS) {
  const durationS = Math.max(60, Math.min(86400, remainingS));
  const watts = Math.round((seg.powerKw ?? 2) * 1000);
  switch (seg.mode) {
    case 'Charging': return ['rc_battery_power', { batteryPower: watts, durationS, then: 'exit' }];
    case 'Discharging': return ['rc_battery_power', { batteryPower: -watts, durationS, then: 'exit' }];
    case 'Battery Standby': return ['rc_zero', { durationS, then: 'exit' }];
    default: return ['rc_exit', {}];
  }
}

// deps: { runControl, getPlant, tzOffsetMs, getSoc, enabled() }
export function startTouScheduler(deps) {
  let running = false;
  const tick = async () => {
    if (running || !deps.enabled()) return;
    running = true;
    try {
      const state = await kvGet('tou_state', {});
      const docs = await plantSettingsByKey('tou');
      const active = new Set();
      for (const { plantId, value: plan } of docs) {
        if (!plan?.enabled) continue;
        active.add(plantId);
        const st = (state[plantId] ??= {});
        try {
          const plant = await deps.getPlant(plantId);
          const local = new Date(Date.now() + deps.tzOffsetMs(plant.plantTimeZone));
          const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
          const seg = currentSegment(plan, minute);
          const key = `${local.toISOString().slice(0, 10)}|${seg.s}|${seg.mode}|${seg.powerKw}|${plan.updatedAt ?? ''}`;

          if (st.key !== key && !(st.failedKey === key && Date.now() - st.failedAt < RETRY_MS)) {
            const remainingS = (seg.e - minute) * 60 - local.getUTCSeconds();
            const [op, params] = commandFor(seg, remainingS);
            try {
              await deps.runControl(plantId, op, params, ACTOR);
              Object.assign(st, { key, mode: seg.mode, minSoc: seg.minSoc, guarded: false, failedKey: null, appliedAt: new Date().toISOString() });
            } catch (e) {
              Object.assign(st, { failedKey: key, failedAt: Date.now(), lastError: e.message });
              console.error(`tou ${plantId} ${seg.mode}:`, e.message);
            }
          }

          // Discharge guard: stop early if the battery reaches this period's minimum level.
          if (st.key === key && st.mode === 'Discharging' && !st.guarded && minute % 5 === 0) {
            const soc = await deps.getSoc(plantId).catch(() => null);
            if (soc != null && soc <= st.minSoc) {
              await deps.runControl(plantId, 'rc_exit', {}, ACTOR).catch((e) => console.error('tou guard:', e.message));
              st.guarded = true;
              console.log(`tou ${plantId}: battery ${soc}% ≤ ${st.minSoc}% — discharge stopped early`);
            }
          }
        } catch (e) { console.error(`tou ${plantId}:`, e.message); }
      }
      // A plan was switched off: hand the inverter back to its normal mode once.
      for (const plantId of Object.keys(state)) {
        if (active.has(plantId)) continue;
        if (state[plantId]?.key) await deps.runControl(plantId, 'rc_exit', {}, ACTOR).catch((e) => console.error('tou off:', e.message));
        delete state[plantId];
      }
      await kvSet('tou_state', state);
    } catch (e) { console.error('tou tick:', e.message); }
    finally { running = false; }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, TICK_MS);
  console.log('tou: scheduler running every minute');
}

// Status for the app: what TOU is doing right now on this plant.
export async function touStatus(plantId, plan, plant, tzOffsetMs) {
  const st = (await kvGet('tou_state', {}))[String(plantId)] ?? null;
  if (!plan?.enabled) return { enabled: false };
  const local = new Date(Date.now() + tzOffsetMs(plant.plantTimeZone));
  const seg = currentSegment(plan, local.getUTCHours() * 60 + local.getUTCMinutes());
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return {
    enabled: true, mode: seg.mode, until: seg.e >= 1440 ? '24:00' : hhmm(seg.e), gap: !!seg.gap,
    appliedAt: st?.appliedAt ?? null, stoppedEarly: !!st?.guarded, lastError: st?.failedKey ? st.lastError : null,
  };
}
