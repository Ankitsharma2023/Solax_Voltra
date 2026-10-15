import { useApi, modelName } from '../api.js';
import { useNav, Page } from '../nav.jsx';
import Header from '../components/Header.jsx';
import Alarms from './Alarms.jsx';
import Reports from './Reports.jsx';
import { AlarmIcon, ChartIcon, ChevronIcon, InfoIcon, ServiceIcon } from '../components/Icons.jsx';

import { COMPANY, telHref } from '../company.js';
const WARRANTY_URL = COMPANY.warrantyUrl;
const SUPPORT_PHONE = COMPANY.phone;
const SUPPORT_EMAIL = COMPANY.email;

export default function Service({ plant }) {
  const { push } = useNav();
  const alarms = useApi(`/api/plants/${plant.plantId}/alarms`);
  const items = [
    { icon: <AlarmIcon />, title: 'Alarms', sub: alarms.data?.length ? `${alarms.data.length} active` : 'No active alarms', onClick: () => push(Alarms, { plant }) },
    { icon: <ServiceIcon />, title: 'Warranty', sub: 'Devices and warranty status', onClick: () => push(Warranty, { plant }) },
    { icon: <ChartIcon />, title: 'Plant Report', sub: 'Daily / monthly / yearly · CSV export', onClick: () => push(Reports, { plant }) },
    { icon: <InfoIcon />, title: 'Help & Support', sub: 'Contact Voltra', onClick: () => push(Help) },
  ];
  return (
    <>
      <Header plant={plant} />
      <div className="card list">
        {items.map((it) => (
          <button key={it.title} className="list-row" onClick={it.onClick}>
            <span className="list-icon">{it.icon}</span>
            <span className="list-text"><b>{it.title}</b><span className="muted">{it.sub}</span></span>
            <ChevronIcon className="muted" size={20} />
          </button>
        ))}
      </div>
    </>
  );
}

function Warranty({ plant }) {
  const ov = useApi(`/api/plants/${plant.plantId}/overview`);
  return (
    <Page title="Warranty" subtitle={plant.plantName}>
      {!ov.data ? <div className="empty">Loading…</div> : ov.data.devices.map((d) => (
        <div key={d.deviceSn} className="card">
          <b>{modelName(d.deviceModel)}</b>
          <table className="kv"><tbody>
            <tr><td>Serial number</td><td>{d.deviceSn}</td></tr>
            <tr><td>Registration no.</td><td>{d.registerNo}</td></tr>
            <tr><td>Installed at</td><td>{plant.plantAddress || '--'}</td></tr>
            <tr><td>Commissioned</td><td>{plant.createTime?.slice(0, 10)}</td></tr>
          </tbody></table>
        </div>
      ))}
      {WARRANTY_URL
        ? <a className="btn" href={`${WARRANTY_URL}`} target="_blank" rel="noreferrer">Check warranty certificate</a>
        : <p className="graph-note">Warranty certificates come from Voltra's warranty system. Set VITE_WARRANTY_URL to link it here.</p>}
    </Page>
  );
}

function Help() {
  return (
    <Page title="Help & Support">
      <div className="card">
        <h3 className="card-title">Contact Voltra</h3>
        <table className="kv"><tbody>
          <tr><td>Website</td><td><a href="https://voltra.in" target="_blank" rel="noreferrer">voltra.in</a></td></tr>
          {SUPPORT_PHONE && <tr><td>Phone</td><td><a href={telHref(SUPPORT_PHONE)}>{SUPPORT_PHONE}</a></td></tr>}
          {SUPPORT_EMAIL && <tr><td>Email</td><td><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></td></tr>}
          <tr><td>Office</td><td className="addr">{COMPANY.address}</td></tr>
        </tbody></table>
      </div>
      <div className="card">
        <h3 className="card-title">FAQ</h3>
        <details><summary>Why does solar show 0 W?</summary><p className="muted">At night or in heavy cloud the panels produce nothing. Data updates about every 5 minutes.</p></details>
        <details><summary>What does "Battery Standby" mean?</summary><p className="muted">The battery is neither charging nor discharging (less than 5 W).</p></details>
        <details><summary>Why are earnings "- -"?</summary><p className="muted">Set your electricity tariff in Me → Tariff Setting.</p></details>
        <details><summary>What is "Offline"?</summary><p className="muted">The monitoring dongle hasn't reported recently. Check the Wi-Fi at home.</p></details>
      </div>
    </Page>
  );
}
