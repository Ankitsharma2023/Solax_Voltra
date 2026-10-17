import { router } from 'expo-router';
import { useApi } from '../../lib/api';
import { useSession } from '../../lib/session';
import { List, ListRow, Screen } from '../../components/ui';
import Header from '../../components/home/Header';
import { AlarmIcon, BoltIcon, ChartIcon, InfoIcon, ServiceIcon } from '../../components/Icons';
import { C } from '../../theme';

// Service tab (web src/screens/Service.jsx).
export default function Service() {
  const { plant } = useSession();
  const alarms = useApi(`/api/plants/${plant.plantId}/alarms`);
  const overview = useApi(`/api/plants/${plant.plantId}/overview`);
  const online = overview.data?.devices?.some((d) => d.onlineStatus === 1);
  const status = !overview.data ? null : !online ? 'Offline' : alarms.data?.length ? 'Alarm' : 'Normal';
  const ic = { size: 22, color: C.accentDark };
  const items = [
    { icon: <BoltIcon {...ic} />, title: 'Local Access', sub: 'Change inverter settings on site, without internet', to: '/service-request?kind=local_access' },
    { icon: <AlarmIcon {...ic} />, title: 'Alarms', sub: alarms.data?.length ? `${alarms.data.length} active` : 'No active alarms', to: '/alarms' },
    { icon: <ServiceIcon {...ic} />, title: 'Warranty', sub: 'Devices and warranty status', to: '/warranty' },
    { icon: <ChartIcon {...ic} />, title: 'Reports', sub: 'Plant · Device · Statistical · CSV export', to: '/reports' },
    { icon: <InfoIcon {...ic} />, title: 'Help & Support', sub: 'Contact Voltra', to: '/help' },
  ];
  return (
    <Screen onRefresh={alarms.reload}>
      <Header plant={plant} status={status} />
      <List>
        {items.map((it, i) => (
          <ListRow key={it.title} icon={it.icon} title={it.title} sub={it.sub} onPress={() => router.push(it.to)} last={i === items.length - 1} />
        ))}
      </List>
    </Screen>
  );
}
