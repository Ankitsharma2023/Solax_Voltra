import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';
import { priceAt } from '../../lib/tariff';
import { TariffIcon } from '../Icons';
import { Chips, g } from './EnergyGraph';
import { C } from '../../theme';

// Electricity price through the day (web Home's PriceTrend). No tariff yet → a "Tariff Setting" pill.
const W = 320, H = 170, L = 30, B = 22, T = 8;
const IMPORT = '#eda100', EXPORT = '#eb6834';

export default function PriceTrend({ tariff, onSet }) {
  const [w, setW] = useState(0);
  const hours = Array.from({ length: 97 }, (_, i) => i / 4);
  const max = tariff ? Math.max(1, ...hours.map((h) => Math.max(priceAt(tariff, h), priceAt(tariff, h, 'exportPrice')))) : 1;
  const top = Math.ceil(max * 1.2);
  const x = (h) => L + (h / 24) * (W - L - 6), y = (v) => T + (1 - v / top) * (H - T - B);
  const path = (k) => hours.map((h, i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(priceAt(tariff, h, k)).toFixed(1)}`).join('');
  const ticks = Array.from({ length: 6 }, (_, i) => (top * i) / 5);
  const tick = { fontSize: 9, fill: C.muted };
  return (
    <View>
      <Text style={g.unit}>{tariff ? `${tariff.currency}/kWh` : '-/kWh'}</Text>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Svg width="100%" height={w ? (w * H) / W : H} viewBox={`0 0 ${W} ${H}`} style={{ opacity: tariff ? 1 : 0.5 }}>
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={L} x2={W - 6} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} />
              <SvgText x={L - 5} y={y(t) + 3} textAnchor="end" {...tick}>{+t.toFixed(1)}</SvgText>
            </G>
          ))}
          {[0, 4, 8, 12, 16, 20].map((h) => <SvgText key={h} x={x(h)} y={H - 6} textAnchor="middle" {...tick}>{String(h).padStart(2, '0')}:00</SvgText>)}
          {tariff && (
            <G>
              <Path d={path('importPrice')} fill="none" stroke={IMPORT} strokeWidth={2} />
              <Path d={path('exportPrice')} fill="none" stroke={EXPORT} strokeWidth={2} />
            </G>
          )}
        </Svg>
        {!tariff && (
          <View style={s.center} pointerEvents="box-none">
            <Pressable onPress={onSet} style={s.pill}><TariffIcon size={18} color={C.accentDark} /><Text style={s.pillText}>Tariff Setting</Text></Pressable>
          </View>
        )}
      </View>
      <View style={s.row}>
        <View style={{ flex: 1 }}><Chips items={[{ key: 'i', label: 'Import Price', color: IMPORT }, { key: 'e', label: 'Export Price', color: EXPORT }]} /></View>
        {tariff && <Pressable onPress={onSet} hitSlop={8} style={[g.chip, { marginTop: 10 }]}><Text style={[g.chipText, { color: C.accentDark }]}>Edit</Text></Pressable>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accentSoft, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  pillText: { color: C.accentDark, fontWeight: '600', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
});
