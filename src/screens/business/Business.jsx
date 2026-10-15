import { useMemo, useState } from 'react';
import BarChart from '../../components/BarChart.jsx';
import { useApi, fmt, power } from '../../api.js';
import { useNav, Page } from '../../nav.jsx';
import CountUp from '../../components/CountUp.jsx';
import { PlantTabs } from '../../PlantTabs.jsx';
import Users from './Users.jsx';
import Partners from './Partners.jsx';
import Reports from '../Reports.jsx';
import Messages, { useUnread } from '../Messages.jsx';
import { useEffect } from 'react';
import AddPlant from '../AddPlant.jsx';
import { ChartIcon, DeviceIcon, AlarmIcon, MeIcon, ChevronIcon, PlusIcon, BoltIcon, InfoIcon } from '../../components/Icons.jsx';
import { TariffSetting } from '../Me.jsx';
import { ChangePassword, About, Notifications } from '../Me.jsx';

const ROLE_LABEL = { installer: 'Installer', distributor: 'Distributor', admin: 'Voltra Admin' };
const TABS = [
  { id: 'overview', label: 'Overview', Icon: ChartIcon },
  { id: 'plants', label: 'Plants', Icon: DeviceIcon },
  { id: 'alarms', label: 'Alarms', Icon: AlarmIcon },
  { id: 'me', label: 'Me', Icon: MeIcon },
];

