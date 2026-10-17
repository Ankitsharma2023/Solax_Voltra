// Automation scene vocabulary (web CONDITIONS / ACTIONS in src/screens/Intelligence.jsx).
export const CONDITIONS = [
  { id: 'time', label: 'At a time', fields: ['time'] },
  { id: 'soc_below', label: 'Battery below', fields: ['value'], unit: '%' },
  { id: 'soc_above', label: 'Battery above', fields: ['value'], unit: '%' },
  { id: 'offline', label: 'Inverter goes offline', fields: [] },
];
export const ACTIONS = [
  { id: 'notify', label: 'Send me a notification' },
  { id: 'mode_self_use', label: 'Switch to Self Use' },
  { id: 'mode_backup', label: 'Switch to Back Up' },
  { id: 'mode_feed_in', label: 'Switch to Feed-in Priority' },
];

export function describeScene(sc) {
  const c = CONDITIONS.find((x) => x.id === sc.condition?.type) || CONDITIONS[1];
  const a = ACTIONS.find((x) => x.id === sc.action) || ACTIONS[0];
  return `If ${c.label.toLowerCase()}${c.id === 'time' && sc.condition.time ? ` ${sc.condition.time}` : ''}${sc.condition.value != null && c.unit ? ` ${sc.condition.value}${c.unit}` : ''} → ${a.label.toLowerCase()}`;
}
