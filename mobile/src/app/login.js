import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../lib/session';
import { storage } from '../lib/api';
import { Agree } from '../components/auth/AuthKit';
import { C } from '../theme';

// Login, modelled on the SolaX Cloud login (same look as the web app). The session is always kept on the
// phone, so there is no "Remember Me"; the last account is pre-filled like the web app does.
export default function Login() {
  const { signIn } = useSession();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    storage.get('voltra.lastLogin').then((v) => { if (v) { setLogin((x) => x || v); setAgree(true); } });
  }, []);

  async function submit() {
    if (!login.trim() || !password) return setErr('Enter your email/mobile number and password.');
    if (!agree) return setErr('Please read and accept the Privacy Policy and User Terms.');
    setBusy(true); setErr(null);
    try {
      await signIn(login.trim(), password);
      storage.set('voltra.lastLogin', login.trim());
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/voltra-logo.png')} style={s.logo} resizeMode="contain" />
          <Text style={s.hello}>Hello</Text>
          <Text style={s.welcome}>Welcome to Voltra</Text>

          <Text style={s.label}>Email / Mobile number</Text>
          <TextInput style={s.input} value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false}
            keyboardType="email-address" textContentType="username" autoComplete="username" placeholder="Enter your account" placeholderTextColor="#b3b9c0" />

          <Text style={s.label}>Password</Text>
          <View>
            <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry={!show}
              textContentType="password" autoComplete="password" placeholder="Enter your password" placeholderTextColor="#b3b9c0"
              onSubmitEditing={submit} returnKeyType="go" />
            <Pressable style={s.eye} onPress={() => setShow(!show)} hitSlop={10}><Text style={s.eyeText}>{show ? 'Hide' : 'Show'}</Text></Pressable>
          </View>

          {err && <Text style={s.err}>{err}</Text>}
          <Pressable style={({ pressed }) => [s.btn, (busy || pressed) && { opacity: 0.8 }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Log in</Text>}
          </Pressable>

          <View style={s.links}>
            <Pressable onPress={() => router.push('/forgot')} hitSlop={8}><Text style={s.link}>Forgot password?</Text></Pressable>
          </View>
          <Agree checked={agree} onChange={setAgree} />
          <Text style={s.switch}>No Account? <Text style={s.link} onPress={() => router.push('/signup')}>Sign Up</Text></Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 32, flexGrow: 1 },
  logo: { width: 118, height: 52, marginBottom: 36 },
  hello: { fontSize: 30, fontWeight: '700', color: C.ink },
  welcome: { fontSize: 16, color: C.muted, marginTop: 4, marginBottom: 32 },
  label: { fontSize: 14, color: C.ink2, marginBottom: 4 },
  input: { fontSize: 16, color: C.ink, borderBottomWidth: 1.5, borderBottomColor: '#e3e7eb', paddingVertical: 10, paddingHorizontal: 2, marginBottom: 20 },
  eye: { position: 'absolute', right: 2, top: 12 },
  eyeText: { color: C.accentDark, fontWeight: '600' },
  err: { color: C.bad, marginBottom: 12 },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  links: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  switch: { textAlign: 'center', marginTop: 24, color: C.muted, fontSize: 14 },
  link: { color: C.accentDark, fontSize: 14 },
});
