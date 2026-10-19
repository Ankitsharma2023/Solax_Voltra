import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { Screen, List, ListRow, Button, Card } from '../../components/ui';
import { BoltIcon, ChartIcon, DeviceIcon, InfoIcon, MeIcon, PlusIcon, TariffIcon } from '../../components/Icons';
import { ChatIcon, CountBadge, GearIcon, MailIcon, SendIcon, ShareIcon, UsersIcon, useUnread } from '../../components/me/common';
import { useOpenPlant } from '../../components/biz/portfolio';
import { C } from '../../theme';
import { CopyText } from '../../components/Pickers';

const ROLE_LABEL = { installer: 'Installer', distributor: 'Distributor', admin: 'Voltra Admin' };
const ic = { color: C.accentDark, size: 22 };

// Me tab of the portfolio app (web: BusinessMe in Business.jsx).
export default function BusinessMe() {
  const { user, plants, signOut } = useSession();
  const unread = useUnread();
  const openPlant = useOpenPlant();
  // A partner with a single plant gets its Sharing / Tariff here too (web: `only`).
  const plant = plants?.length === 1 ? plants[0] : null;
  const rows = [
    plant && { icon: <DeviceIcon {...ic} />, title: plant.plantName, sub: 'Open the plant: energy flow, devices, settings', onPress: () => openPlant(plant.plantId) },
    user.role === 'admin' && { icon: <UsersIcon {...ic} />, title: 'Users & approvals', sub: 'Every account: approve, reset passwords, link plants', to: '/users' },
    user.role !== 'admin' && { icon: <UsersIcon {...ic} />, title: 'Partners', sub: user.role === 'distributor' ? 'Installers & distributors in your organization' : 'Partners under your organization', to: '/partners' },
    user.role === 'admin' && { icon: <UsersIcon {...ic} />, title: 'Partners', sub: 'All installers & distributors', to: '/partners' },
    { icon: <ChartIcon {...ic} />, title: 'Statistical Report', sub: 'Energy per plant for a month or year · CSV', to: { pathname: '/reports', params: { initial: 'statistical' } } },
    plant && { icon: <ShareIcon {...ic} />, title: 'Plant Sharing', sub: `Share ${plant.plantName} with its owner's family`, to: '/sharing' },
    { icon: <ChatIcon {...ic} />, title: 'Messages', sub: unread ? `${unread} unread` : 'Alarms, automation, changes, sign-ups', to: '/messages', badge: unread },
    { icon: <SendIcon {...ic} />, title: 'Notification Settings', sub: 'Alerts for alarms and automation', to: '/notifications' },
    { icon: <MailIcon {...ic} />, title: 'Email Subscription', sub: user.emailAlerts ? 'Alarm e-mails on' : 'Off', to: '/email-subscription' },
    user.role !== 'admin' && { icon: <PlusIcon {...ic} />, title: 'Add plant', sub: 'Link a system with its inverter SN + registration no.', to: '/add-plant' },
    plant && { icon: <TariffIcon {...ic} />, title: 'Tariff Setting', sub: `Electricity prices for ${plant.plantName}`, to: '/tariff' },
    { icon: <GearIcon {...ic} />, title: 'General Settings', sub: 'Account, password, display, cache', to: '/general-settings' },
    { icon: <InfoIcon {...ic} />, title: 'About', sub: 'Version, updates, privacy', to: '/about' },
  ].filter(Boolean);

  return (
    <Screen>
      <View style={st.head}>
        <View style={st.avatar}><MeIcon size={34} color={C.accentDark} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.h1} numberOfLines={1}>{user.company || user.name || user.login}</Text>
          <Text style={st.muted}>{ROLE_LABEL[user.role]}{user.company && user.name ? ` · ${user.name}` : ''}</Text>
        </View>
        <BoltIcon size={24} color={C.accent} />
      </View>

      {!!user.orgNo && <OrgNumber orgNo={user.orgNo} root={user.role === 'admin'} />}

      <List>
        {rows.map((r, i) => (
          <ListRow key={r.title} icon={r.icon} title={r.title} sub={r.sub} last={i === rows.length - 1}
            right={r.badge ? <CountBadge n={r.badge} /> : null}
            onPress={r.onPress || (() => router.push(r.to))} />
        ))}
      </List>

      <Button ghost title="Log out" style={{ marginTop: 8 }} onPress={() => Alert.alert('Log out of Voltra?', '', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: signOut },
      ])} />
    </Screen>
  );
}

// The number partners type at sign-up to register under this organization.
function OrgNumber({ orgNo, root }) {
  return (
    <Card>
      <Text style={st.muted}>{root ? 'Voltra Organization Number' : 'Your Organization Number'}</Text>
      <CopyText value={orgNo} style={st.org} />
      <Text style={st.small}>{root ? 'Distributors working directly with Voltra enter this at sign-up.' : 'Partners enter this at sign-up to join your organization.'}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 22, fontWeight: '700', color: C.ink },
  muted: { color: C.muted, fontSize: 13 },
  small: { color: C.muted, fontSize: 12 },
  org: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: 1.5, marginVertical: 4, fontVariant: ['tabular-nums'] },
});
