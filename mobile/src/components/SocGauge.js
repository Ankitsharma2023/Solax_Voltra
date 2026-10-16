import { Platform } from 'react-native';
import Svg, { Circle, G, Text as SvgText, TSpan } from 'react-native-svg';
import { C } from '../theme';

// 270° arc gauge, open at the bottom (like the SolaX app's battery dial).
export default function SocGauge({ value, size = 110 }) {
  const r = 44, c = 2 * Math.PI * r, arc = c * 0.75;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="rotate(135 50 50)">
        <Circle cx="50" cy="50" r={r} fill="none" stroke="#eef1f4" strokeWidth={6} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
        <Circle cx="50" cy="50" r={r} fill="none" stroke={C.accent} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${(arc * pct) / 100} ${c}`} />
      </G>
      <SvgText x="50" y="56" textAnchor="middle" fontSize={18} fontWeight="700" fill={C.ink} fontFamily={Platform.OS === 'web' ? 'system-ui, sans-serif' : undefined}>
        {value == null ? '--' : pct.toFixed(1)}<TSpan fontSize={10} fill={C.muted} dx={1}>%</TSpan>
      </SvgText>
    </Svg>
  );
}
