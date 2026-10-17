import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Card, KV, s as ui } from '../ui';
import { fmt } from '../../lib/format';
import { SECTIONS } from '../../lib/devices';
import { C } from '../../theme';

// Phone versions of the pieces in the web app's Device.jsx (DeviceArt, Live, DataSections, function icons).

export function DeviceArt({ kind, size = 1 }) {
  if (kind === 'dongle') return (
    <Svg width={44 * size} height={56 * size} viewBox="0 0 44 56">
      <Rect x="15" y="2" width="14" height="6" rx="2" fill="#7b838c" /><Rect x="12" y="6" width="20" height="46" rx="5" fill="#4b525a" />
      <Rect x="17" y="22" width="10" height="10" rx="1.5" fill="#9aa2aa" />
    </Svg>
  );
  if (kind === 'battery') return (
    <Svg width={44 * size} height={56 * size} viewBox="0 0 44 56">
      <Rect x="8" y="4" width="28" height="48" rx="4" fill="#d9f5ef" stroke="#9fdccf" />
      {[14, 22, 30, 38].map((y) => <Line key={y} x1="10" x2="34" y1={y} y2={y} stroke="#8ed3c4" />)}
    </Svg>
  );
  return (
    <Svg width={64 * size} height={56 * size} viewBox="0 0 64 56">
      <Rect x="4" y="8" width="56" height="36" rx="4" fill="#f4f6f8" stroke="#d8dee4" />
      <Rect x="27" y="18" width="10" height="10" rx="1.5" fill="none" stroke="#8a939c" /><Path d="M29 26l6-6" stroke="#8a939c" />
      {[14, 20, 26].map((x) => <Rect key={x} x={x} y="44" width="3" height="5" fill="#8a939c" />)}
    </Svg>
  );
}

// A number that flashes teal briefly when a new reading changes it.
export function Live({ value, style }) {
  const [prev, setPrev] = useState(value);
  const [flash, setFlash] = useState(false);
  if (value !== prev) { setPrev(value); setFlash(true); }
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(false), 900); return () => clearTimeout(t); }, [flash]);
  return <Text style={[style, flash && { color: C.accent }]}>{value}</Text>;
}

// Small table (web table.report.compact).
export function Table({ head, rows }) {
  return (
    <View style={st.table}>
      <View style={[st.tr, st.thead]}>{head.map((h, i) => <Text key={h} style={[st.th, i === 0 && st.first]} numberOfLines={2}>{h}</Text>)}</View>
      {rows.map((r) => (
        <View key={r[0]} style={st.tr}>{r.map((c, i) => <Text key={i} style={[st.td, i === 0 && st.first]}>{c}</Text>)}</View>
      ))}
    </View>
  );
}

// Every data point of one device, grouped like SolaX (PV / AC / Grid / EPS / Energy / Device).
export function DataSections({ card, plant }) {
  return SECTIONS[card.kind](card.live || {}, card.device || {}, card, plant).map((sec) => (
    <Card key={sec.title} title={sec.title}>
      {sec.tiles && (
        <View style={ui.tiles}>
          {sec.tiles.map(([label, v, unit, d]) => (
            <View key={label} style={ui.tile}>
              <Text style={ui.muted} numberOfLines={1}>{label}</Text>
              <Text style={ui.tileVal}><Live value={fmt(v, d)} />{unit ? <Text style={ui.small}> {unit}</Text> : null}</Text>
            </View>
          ))}
        </View>
      )}
      {sec.table && sec.table.rows.length > 0 && <Table {...sec.table} />}
      {sec.table2 && sec.table2.rows.length > 0 && <Table {...sec.table2} />}
      {sec.info && <View style={{ marginTop: 8 }}><KV rows={sec.info.map(([k, v]) => [k, v ?? '--'])} /></View>}
      {sec.note && <Text style={[ui.small, { marginTop: 8 }]}>{sec.note}</Text>}
    </Card>
  ));
}

// Function Control icons (web Device.jsx Fn*).
const F = (children) => function FnIcon({ size = 26, color = '#4b525a' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>;
};
export const FnRemote = F(<><Rect x="3" y="4" width="15" height="11" rx="1.5" /><Path d="M7 19h7" /><Circle cx="17" cy="16" r="3.2" /><Path d="M17 14.8v1.2l.8.8" /></>);
export const FnMode = F(<><Rect x="4" y="4" width="11" height="11" rx="2" /><Rect x="9" y="9" width="11" height="11" rx="2" /></>);
export const FnSwap = F(<><Rect x="3" y="3" width="7" height="7" rx="1.5" /><Rect x="14" y="14" width="7" height="7" rx="1.5" /><Path d="M14 6h4v4M10 18H6v-4" /></>);
export const FnWifi = F(<><Path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" /><Circle cx="12" cy="19" r="1" /></>);
export const FnPhone = F(<><Rect x="7" y="2" width="10" height="20" rx="2" /><Path d="M11 18h2" /></>);
export const FnHeat = F(<><Path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z" /><Path d="M12 11v6" /></>);
export const FnLock = F(<><Path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" /><Circle cx="12" cy="11" r="2" /><Path d="M12 13v3" /></>);
export const PencilIcon = ({ size = 15, color = C.muted }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 20h4L19 9l-4-4L4 16z" /></Svg>
);

const st = StyleSheet.create({
  table: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 8, paddingHorizontal: 8 },
  thead: { borderTopWidth: 0, backgroundColor: C.soft },
  th: { flex: 1, fontSize: 11, color: C.muted, textAlign: 'right' },
  td: { flex: 1, fontSize: 13, color: C.ink, textAlign: 'right', fontVariant: ['tabular-nums'] },
  first: { textAlign: 'left', fontWeight: '600' },
});
