// Simple 24px line icons (stroke = currentColor).
const I = ({ children, size = 24, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);

export const HomeIcon = ({ active, ...p }) => (
  <I {...p}>{active
    ? <path d="M4 10.5 12 4l8 6.5V20H4z" fill="currentColor" />
    : <path d="M4 10.5 12 4l8 6.5V20H4z" />}
    <path d="M10 16h4" stroke={active ? '#fff' : 'currentColor'} /></I>
);
export const DeviceIcon = ({ active, ...p }) => (
  <I {...p}><rect x="4" y="4" width="16" height="7" rx="2" fill={active ? 'currentColor' : 'none'} />
    <rect x="4" y="13" width="16" height="7" rx="2" fill={active ? 'currentColor' : 'none'} />
    <path d="M8 7.5h2M8 16.5h2" stroke={active ? '#fff' : 'currentColor'} /></I>
);
export const IntelIcon = ({ active, ...p }) => (
  <I {...p}><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" fill={active ? 'currentColor' : 'none'} />
    <path d="M9 10l3 2 3-2M12 12v3.5" stroke={active ? '#fff' : 'currentColor'} /></I>
);
export const ServiceIcon = ({ active, ...p }) => (
  <I {...p}><path d="M6 3h12v18l-6-4-6 4z" fill={active ? 'currentColor' : 'none'} /></I>
);
export const MeIcon = ({ active, ...p }) => (
  <I {...p}><circle cx="12" cy="12" r="9" fill={active ? 'currentColor' : 'none'} />
    <path d="M8.5 13.5c1.8 2 5.2 2 7 0" stroke={active ? '#fff' : 'currentColor'} /></I>
);

export const AlarmIcon = (p) => (
  <I {...p}><path d="M6 18V11a6 6 0 0 1 12 0v7" /><path d="M4 18h16M10 21h4" /><path d="m12.8 9-2 3h2.4l-2 3" /></I>
);
export const MoreIcon = (p) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><circle cx="8" cy="12" r=".6" fill="currentColor" />
    <circle cx="12" cy="12" r=".6" fill="currentColor" /><circle cx="16" cy="12" r=".6" fill="currentColor" /></I>
);
export const ChartIcon = (p) => (
  <I {...p}><path d="M4 20h16" /><rect x="5" y="13" width="3" height="5" rx="1" /><rect x="10.5" y="10" width="3" height="8" rx="1" />
    <rect x="16" y="12" width="3" height="6" rx="1" /><path d="m5 9 5-4 4 3 6-4" /></I>
);
export const BoltIcon = (p) => (<I {...p}><path d="M13 3 6 13h5l-1 8 7-10h-5z" /></I>);
export const ChevronIcon = (p) => (<I {...p}><path d="m9 6 6 6-6 6" /></I>);
export const BackIcon = (p) => (<I {...p}><path d="m15 6-6 6 6 6" /></I>);
export const InfoIcon = (p) => (<I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></I>);
export const WifiIcon = (p) => (
  <I {...p}><path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.5a4 4 0 0 1 6 0" /><circle cx="12" cy="19.5" r=".8" fill="currentColor" /></I>
);
export const TopologyIcon = (p) => (
  <I {...p}><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" />
    <rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-4h12v4" /></I>
);
export const PlusIcon = (p) => (<I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></I>);
export const TariffIcon = (p) => (
  <I {...p}><ellipse cx="11" cy="6" rx="7" ry="3" /><path d="M4 6v6c0 1.7 3.1 3 7 3M4 12v6c0 1.7 3.1 3 7 3M18 6v4" />
    <circle cx="18" cy="17" r="4" /><path d="m18.6 15-1.4 2h1.6l-1.4 2" /></I>
);
export const InverterIcon = (p) => (
  <I {...p}><rect x="4" y="5" width="14" height="14" rx="2" /><path d="M7 10c1-1.5 2-1.5 3 0s2 1.5 3 0M7 15h4" /><path d="M18 12h3m-1.5-1.5L21 12l-1.5 1.5" /></I>
);
export const HouseBoltIcon = (p) => (<I {...p}><path d="M4 11 12 4l8 7v9H4z" /><path d="m12.8 10-2.2 3.5h2.6L11 17" /></I>);
export const PylonIcon = (p) => (
  <I {...p}><path d="M12 3 8 21M12 3l4 18M6 7h12M7.5 11h9M5 7l2 4M19 7l-2 4M9 16h6" /></I>
);
