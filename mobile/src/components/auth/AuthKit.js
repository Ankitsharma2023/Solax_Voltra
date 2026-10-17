import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { api, API_URL } from '../../lib/api';
import { C } from '../../theme';

// Pieces shared by the sign-up and forgot-password screens — the phone versions of the helpers at the
// bottom of the web app's src/screens/Login.jsx (Field with icon, PasswordInput, Agree, code buttons).

// Voltra's public contact details (same defaults as the web app's src/company.js).
export const COMPANY = {
  phone: process.env.EXPO_PUBLIC_SUPPORT_PHONE || '+91 99929 29203',
  email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'info@voltra.in',
};
export const telHref = (p) => `tel:${p.replace(/[^\d+]/g, '')}`;

// Same rules as checkPasswordStrength on the server, so mistakes show before the code is used.
export function passwordProblem(p) {
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (p !== p.trim()) return 'Password cannot start or end with a space';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain letters and numbers';
  return null;
}

// White page with the logo area left out; scrolls above the keyboard.
export function AuthScreen({ children, onBack, backLabel = 'Back' }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={a.wrap} keyboardShouldPersistTaps="handled">
          {onBack && (
            <Pressable onPress={onBack} hitSlop={10} style={a.back} accessibilityLabel="Back">
              <Text style={a.backText}>‹ {backLabel}</Text>
            </Pressable>
          )}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ICONS = {
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  lock: <><Rect x="5" y="10" width="14" height="10" rx="2" /><Path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  mail: <><Rect x="3" y="5" width="18" height="14" rx="2" /><Path d="m3 7 9 6 9-6" /></>,
  device: <><Rect x="4" y="5" width="16" height="12" rx="2" /><Path d="M9 21h6M12 17v4" /></>,
  shield: <><Path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><Path d="m9 12 2 2 4-4" /></>,
  wifi: <><Path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.5a4 4 0 0 1 6 0" /><Circle cx="12" cy="19.5" r=".8" /></>,
};

export function AuthField({ icon, label, required, right, children }) {
  return (
    <View style={a.field}>
      <View style={a.labelRow}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth={1.8} strokeLinecap="round">{ICONS[icon]}</Svg>
        <Text style={a.label}>{label}{required && <Text style={{ color: C.bad }}> *</Text>}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function AuthInput({ style, ...props }) {
  return <TextInput placeholderTextColor="#b3b9c0" {...props} style={[a.input, style]} />;
}

export function PasswordInput({ value, onChange, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <AuthInput value={value} onChangeText={onChange} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} style={{ paddingRight: 40 }} {...rest} />
      <Pressable style={a.eye} onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={1.8} strokeLinecap="round">
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><Circle cx="12" cy="12" r="3" />
          {!show && <Path d="M4 4l16 16" />}
        </Svg>
      </Pressable>
    </View>
  );
}

export function Checkbox({ checked, onChange, children }) {
  return (
    <Pressable style={a.check} onPress={() => onChange(!checked)} hitSlop={6} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[a.box, checked && a.boxOn]}>
        {checked && <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><Path d="m5 12 5 5 9-10" /></Svg>}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function Agree({ checked, onChange }) {
  return (
    <Checkbox checked={checked} onChange={onChange}>
      <Text style={a.agree}>
        I have read and agree to the{' '}
        <Text style={a.link} onPress={() => Linking.openURL(`${API_URL}/privacy.html`)}>Privacy Policy</Text>
        {' '}and{' '}
        <Text style={a.link} onPress={() => Linking.openURL(`${API_URL}/terms.html`)}>User Terms</Text>
      </Text>
    </Checkbox>
  );
}

export function PrimaryButton({ title, busyTitle, busy, disabled, onPress }) {
  return (
    <Pressable style={({ pressed }) => [a.btn, (busy || disabled) && { opacity: 0.55 }, pressed && { opacity: 0.8 }]} onPress={onPress} disabled={busy || disabled}>
      {busy ? <View style={a.busyRow}><ActivityIndicator color="#fff" /><Text style={a.btnText}>{busyTitle}</Text></View> : <Text style={a.btnText}>{title}</Text>}
    </Pressable>
  );
}

export function ErrorBox({ children }) {
  return children ? <Text style={a.err} accessibilityRole="alert">{children}</Text> : null;
}

function useCountdown(start) {
  const [left, setLeft] = useState(start);
  useEffect(() => { if (!left) return undefined; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  return [left, setLeft];
}

function CodeButton({ title, disabled, onPress }) {
  return (
    <Pressable style={[a.codeBtn, disabled && a.codeBtnOff]} disabled={disabled} onPress={onPress}>
      <Text style={[a.codeBtnText, disabled && { color: C.muted }]}>{title}</Text>
    </Pressable>
  );
}

// "Send Verification Code" with a 60 s countdown, like SolaX.
export function SendCodeButton({ email, purpose, onSent, onError }) {
  const [left, setLeft] = useCountdown(0);
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true); onError(null);
    try { onSent(await api('/api/auth/send-code', { method: 'POST', body: { email: email.trim(), purpose } })); setLeft(60); } catch (e) { onError(e.message); }
    setBusy(false);
  }
  return <CodeButton disabled={busy || left > 0 || !email.trim()} onPress={send}
    title={left > 0 ? `Resend (${left}s)` : busy ? 'Sending…' : 'Send Verification Code'} />;
}

// Forgot password, step 2: the code was just sent, so the countdown starts at 60.
export function ResendButton({ login, onSent, onError }) {
  const [left, setLeft] = useCountdown(60);
  async function resend() {
    onError(null);
    try { onSent(await api('/api/auth/forgot', { method: 'POST', body: { login } })); setLeft(60); } catch (e) { onError(e.message); }
  }
  return <CodeButton disabled={left > 0} onPress={resend} title={left > 0 ? `Resend (${left}s)` : 'Resend code'} />;
}

export const a = StyleSheet.create({
  wrap: { padding: 24, paddingTop: 20, paddingBottom: 40, flexGrow: 1 },
  back: { alignSelf: 'flex-start', marginBottom: 14, paddingVertical: 4 },
  backText: { color: C.muted, fontSize: 15 },
  hello: { fontSize: 28, fontWeight: '700', color: C.ink },
  welcome: { fontSize: 15, color: C.muted, marginTop: 4, marginBottom: 24, lineHeight: 21 },
  field: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  label: { fontSize: 14, color: C.ink2 },
  input: { fontSize: 16, color: C.ink, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', borderBottomWidth: 1.5, borderBottomColor: '#e3e7eb', paddingVertical: 10, paddingHorizontal: 2 },
  eye: { position: 'absolute', right: 2, top: 0, bottom: 0, justifyContent: 'center' },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#c9ced4', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: C.accent, borderColor: C.accent },
  agree: { fontSize: 13, lineHeight: 19, color: C.ink2 },
  link: { color: C.accentDark },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  err: { color: C.bad, backgroundColor: '#fdf1f1', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, marginBottom: 14, overflow: 'hidden' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBtn: { borderWidth: 1, borderColor: '#bfe9dc', backgroundColor: C.accentSoft, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  codeBtnOff: { backgroundColor: C.soft, borderColor: C.line },
  codeBtnText: { fontSize: 13, fontWeight: '600', color: C.accentDark },
  codeSent: { fontSize: 13, color: C.accentDark, marginTop: -8, marginBottom: 14, lineHeight: 18 },
  section: { gap: 2, marginTop: 4, marginBottom: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  muted: { fontSize: 13, color: C.muted, lineHeight: 18 },
  switch: { textAlign: 'center', marginTop: 24, color: C.muted, fontSize: 14 },
  helpLine: { fontSize: 13, color: C.ink2, lineHeight: 19, marginTop: 20 },
});
