import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../lib/api';
import { C } from '../theme';

// Tabs not yet ported from the web app: point to the web app until they arrive in an app update.
export default function ComingSoon({ title, what, hash }) {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.wrap}>
        <Text style={s.h1}>{title}</Text>
        <View style={s.box}>
          <Text style={s.text}>{what} {'\n\n'}This part is coming in the next app update. Until then it is in the Voltra web app.</Text>
          <Pressable style={s.btn} onPress={() => Linking.openURL(`${API_URL}/#${hash}`)}>
            <Text style={s.btnText}>Open in web app</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16 },
  h1: { fontSize: 24, fontWeight: '700', color: C.ink, marginBottom: 16 },
  box: { backgroundColor: C.soft, borderRadius: 18, padding: 20, gap: 16 },
  text: { fontSize: 15, color: C.ink2, lineHeight: 22 },
  btn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
