import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

export function Splash({ message, error, onRetry, action }) {
  return (
    <View style={s.wrap}>
      <Image source={require('../../assets/voltra-logo.png')} style={s.logo} resizeMode="contain" />
      {error ? <Text style={[s.text, { color: C.bad }]}>{error}</Text>
        : message ? <Text style={s.text}>{message}</Text>
        : <ActivityIndicator color={C.accent} />}
      {error && onRetry && <Pressable onPress={onRetry} style={s.btn}><Text style={s.btnText}>Try again</Text></Pressable>}
      {action}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32, backgroundColor: C.bg },
  logo: { width: 163, height: 72 },
  text: { color: C.muted, fontSize: 15, textAlign: 'center' },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: C.accentSoft },
  btnText: { color: C.accentDark, fontWeight: '600' },
});
