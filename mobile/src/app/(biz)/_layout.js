import { Tabs } from 'expo-router';
import { ChartIcon, DeviceIcon, AlarmIcon, MeIcon } from '../../components/Icons';
import { C } from '../../theme';

const TABS = [
  ['overview', 'Overview', ChartIcon],
  ['plants', 'Plants', DeviceIcon],
  ['all-alarms', 'Alarms', AlarmIcon],
  ['account', 'Me', MeIcon],
];

// Portfolio app for installers, distributors and Voltra admins (web: screens/business/Business.jsx).
export default function BizLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: C.ink,
      tabBarInactiveTintColor: C.muted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      tabBarStyle: { borderTopColor: C.line, backgroundColor: '#fff' },
      sceneStyle: { backgroundColor: C.bg },
    }}>
      {TABS.map(([name, title, Icon]) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ focused, color }) => <Icon active={focused} color={color} size={26} /> }} />
      ))}
    </Tabs>
  );
}
