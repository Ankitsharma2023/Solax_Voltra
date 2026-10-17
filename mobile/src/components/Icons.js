import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

// The web app's 24px line icons (src/components/Icons.jsx), drawn with react-native-svg.
const I = ({ children, size = 24, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);
const fill = (active, color) => (active ? color : 'none');
const inner = (active, color) => (active ? '#fff' : color);

export const HomeIcon = ({ active, color = '#111827', size }) => (
  <I size={size} color={color}><Path d="M4 10.5 12 4l8 6.5V20H4z" fill={fill(active, color)} /><Path d="M10 16h4" stroke={inner(active, color)} /></I>
);
export const DeviceIcon = ({ active, color = '#111827', size }) => (
  <I size={size} color={color}>
    <Rect x="4" y="4" width="16" height="7" rx="2" fill={fill(active, color)} /><Rect x="4" y="13" width="16" height="7" rx="2" fill={fill(active, color)} />
    <Path d="M8 7.5h2M8 16.5h2" stroke={inner(active, color)} />
  </I>
);
export const IntelIcon = ({ active, color = '#111827', size }) => (
  <I size={size} color={color}><Path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" fill={fill(active, color)} /><Path d="M9 10l3 2 3-2M12 12v3.5" stroke={inner(active, color)} /></I>
);
export const ServiceIcon = ({ active, color = '#111827', size }) => (
  <I size={size} color={color}><Path d="M6 3h12v18l-6-4-6 4z" fill={fill(active, color)} /></I>
);
export const MeIcon = ({ active, color = '#111827', size }) => (
  <I size={size} color={color}><Circle cx="12" cy="12" r="9" fill={fill(active, color)} /><Path d="M8.5 13.5c1.8 2 5.2 2 7 0" stroke={inner(active, color)} /></I>
);

export const AlarmIcon = (p) => (<I {...p}><Path d="M6 18V11a6 6 0 0 1 12 0v7" /><Path d="M4 18h16M10 21h4" /><Path d="m12.8 9-2 3h2.4l-2 3" /></I>);
export const BoltIcon = (p) => (<I {...p}><Path d="M13 3 6 13h5l-1 8 7-10h-5z" /></I>);
export const ChevronIcon = (p) => (<I {...p}><Path d="m9 6 6 6-6 6" /></I>);
export const InfoIcon = (p) => (<I {...p}><Circle cx="12" cy="12" r="9" /><Path d="M12 11v5M12 8h.01" /></I>);
export const InverterIcon = (p) => (
  <I {...p}><Rect x="4" y="5" width="14" height="14" rx="2" /><Path d="M7 10c1-1.5 2-1.5 3 0s2 1.5 3 0M7 15h4" /><Path d="M18 12h3m-1.5-1.5L21 12l-1.5 1.5" /></I>
);
export const HouseBoltIcon = (p) => (<I {...p}><Path d="M4 11 12 4l8 7v9H4z" /><Path d="m12.8 10-2.2 3.5h2.6L11 17" /></I>);
export const PylonIcon = (p) => (<I {...p}><Path d="M12 3 8 21M12 3l4 18M6 7h12M7.5 11h9M5 7l2 4M19 7l-2 4M9 16h6" /></I>);
export const SolarIcon = ({ size = 24, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round">
    <Path d="M4 15 7 6h12l-3 9z" /><Path d="M5.5 10.5h12M10 6l-2 9M15.5 6l-2 9M11 15v4M8 19h6" />
    <Circle cx="19" cy="4" r="1.6" fill={color} stroke="none" />
  </Svg>
);
export const TariffIcon = (p) => (
  <I {...p}><Ellipse cx="11" cy="6" rx="7" ry="3" /><Path d="M4 6v6c0 1.7 3.1 3 7 3M4 12v6c0 1.7 3.1 3 7 3M18 6v4" />
    <Circle cx="18" cy="17" r="4" /><Path d="m18.6 15-1.4 2h1.6l-1.4 2" /></I>
);
export const ChartIcon = ({ color, size }) => (
  <I color={color} size={size}><Path d="M4 20h16" /><Rect x="5" y="13" width="3" height="5" rx="1" /><Rect x="10.5" y="10" width="3" height="8" rx="1" />
    <Rect x="16" y="12" width="3" height="6" rx="1" /><Path d="m5 9 5-4 4 3 6-4" /></I>
);
export const MoreIcon = (p) => (
  <I {...p}><Circle cx="12" cy="12" r="9" /><Circle cx="8" cy="12" r=".6" fill={p.color || '#111827'} />
    <Circle cx="12" cy="12" r=".6" fill={p.color || '#111827'} /><Circle cx="16" cy="12" r=".6" fill={p.color || '#111827'} /></I>
);
export const WifiIcon = (p) => (
  <I {...p}><Path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.5a4 4 0 0 1 6 0" /><Circle cx="12" cy="19.5" r=".8" fill={p.color || '#111827'} /></I>
);
export const TopologyIcon = (p) => (
  <I {...p}><Rect x="9" y="3" width="6" height="5" rx="1" /><Rect x="3" y="16" width="6" height="5" rx="1" />
    <Rect x="15" y="16" width="6" height="5" rx="1" /><Path d="M12 8v4M6 16v-4h12v4" /></I>
);
export const PlusIcon = (p) => (<I {...p}><Circle cx="12" cy="12" r="9" /><Path d="M12 8v8M8 12h8" /></I>);
export const BackIcon = (p) => (<I {...p}><Path d="m15 6-6 6 6 6" /></I>);
export const ScanIcon = (p) => (<I {...p}><Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" /></I>);
export const BatteryIcon = (p) => (<I {...p}><Rect x="3" y="7" width="16" height="10" rx="2" /><Path d="M21 10v4M7 10v4M11 10v4" /></I>);
