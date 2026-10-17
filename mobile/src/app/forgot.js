import { useEffect, useState } from 'react';
import { BackHandler, Linking, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api, storage } from '../lib/api';
import { useSession } from '../lib/session';
import { a, AuthField, AuthInput, AuthScreen, COMPANY, ErrorBox, PasswordInput, passwordProblem, PrimaryButton, ResendButton, telHref } from '../components/auth/AuthKit';
import { PasswordRules } from '../components/auth/PasswordRules';

// Forgot password, as in SolaX (web app: Forgot in src/screens/Login.jsx):
// account → Next → code to the registered e-mail + new password → signed in ({ user, token }).
export default function Forgot() {
  const { acceptSession } = useSession();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ login: '', code: '', password: '', confirm: '' });
  const [sent, setSent] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => { storage.get('voltra.lastLogin').then((v) => v && setF((x) => (x.login ? x : { ...x, login: v }))); }, []);

  const back = () => { setStep(1); setErr(null); };
  useEffect(() => {
    if (step !== 2) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => sub.remove();
  }, [step]);

  async function next() {
    setBusy(true); setErr(null);
    try { setSent(await api('/api/auth/forgot', { method: 'POST', body: { login: f.login } })); setStep(2); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  async function reset() {
    const weak = passwordProblem(f.password);
    if (weak) return setErr(weak);
    if (f.password !== f.confirm) return setErr('Passwords do not match.');
    setBusy(true); setErr(null);
    try { await acceptSession(await api('/api/auth/reset-password', { method: 'POST', body: f })); }
    catch (e) { setErr(e.message); setBusy(false); }
  }

  if (step === 1) return (
    <AuthScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}>
      <Text style={a.hello}>Forgot password?</Text>
      <Text style={a.welcome}>We'll send a verification code to the e-mail address of your account.</Text>
      <AuthField icon="user" label="User name/Email/Mobile number" required>
        <AuthInput value={f.login} onChangeText={set('login')} placeholder="Please enter your user name/email/mobile number"
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="username" textContentType="username"
          returnKeyType="next" onSubmitEditing={() => f.login && next()} />
      </AuthField>
      <ErrorBox>{err}</ErrorBox>
      <PrimaryButton title="Next" busyTitle="Sending…" busy={busy} disabled={!f.login} onPress={next} />
      <Text style={a.helpLine}>
        Can't access your e-mail? Call <Text style={a.link} onPress={() => Linking.openURL(telHref(COMPANY.phone))}>{COMPANY.phone}</Text>
        {' '}or write to <Text style={a.link} onPress={() => Linking.openURL(`mailto:${COMPANY.email}?subject=Password reset`)}>{COMPANY.email}</Text>.
      </Text>
    </AuthScreen>
  );

  return (
    <AuthScreen onBack={back}>
      <Text style={a.hello}>Reset password</Text>
      <Text style={a.welcome}>A verification code was sent to <Text style={{ fontWeight: '700' }}>{sent?.sentTo}</Text>. Not in your inbox? Check Spam and Promotions.</Text>
      {sent?.devCodes && <Text style={a.codeSent}>Test mode: email is not set up yet — the code is in the server log.</Text>}
      <AuthField icon="shield" label="Verification Code" required>
        <View style={a.codeRow}>
          <AuthInput style={{ flex: 1 }} value={f.code} onChangeText={(v) => set('code')(v.replace(/\D/g, ''))} maxLength={6} placeholder="6-digit code"
            keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
          <ResendButton login={f.login} onSent={setSent} onError={setErr} />
        </View>
      </AuthField>
      <AuthField icon="lock" label="New password" required>
        <PasswordInput value={f.password} onChange={set('password')} placeholder="At least 8 characters, letters + numbers" autoComplete="new-password" textContentType="newPassword" />
        <PasswordRules value={f.password} />
      </AuthField>
      <AuthField icon="lock" label="Confirm password" required>
        <PasswordInput value={f.confirm} onChange={set('confirm')} placeholder="Re-enter password" autoComplete="new-password" textContentType="newPassword" />
      </AuthField>
      <ErrorBox>{err}</ErrorBox>
      <PrimaryButton title="Confirm" busyTitle="Saving…" busy={busy} disabled={f.code.length !== 6} onPress={reset} />
    </AuthScreen>
  );
}
