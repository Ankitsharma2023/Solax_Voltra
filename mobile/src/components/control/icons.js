import Svg, { Circle, Path } from 'react-native-svg';

// Intelligence card icons (web: ExportIcon, RemoteIcon, HeatIcon, PulseIcon, HistoryIcon in Intelligence.jsx).
const I = ({ children, size = 24, color = '#111827' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);

export const ExportIcon = (p) => (<I {...p}><Path d="M12 3v12m0-12 4 4m-4-4-4 4" /><Path d="M4 14v5h16v-5" /></I>);
export const RemoteIcon = (p) => (<I {...p}><Circle cx="12" cy="12" r="3" /><Path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" /></I>);
export const HeatIcon = (p) => (<I {...p}><Path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z" /><Path d="M12 11v6" /></I>);
export const PulseIcon = (p) => (<I {...p}><Circle cx="12" cy="12" r="9" /><Path d="M6 12h3l2-4 2 8 2-4h3" /></I>);
export const HistoryIcon = (p) => (<I {...p}><Path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><Path d="M3 3v5h5M12 7v5l3 2" /></I>);
export const SparkIcon = (p) => (<I {...p}><Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></I>);
export const LockIcon = (p) => (<I {...p}><Path d="M6 11h12v9H6z" /><Path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></I>);
