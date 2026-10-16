import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { power } from '../lib/format';
import { ChevronIcon, HouseBoltIcon, PylonIcon, SolarIcon } from './Icons';
import { C } from '../theme';

// Energy flow diagram, like the SolaX app (and the web app's diagram page): Solar on top, Battery left,
// Grid right, Home below, meeting at a junction. Dots travel along every line that carries power.
// Sign conventions (SolaX): battery + = charging, grid + = exporting.
const VW = 360, VH = 300, J = [180, 150];
const on = (w) => Math.abs(w) >= 5;

export default function EnergyFlow({ solar = 0, home = 0, battery = 0, grid = 0, soc, hasBattery, onOpen }) {
  const [w, setW] = useState(0);
  const k = w / VW;
  // [from, to] in diagram units; direction follows the power.
  const lines = [
    { key: 'solar', from: [180, 96], to: J, active: on(solar) },
    hasBattery && { key: 'battery', from: battery > 0 ? J : [104, 150], to: battery > 0 ? [104, 150] : J, active: on(battery) },
    { key: 'grid', from: grid > 0 ? J : [256, 150], to: grid > 0 ? [256, 150] : J, active: on(grid) },
    { key: 'home', from: J, to: [180, 204], active: on(home) },
  ].filter(Boolean);

  return (
    <View style={{ width: '100%', aspectRatio: VW / VH }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <>
          <Svg width={w} height={w * (VH / VW)} viewBox={`0 0 ${VW} ${VH}`} style={StyleSheet.absoluteFill}>
            {lines.map((l) => (
              <Line key={l.key} x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]} stroke={l.active ? C.accent : C.flowOff} strokeWidth={2} />
            ))}
            <Circle cx={J[0]} cy={J[1]} r={4} fill="#fff" stroke="#9fb0bf" strokeWidth={1.5} />
          </Svg>
          {lines.filter((l) => l.active).map((l) => <Dots key={`${l.key}${l.from}`} from={l.from} to={l.to} k={k} />)}
          <Node k={k} x={180} y={54} label="Solar" value={solar} active={on(solar)}
            icon={<SolarIcon size={24} color={on(solar) ? C.accentDark : C.muted} />} onPress={() => onOpen?.('solar')} />
          {hasBattery && (
            <Node k={k} x={60} y={150} label="Battery" value={battery} active={on(battery)} onPress={() => onOpen?.('battery')}
              icon={<SocBadge soc={soc} />} note={on(battery) ? (battery > 0 ? 'Charging' : 'Discharging') : 'Standby'} />
          )}
          <Node k={k} x={300} y={150} label="Grid" value={grid} active={on(grid)} onPress={() => onOpen?.('grid')}
            icon={<PylonIcon size={24} color={on(grid) ? C.accentDark : C.muted} />} note={on(grid) ? (grid > 0 ? 'Exporting' : 'Importing') : 'Idle'} />
          <Node k={k} x={180} y={246} label="Home" value={home} active={on(home)} onPress={() => onOpen?.('home')}
            icon={<HouseBoltIcon size={24} color={on(home) ? C.accentDark : C.muted} />} />
        </>
      )}
    </View>
  );
}

// Three dots looping along one straight line, a third of the way apart (2.4 s per trip, as on the web).
function Dots({ from, to, k }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const R = 3;
  return [0, 1 / 3, 2 / 3].map((phase) => {
    const p = Animated.modulo(Animated.add(t, phase), 1);
    return (
      <Animated.View key={phase} pointerEvents="none" style={{
        position: 'absolute', left: 0, top: 0, width: R * 2, height: R * 2, borderRadius: R, backgroundColor: C.accent,
        transform: [
          { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [from[0] * k - R, to[0] * k - R] }) },
          { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [from[1] * k - R, to[1] * k - R] }) },
        ],
      }} />
    );
  });
}

function Node({ k, x, y, label, value, icon, active, note, onPress }) {
  const [n, u] = power(value);
  const size = Math.max(82, VW * 0.25 * k);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${n} ${u}${note ? `, ${note}` : ''}`}
      style={({ pressed }) => [s.node, active && s.nodeOn, { width: size, height: size, left: x * k - size / 2, top: y * k - size / 2 }, pressed && { opacity: 0.7 }]}>
      <View style={s.icon}>{icon}</View>
      <Text style={s.val}>{n}<Text style={s.unit}> {u}</Text></Text>
      <View style={s.labelRow}><Text style={s.label}>{label}</Text><ChevronIcon size={11} color={C.muted} /></View>
    </Pressable>
  );
}

function SocBadge({ soc }) {
  return (
    <View style={s.soc}>
      <Text style={s.socText}>{soc != null ? Number(soc).toFixed(1) : '--'}</Text>
      <View style={s.socTip} />
    </View>
  );
}

const s = StyleSheet.create({
  node: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#fff',
    borderWidth: 1, borderColor: C.line, borderRadius: 18,
    shadowColor: '#111827', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  nodeOn: { borderColor: '#cdeee7' },
  icon: { height: 26, justifyContent: 'center' },
  val: { fontSize: 22, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 11, fontWeight: '500', color: C.muted },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  label: { fontSize: 12, color: C.muted },
  soc: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#3f8f84', borderRadius: 4, paddingHorizontal: 5, backgroundColor: C.accentSoft },
  socText: { fontSize: 11, fontWeight: '700', color: '#0f6e66', lineHeight: 16 },
  socTip: { position: 'absolute', right: -4, top: 5, width: 2, height: 6, borderTopRightRadius: 1, borderBottomRightRadius: 1, backgroundColor: '#3f8f84' },
});
