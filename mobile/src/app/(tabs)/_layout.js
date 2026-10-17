import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import { useApi } from '../../lib/api';
import { Tabs } from 'expo-router';
import { useSession } from '../../lib/session';
import { Splash } from '../../components/Splash';
import { HomeIcon, DeviceIcon, IntelIcon, ServiceIcon, MeIcon } from '../../components/Icons';
import { C } from '../../theme';

const TABS = [
  ['index', 'Home', HomeIcon],
  ['device', 'Device', DeviceIcon],
  ['intelligence', 'Intelligence', IntelIcon],
  ['service', 'Service', ServiceIcon],
  ['me', 'Me', MeIcon],
];

// The SolaX-style 5-tab plant app.
export default function TabsLayout() {
  const { user, plant, plants, plantsError, reloadPlants, signOut } = useSession();
  if (user.status !== 'active') {
    return <Splash message={user.status === 'suspended' ? 'This account has been suspended. Please contact Voltra.' : 'Voltra is reviewing your account. You can monitor plants once it is approved.'} />;
  }
  if (plantsError) return <Splash error={plantsError.message} onRetry={reloadPlants} />;
  if (!plants) return <Splash />;
  if (!plant) return <WaitingForSystem onLinked={reloadPlants} signOut={signOut} />;

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
        <Tabs.Screen key={name} name={name} options={{
          title,
          tabBarIcon: ({ focused, color }) => <Icon active={focused} color={color} size={26} />,
        }} />
      ))}
    </Tabs>
  );
}

// Signed up with a system Voltra hasn't registered in SolaX yet; the server links it automatically
// (checked every 10 minutes), so look again every minute.
function WaitingForSystem({ onLinked, signOut }) {
  const me = useApi('/api/auth/me', 60 * 1000);
  const claim = me.data?.pendingClaim;
  useEffect(() => { if (me.data && !claim) onLinked(); }, [me.data, claim, onLinked]);
  const logout = <Pressable onPress={signOut} hitSlop={10}><Text style={{ color: C.accentDark, fontWeight: '600' }}>Log out</Text></Pressable>;
  if (!claim) return <Splash message="No system is linked to this account yet. Please contact Voltra support." action={logout} />;
  return (
    <Splash
      message={`Voltra is registering your system\n\nInverter ${claim.inverterSn} · dongle ${claim.registerNo}\n\nThis usually takes up to one working day. You'll get an e-mail when it's connected, and the app opens your system by itself.`}
      action={logout} />
  );
}
