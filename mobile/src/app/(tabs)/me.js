import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useSession } from '../../lib/session';
import { MeIcon } from '../../components/Icons';
import { C, card } from '../../theme';

const ROLE = { customer: 'Owner', installer: 'Installer', distributor: 'Distributor', admin: 'Voltra Admin' };

export default function Me() {
  const { user, plant, plants, setPlantId, signOut } = useSession();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={s.head}>
          <View style={s.avatar}><MeIcon size={34} color={C.accentDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.h1} numberOfLines={1}>{user.company || user.name || user.login}</Text>
            <Text style={s.muted}>{ROLE[user.role] || user.role} · {user.login}</Text>
          </View>
        </View>

        {plants.length > 1 && (
          <View style={card}>
            <Text style={s.h3}>Plants</Text>
            {plants.map((p) => (
              <Pressable key={p.plantId} style={s.row} onPress={() => setPlantId(p.plantId)}>
                <Text style={[s.rowText, p.plantId === plant.plantId && { color: C.accentDark, fontWeight: '700' }]} numberOfLines={1}>{p.plantName}</Text>
                {p.plantId === plant.plantId && <Text style={{ color: C.accentDark }}>✓</Text>}
              </Pressable>
            ))}
          </View>
        )}

        <AppVersion />

        <Pressable style={s.logout} onPress={() => Alert.alert('Log out of Voltra?', '', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out', style: 'destructive', onPress: signOut },
        ])}>
          <Text style={s.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// App version + over-the-air update check (EAS Update). In Expo Go and dev builds updates are off.
function AppVersion() {
  const [state, setState] = useState(null);
  async function check() {
    if (!Updates.isEnabled) return setState('Updates work in the installed app (not in Expo Go).');
    setState('checking');
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) return setState('You have the latest version.');
      setState('Downloading update…');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) { setState(`Could not check: ${e.message}`); }
  }
  return (
    <View style={card}>
      <Text style={s.h3}>About</Text>
      <View style={s.row}><Text style={s.rowText}>Version</Text><Text style={s.muted}>{Constants.expoConfig?.version}</Text></View>
      <View style={s.row}><Text style={s.rowText}>Update</Text><Text style={s.muted} numberOfLines={1}>
        {Updates.isEmbeddedLaunch ? 'Built in' : (Updates.updateId || '').slice(0, 8)}{Updates.createdAt ? ` · ${Updates.createdAt.toISOString().slice(0, 10)}` : ''}</Text></View>
      <Pressable style={s.row} onPress={check} disabled={state === 'checking'}>
        <Text style={[s.rowText, { color: C.accentDark }]}>Check for updates</Text>
        {state === 'checking' && <ActivityIndicator color={C.accent} />}
      </Pressable>
      {state && state !== 'checking' && <Text style={[s.muted, { marginTop: 8 }]}>{state}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 22, fontWeight: '700', color: C.ink },
  h3: { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 4 },
  muted: { color: C.muted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  rowText: { fontSize: 15, color: C.ink, flexShrink: 1 },
  logout: { marginTop: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center' },
  logoutText: { color: C.bad, fontWeight: '600', fontSize: 15 },
});
