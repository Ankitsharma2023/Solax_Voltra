import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { C, card } from '../../theme';

// App version + over-the-air update check (EAS Update). In Expo Go and dev builds updates are off.
export default function AppVersion({ title = 'About' }) {
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
      {!!title && <Text style={s.h3}>{title}</Text>}
      <View style={s.row}><Text style={s.rowText}>Version</Text><Text style={s.muted}>{Constants.expoConfig?.version}</Text></View>
      <View style={s.row}><Text style={s.rowText}>Update</Text><Text style={s.muted} numberOfLines={1}>
        {Updates.isEmbeddedLaunch ? 'Built in' : (Updates.updateId || '').slice(0, 8)}{Updates.createdAt ? ` · ${Updates.createdAt.toISOString().slice(0, 10)}` : ''}</Text></View>
      <Pressable style={[s.row, { borderBottomWidth: 0 }]} onPress={check} disabled={state === 'checking'}>
        <Text style={[s.rowText, { color: C.accentDark }]}>Check for updates</Text>
        {state === 'checking' && <ActivityIndicator color={C.accent} />}
      </Pressable>
      {state && state !== 'checking' && <Text style={[s.muted, { marginTop: 4 }]}>{state}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  h3: { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 4 },
  muted: { color: C.muted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, gap: 12 },
  rowText: { fontSize: 15, color: C.ink, flexShrink: 1 },
});