// Home for installers, distributors and Voltra admins: every plant they look after.
export default function BusinessApp({ user, onLogout }) {
  const { push } = useNav();
  const [tab, setTab] = useState(() => (location.hash === '#alarms' ? 'alarms' : 'overview'));
  const pf = useApi('/api/portfolio', 5 * 60 * 1000);
  // Opened from a "new partner waiting for approval" notification.
  useEffect(() => {
    if (location.hash === '#partners') { history.replaceState(null, '', '/'); push(Partners, { user }); }
    if (location.hash === '#messages') { history.replaceState(null, '', '/'); push(Messages, { openPartners: () => push(Partners, { user }) }); }
  }, [push, user]);
  const plants = useApi('/api/plants');
  const [management, setManagement] = useState(false);
  const Screen = { overview: Overview, plants: Plants, alarms: AllAlarms, me: BusinessMe }[tab];
  const MeWithManagement = useMemo(
    () => (props) => <BusinessMe {...props} user={user} onLogout={onLogout} onManagement={() => setManagement(true)} />,
    [user, onLogout],
  );

  // Like SolaX: an account with a single plant opens straight into that plant's app.
  // Me keeps the business tools, plus "Management · All plants" to reach this portfolio view.
  if (!management && plants.data?.length === 1) {
    return <PlantTabs plant={plants.data[0]} plants={plants.data} user={user} onLogout={onLogout} MeScreen={MeWithManagement} />;
  }
  if (!plants.data && !plants.error) return <div className="app"><div className="splash"><img src="/voltra-logo.png" alt="Voltra" width="163" height="72" className="splash-logo" /><span className="muted">Loading your plants…</span></div></div>;

  return (
    <div className="app">
      <main className="screen">
        <div key={tab} className="tab-view">
          <Screen user={user} pf={pf} onLogout={onLogout} goTab={setTab} onPlantHome={plants.data?.length === 1 ? () => setManagement(false) : null} />
        </div>
      </main>
      <nav className="tabbar four" aria-label="Main">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)} aria-current={tab === id}>
            <Icon size={26} /><span>{label}</span>
            {id === 'alarms' && pf.data?.summary.alarm > 0 && <span className="tab-badge">{pf.data.summary.alarm}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function BizHeader({ user, title }) {
  const { push } = useNav();
  const unread = useUnread();
  return (
    <header className="header">
      <div>
        <h1>{title}</h1>
        <span className="badge normal">{user.company || ROLE_LABEL[user.role]}</span>
      </div>
      <div className="header-actions">
        <button className="icon-btn" aria-label={`Messages (${unread} unread)`} onClick={() => push(Messages, { openPartners: () => push(Partners, { user }) })}>
          <AlarmIcon size={28} />{unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}
        </button>
        <img src="/voltra-mark.svg" alt="" width="30" height="30" />
      </div>
    </header>
  );
}

// ---------- Overview ----------
function Overview({ user, pf, goTab }) {
  const s = pf.data?.summary;
  return (
    <>
      <BizHeader user={user} title="Overview" />
      {pf.error ? <div className="empty err">{pf.error.message}</div> : !s ? <OverviewSkeleton /> : (
        <>
          <div className="card hero-power">
            <span className="muted">Solar power now · all plants</span>
            <div className="hero-num">{power(s.solarW)[0]}<small>{power(s.solarW)[1]}</small></div>
            <div className="hero-sub">
              <span>Today <b><CountUp value={s.dailyYield} /> kWh</b></span>
              <span>Lifetime <b><CountUp value={s.totalYield} digits={1} /> kWh</b></span>
              <span>Capacity <b>{fmt(s.capacityKwp, 1)} kWp</b></span>
            </div>
          </div>
          <div className="status-grid">
            <StatusTile label="Plants" value={s.plants} tone="ink" onClick={() => goTab('plants')} />
            <StatusTile label="Normal" value={s.normal} tone="ok" onClick={() => goTab('plants')} />
            <StatusTile label="Alarm" value={s.alarm} tone="bad" onClick={() => goTab('alarms')} />
            <StatusTile label="Offline" value={s.offline} tone="muted" onClick={() => goTab('plants')} />
          </div>
          {s.plants > 0 && <StatusBar s={s} />}
          {s.plants > 0 && <PortfolioEnergy plants={s.plants} />}
          {s.plants > 0 && <Benefits totalKwh={s.totalYield} />}
          <div className="section-head"><h2>Needs attention</h2></div>
          {pf.data.plants.filter((p) => p.status !== 'Normal').length === 0
            ? <div className="card empty-state"><div className="ok-circle">✓</div><b>All plants are running normally</b></div>
            : pf.data.plants.filter((p) => p.status !== 'Normal').map((p) => <PlantRow key={p.plantId} p={p} />)}
          {s.plants === 0 && <NoPlants user={user} />}
        </>
      )}
    </>
  );
}

// Energy across all plants (SolaX "Energy Analysis"), month = daily bars, year = monthly bars.
const SERIES = [
  { key: 'pvGeneration', label: 'Solar', color: '#eda100' },
  { key: 'loadConsumption', label: 'Consumption', color: '#6250d6' },
  { key: 'exportEnergy', label: 'Exported', color: '#008300' },
  { key: 'importEnergy', label: 'Imported', color: '#2a78d6' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function PortfolioEnergy({ plants }) {
  const [period, setPeriod] = useState('month');
  const [on, setOn] = useState(new Set(['pvGeneration', 'loadConsumption']));
  const now = new Date();
  const date = period === 'month' ? now.toISOString().slice(0, 7) : String(now.getFullYear());
  const res = useApi(`/api/portfolio/stats?dateType=${period === 'month' ? 2 : 1}&date=${date}`);
  const byDate = new Map((res.data?.plantEnergyStatDataList ?? []).map((r) => [r.date, r]));
  const keys = period === 'month'
    ? Array.from({ length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() }, (_, i) => `${date}-${String(i + 1).padStart(2, '0')}`)
    : Array.from({ length: 12 }, (_, i) => `${date}-${String(i + 1).padStart(2, '0')}`);
  const rows = keys.map((k) => ({ ...(byDate.get(k) || {}), label: k, short: period === 'month' ? String(+k.slice(8)) : MONTHS[+k.slice(5, 7) - 1] }));
  const total = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  return (
    <div className="card">
      <div className="chart-head"><h3 className="card-title" style={{ margin: 0 }}>Energy · {plants} plant{plants > 1 ? 's' : ''}</h3>
        <div className="segmented mini">
          <button className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')}>Month</button>
          <button className={period === 'year' ? 'on' : ''} onClick={() => setPeriod('year')}>Year</button>
        </div></div>
      <div className="summary four">
        {SERIES.map((s) => <div key={s.key}><b>{fmt(total(s.key), 1)}</b><span className="muted">{s.label} (kWh)</span></div>)}
      </div>
      <div className="graph-unit">kWh</div>
      {res.error ? <div className="empty err">{res.error.message}</div> : !res.data ? <div className="skeleton" style={{ height: 200 }} />
        : <BarChart rows={rows} series={SERIES.filter((s) => on.has(s.key))} />}
      <div className="chips">
        {SERIES.map((s) => (
          <button key={s.key} className={on.has(s.key) ? 'chip on' : 'chip'} aria-pressed={on.has(s.key)}
            onClick={() => setOn((o) => { const n = new Set(o); n.has(s.key) ? n.delete(s.key) : n.add(s.key); return n; })}>
            <span className="dot" style={{ background: on.has(s.key) ? s.color : '#c9ced4' }} />{s.label}</button>
        ))}
      </div>
    </div>
  );
}

function Benefits({ totalKwh }) {
  const co2 = (totalKwh * 0.997) / 1000;
  return (
    <div className="card">
      <h3 className="card-title">Environmental Benefits · all plants</h3>
      <div className="benefits">
        <div className="benefit peach"><b><CountUp value={co2} /> <small>t</small></b><span>CO<sub>2</sub> Saved</span><span className="benefit-art" aria-hidden="true">☁</span></div>
        <div className="benefit mint"><b><CountUp value={(co2 * 1000) / 18.3} digits={1} /> <small>Trees</small></b><span>Equivalent Planted</span><span className="benefit-art" aria-hidden="true">🌲</span></div>
        <div className="benefit sky"><b><CountUp value={(totalKwh * 0.4) / 1000} /> <small>t</small></b><span>Standard Coal Saved</span><span className="benefit-art" aria-hidden="true">⛰</span></div>
      </div>
    </div>
  );
}

function StatusTile({ label, value, tone, onClick }) {
  return (
    <button className={`card status-tile ${tone}`} onClick={onClick}>
      <b><CountUp value={value} digits={0} /></b><span>{label}</span>
    </button>
  );
}

// Proportion of plants by status — one bar, segments labelled in the tiles above.
function StatusBar({ s }) {
  const parts = [['normal', s.normal, '#1baf7a'], ['alarm', s.alarm, '#dc2626'], ['offline', s.offline, '#b8bfc7']].filter((p) => p[1] > 0);
  return (
    <div className="status-bar" role="img" aria-label={`${s.normal} normal, ${s.alarm} alarm, ${s.offline} offline`}>
      {parts.map(([k, v, c]) => <span key={k} style={{ flexGrow: v, background: c }} />)}
    </div>
  );
}

// ---------- Plants ----------
function Plants({ user, pf }) {
  const { push } = useNav();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const list = useMemo(() => (pf.data?.plants ?? [])
    .filter((p) => filter === 'All' || p.status === filter)
    .filter((p) => !q || `${p.plantName} ${p.address} ${p.owner}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank(a.status) - rank(b.status) || a.plantName.localeCompare(b.plantName)), [pf.data, q, filter]);
  return (
    <>
      <header className="header">
        <div><h1>Plants</h1><span className="muted">{pf.data ? `${pf.data.plants.length} total` : 'Loading…'}</span></div>
        {user.role !== 'admin' && <button className="icon-btn" aria-label="Add plant" onClick={() => push(AddPlant, { onDone: pf.reload })}><PlusIcon size={28} /></button>}
      </header>
      <input className="search" type="search" placeholder="Search name, address or owner" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips filter-chips">
        {['All', 'Normal', 'Alarm', 'Offline'].map((f) => (
          <button key={f} className={filter === f ? 'chip on' : 'chip'} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      {pf.error ? <div className="empty err">{pf.error.message}</div>
        : !pf.data ? [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 18, marginBottom: 12 }} />)
        : !pf.data.plants.length ? <NoPlants user={user} />
        : !list.length ? <div className="empty">No plants match.</div>
        : list.map((p, i) => <PlantRow key={p.plantId} p={p} delay={i * 40} />)}
    </>
  );
}
const rank = (s) => ({ Alarm: 0, Offline: 1, 'No device': 2, Normal: 3 }[s] ?? 4);

function PlantRow({ p, delay = 0 }) {
  const { push } = useNav();
  const [n, u] = power(p.solarW);
  return (
    <button className="card plant-row pop-in" style={{ animationDelay: `${delay}ms` }} onClick={() => push(PlantView, { plantId: p.plantId, name: p.plantName })}>
      <div className="plant-row-top">
        <b>{p.plantName}</b>
        <span className={`badge ${p.status.toLowerCase().replace(' ', '-')}`}>{p.status}{p.alarms.length > 1 ? ` · ${p.alarms.length}` : ''}</span>
      </div>
      <span className="muted plant-row-sub">{[p.address, p.owner && `Owner: ${p.owner}`].filter(Boolean).join(' · ') || '—'}</span>
      <div className="plant-row-stats">
        <span><BoltIcon size={14} /> {n} {u}</span>
        <span>Today {fmt(p.dailyYield)} kWh</span>
        {p.soc != null && <span>🔋 {Math.round(p.soc)}%</span>}
        <span>{fmt(p.pvCapacity, 1)} kWp</span>
      </div>
      {p.status === 'Alarm' && <span className="plant-row-alarm">⚠ {p.alarms[0]?.alarmName}</span>}
      <ChevronIcon className="muted plant-row-chev" size={18} />
    </button>
  );
}

// The full end-user app for one plant, opened from the list.
function PlantView({ plantId, name }) {
  const { pop } = useNav();
  const plants = useApi('/api/plants');
  const plant = plants.data?.find((p) => String(p.plantId) === String(plantId));
  return (
    <div className="plant-view">
      <button className="plant-back" onClick={pop}>‹ All plants</button>
      {plant ? <PlantTabs plant={plant} plants={[plant]} embedded />
        : <div className="empty">{plants.error ? plants.error.message : `Opening ${name}…`}</div>}
    </div>
  );
}

// ---------- Alarms across plants ----------
function AllAlarms({ user, pf }) {
  const { push } = useNav();
  const rows = (pf.data?.plants ?? []).flatMap((p) => p.alarms.map((a) => ({ ...a, plantId: p.plantId, plantName: p.plantName })))
    .sort((a, b) => String(b.alarmStartTime).localeCompare(String(a.alarmStartTime)));
  return (
    <>
      <BizHeader user={user} title="Alarms" />
      {!pf.data ? <div className="empty">Loading…</div> : !rows.length ? (
        <div className="card empty-state"><div className="ok-circle">✓</div><b>No active alarms</b><span className="muted">Across all {pf.data.plants.length} plants.</span></div>
      ) : rows.map((a, i) => (
        <button key={i} className="card alarm-card plant-alarm" onClick={() => push(PlantView, { plantId: a.plantId, name: a.plantName })}>
          <div className="alarm-top"><span className={`level l${a.alarmLevel}`}>{a.alarmLevel === 3 ? 'Fault' : 'Warning'}</span><span className="muted">{a.alarmStartTime}</span></div>
          <b>{a.alarmName}</b>
          <span className="muted">{a.plantName} · {a.deviceSn}</span>
        </button>
      ))}
      <p className="note">Shows current alarms. Open a plant to see its alarm history.</p>
    </>
  );
}

// ---------- Me ----------
function BusinessMe({ user, onLogout, onManagement, onPlantHome, plant }) {
  const { push } = useNav();
  const rows = [
    onManagement && { icon: <ChartIcon />, title: 'Management · All plants', sub: 'Overview, plant list and alarms for every plant', action: onManagement },
    onPlantHome && { icon: <DeviceIcon />, title: 'Back to plant view', sub: 'Open the plant home screen', action: onPlantHome },
    user.role === 'admin' && { icon: <MeIcon />, title: 'Users & approvals', sub: 'Every account: approve, reset passwords, link plants', page: Users },
    user.role !== 'admin' && { icon: <DeviceIcon />, title: 'Partners', sub: user.role === 'distributor' ? 'Installers & distributors in your organization' : 'Partners under your organization', page: Partners },
    user.role === 'admin' && { icon: <DeviceIcon />, title: 'Partners', sub: 'All installers & distributors', page: Partners },
    { icon: <ChartIcon />, title: 'Statistical Report', sub: 'Energy per plant for a month or year · CSV', page: Reports, props: { initial: 'statistical' } },
    { icon: <AlarmIcon />, title: 'Notifications', sub: 'Alarms on your plants · new partner sign-ups', page: Notifications },
    user.role !== 'admin' && { icon: <PlusIcon />, title: 'Add plant', sub: 'Link a system with its inverter SN + registration no.', page: AddPlant },
    plant && { icon: <BoltIcon />, title: 'Tariff Setting', sub: `Electricity prices for ${plant.plantName}`, page: TariffSetting },
    { icon: <MeIcon />, title: 'Change password', sub: user.login, page: ChangePassword },
    { icon: <InfoIcon />, title: 'About', sub: 'Version 0.5', page: About },
  ].filter(Boolean);
  return (
    <>
      <div className="me-head">
        <span className="avatar"><MeIcon size={34} /></span>
        <div><h1>{user.company || user.name || user.login}</h1>
          <span className="muted">{ROLE_LABEL[user.role]}{user.company && user.name ? ` · ${user.name}` : ''}</span></div>
        <img src="/voltra-mark.svg" alt="" width="28" height="28" />
      </div>
      {user.orgNo && <OrgNumber orgNo={user.orgNo} root={user.role === 'admin'} />}
      <div className="card list">
        {rows.map((r) => (
          <button key={r.title} className="list-row" onClick={() => (r.action ? r.action() : push(r.page, { user, plant, ...r.props }))}>
            <span className="list-icon">{r.icon}</span>
            <span className="list-text"><b>{r.title}</b><span className="muted">{r.sub}</span></span>
            <ChevronIcon className="muted" size={20} />
          </button>
        ))}
      </div>
      <button className="btn ghost logout" onClick={() => { if (confirm('Log out of Voltra?')) onLogout(); }}>Log out</button>
    </>
  );
}

// The number partners type at sign-up to register under this organization.
function OrgNumber({ orgNo, root }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card org-card">
      <div>
        <span className="muted">{root ? 'Voltra Organization Number' : 'Your Organization Number'}</span>
        <b>{orgNo}</b>
        <span className="muted small-text">{root ? 'Distributors working directly with Voltra enter this at sign-up.' : 'Partners enter this at sign-up to join your organization.'}</span>
      </div>
      <button className="text-btn" onClick={() => { navigator.clipboard?.writeText(orgNo); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied ✓' : 'Copy'}</button>
    </div>
  );
}

function NoPlants({ user }) {
  const { push } = useNav();
  return (
    <div className="card empty-state">
      <b>No plants yet</b>
      <span className="muted">{user.role === 'admin' ? 'No plants on the Voltra SolaX account.' : 'Add the systems you install with their inverter SN and registration number.'}</span>
      {user.role !== 'admin' && <button className="btn" onClick={() => push(AddPlant, {})}>Add plant</button>}
    </div>
  );
}

function OverviewSkeleton() {
  return <>
    <div className="skeleton" style={{ height: 150, borderRadius: 18, marginBottom: 12 }} />
    <div className="status-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 16 }} />)}</div>
  </>;
}

// Pending installer/distributor accounts.
export function PendingApproval({ user, onLogout }) {
  return (
    <div className="auth">
      <div className="auth-top"><img src="/voltra-logo.png" alt="Voltra" width="118" height="52" /></div>
      <div className="auth-card pending">
        <div className="pending-icon">⏳</div>
        <h1 className="auth-hello">{user.status === 'suspended' ? 'Account suspended' : 'Waiting for approval'}</h1>
        <p className="auth-welcome">
          {user.status === 'suspended'
            ? 'This account has been suspended. Please contact Voltra.'
            : <>Thanks, <b>{user.company}</b>. Voltra is reviewing your {ROLE_LABEL[user.role]?.toLowerCase()} account. You'll be able to add and monitor plants once it's approved.</>}
        </p>
        <button className="btn ghost" onClick={() => location.reload()}>Check again</button>
        <button className="btn ghost logout" onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}
