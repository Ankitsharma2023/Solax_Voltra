import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { usePlantSetting } from '../../lib/settings';
import { Screen, List, ListRow, Button } from '../../components/ui';
import { ChartIcon, HomeIcon, InfoIcon, MeIcon, PlusIcon, TariffIcon } from '../../components/Icons';
import { ChatIcon, CountBadge, GearIcon, MailIcon, SendIcon, ShareIcon, useUnread } from '../../components/me/common';
import AppVersion from '../../components/me/AppVersion';
import { C, card } from '../../theme';

const ic = { color: C.accentDark, size: 22 };

// Me tab of the plant app (web: src/screens/Me.jsx). Partners opening a plant see this one too.
export default function Me() {
  const { user, plant, plants: all, isBusiness, setPlantId, signOut } = useSession();
  // Partners open one plant at a time from their portfolio (web passes plants=[plant]), so no switcher.
  const plants = isBusiness ? [plant] : all;
  const [tariff] = usePlantSetting(plant.plantId, 'tariff', null);
  const unread = useUnread();
  const go = (to) => () => router.push(to);

  const groups = [
    [
      { icon: <ShareIcon {...ic} />, title: 'Plant Sharing', sub: plant.sharedPerm ? `Shared with you · ${plant.sharedPerm === 'view' ? 'view only' : 'view and control'}` : 'Family, caretaker or a second phone', to: '/sharing' },
      { icon: <TariffIcon {...ic} />, title: 'Tariff Setting', sub: tariff ? `${tariff.currency}${tariff.mode === 'tou' ? 'TOU' : tariff.importPrice}/kWh` : 'Not set', to: '/tariff' },
    ],
    [
      { icon: <ChatIcon {...ic} />, title: 'Messages', sub: unread ? `${unread} unread` : 'Alarms, automation and changes', to: '/messages', badge: unread },
      { icon: <SendIcon {...ic} />, title: 'Notification Settings', sub: 'Alarms & automation alerts', to: '/notifications' },
      { icon: <MailIcon {...ic} />, title: 'Email Subscription', sub: user.emailAlerts ? 'Alarm e-mails on' : 'Off', to: '/email-subscription' },
      { icon: <GearIcon {...ic} />, title: 'General Settings', sub: 'Account, display, cache, privacy', to: '/general-settings' },
    ],
  ];

  return (
    <Screen>
      <View style={s.head}>
        <View style={s.avatar}><MeIcon size={34} color={C.accentDark} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.h1} numberOfLines={1}>{user.name || user.login}</Text>
          <Text style={s.muted} numberOfLines={1}>{user.name ? user.login : ''}{user.role === 'admin' ? ' · Voltra admin' : ''}</Text>
        </View>
      </View>

      <View style={s.tiles}>
        <Pressable style={({ pressed }) => [card, s.tile, pressed && { backgroundColor: C.soft }]} onPress={go('/plant-info')}>
          <View style={[s.tileIcon, { backgroundColor: C.accentDark }]}><HomeIcon size={24} color="#fff" /></View>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.tileTitle}>Plant</Text>
            <Text style={s.small} numberOfLines={1}>{plants.length > 1 ? `${plants.length} systems` : plant.plantName}</Text>
          </View>
        </Pressable>
        <Pressable style={({ pressed }) => [card, s.tile, pressed && { backgroundColor: C.soft }]} onPress={go('/stats')}>
          <View style={[s.tileIcon, { backgroundColor: C.solar }]}><ChartIcon size={24} color="#fff" /></View>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.tileTitle}>Statistics</Text>
            <Text style={s.small} numberOfLines={1}>Day · Month · Year</Text>
          </View>
        </Pressable>
      </View>

      {plants.length > 1 && (
        <View style={card}>
          <Text style={s.muted}>Current plant</Text>
          {plants.map((p, i) => (
            <Pressable key={p.plantId} style={[s.row, i === plants.length - 1 && { borderBottomWidth: 0 }]} onPress={() => setPlantId(p.plantId)}>
              <Text style={[s.rowText, p.plantId === plant.plantId && { color: C.accentDark, fontWeight: '700' }]} numberOfLines={1}>
                {p.plantName}{p.sharedPerm ? ' (shared with you)' : ''}
              </Text>
              {p.plantId === plant.plantId && <Text style={{ color: C.accentDark }}>✓</Text>}
            </Pressable>
          ))}
        </View>
      )}

      {groups.map((rows, i) => <MeList key={i} rows={rows} />)}

      <Text style={s.section}>Application</Text>
      <MeList rows={[{ icon: <PlusIcon {...ic} />, title: 'Add another system', sub: 'Second home or new installation', to: '/add-plant' }]} />

      <Text style={s.section}>Help Center</Text>
      <MeList rows={[
        { icon: <InfoIcon {...ic} />, title: 'Help & contact', sub: 'Service: Amish Sharma · +91 70181 52711', to: '/help' },
        { icon: <InfoIcon {...ic} />, title: 'About', sub: 'Privacy, terms, app version', to: '/about' },
      ]} />

      <AppVersion title="App version" />

      <Button ghost title="Log out" onPress={() => Alert.alert('Log out of Voltra?', '', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: signOut },
      ])} />
    </Screen>
  );
}

function MeList({ rows }) {
  return (
    <List>
      {rows.map((r, i) => (
        <ListRow key={r.title} icon={r.icon} title={r.title} sub={r.sub} last={i === rows.length - 1}
          right={r.badge ? <CountBadge n={r.badge} /> : null} onPress={() => router.push(r.to)} />
      ))}
    </List>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 22, fontWeight: '700', color: C.ink },
  muted: { color: C.muted, fontSize: 13 },
  small: { color: C.muted, fontSize: 12 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12 },
  tileIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  rowText: { fontSize: 15, color: C.ink, flexShrink: 1 },
  section: { fontSize: 15, fontWeight: '700', color: C.ink2, marginTop: 8, marginBottom: 8, marginLeft: 4 },
});
