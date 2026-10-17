import { useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { G, Path } from 'react-native-svg';
import { api, storage } from '../lib/api';
import { useSession } from '../lib/session';
import { ScanInput } from '../components/ScanInput';
import { a, Agree, AuthField, AuthInput, AuthScreen, ErrorBox, PasswordInput, passwordProblem, PrimaryButton, SendCodeButton } from '../components/auth/AuthKit';
import { PasswordRules } from '../components/auth/PasswordRules';
import { C } from '../theme';

// Sign up, as in SolaX (and the web app's src/screens/Login.jsx): choose identity → form.
// The server answers { user, token, pendingClaim }; acceptSession signs in and the root layout shows the app
// (or the "Voltra is registering your system" screen when pendingClaim is set).
const IDENTITIES = [
  { id: 'end_user', title: 'End User', desc: 'Residential plant users', art: 'home' },
  { id: 'distributor', title: 'Distributor', desc: 'Develop downstream partners & users who also provide power plant installation/O&M services for owners', art: 'grid' },
  { id: 'installer', title: 'Installer', desc: 'Users who provide services to owners', art: 'tools' },
];

export default function Signup() {
  const [identity, setIdentity] = useState(null);

  // Android back button: from the form go back to "choose your identity" first.
  useEffect(() => {
    if (!identity) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setIdentity(null); return true; });
    return () => sub.remove();
  }, [identity]);

  return identity ? <SignupForm identity={identity} onBack={() => setIdentity(null)} /> : <Identity onPick={setIdentity} />;
}

const leave = () => (router.canGoBack() ? router.back() : router.replace('/login'));

function Identity({ onPick }) {
  const [pick, setPick] = useState(null);
  return (
    <AuthScreen onBack={leave}>
      <Text style={[a.hello, { fontSize: 24, marginBottom: 20 }]}>Please choose your identity</Text>
      <View style={{ gap: 12, marginBottom: 20 }}>
        {IDENTITIES.map((it) => {
          const on = pick === it.id;
          return (
            <Pressable key={it.id} onPress={() => setPick(it.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={({ pressed }) => [st.identity, on && st.identityOn, pressed && { transform: [{ scale: 0.99 }] }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.idTitle}>{it.title}</Text>
                <Text style={st.idDesc}>{it.desc}</Text>
              </View>
              <IdentityArt kind={it.art} />
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton title="Confirm" disabled={!pick} onPress={() => onPick(pick)} />
    </AuthScreen>
  );
}

function IdentityArt({ kind }) {
  const box = (x, y, c = '#e8edf2', top = '#f7f9fb') => (
    <G key={`${x}${y}`}>
      <Path d={`M${x} ${y}l9 -5 9 5 -9 5z`} fill={top} stroke="#d5dce3" strokeWidth={0.6} />
      <Path d={`M${x} ${y}v8l9 5v-8z`} fill={c} /><Path d={`M${x + 18} ${y}v8l-9 5v-8z`} fill="#dfe5eb" />
    </G>
  );
  return (
    <Svg width={64} height={56} viewBox="0 0 64 56">
      {kind === 'home' && <>{box(14, 22)}{box(32, 22)}<Path d="M23 12l9-6 9 6-9 5z" fill="#1baf7a" opacity={0.85} />{box(23, 30)}</>}
      {kind === 'grid' && [[6, 20], [24, 20], [42, 20], [15, 30], [33, 30], [24, 40]].map(([x, y]) => box(x, y, x === 24 && y === 20 ? '#bfe9dc' : '#e8edf2'))}
      {kind === 'tools' && [[10, 24], [28, 24], [19, 34], [37, 34]].map(([x, y]) => box(x, y, x === 28 ? '#bfe9dc' : '#e8edf2'))}
    </Svg>
  );
}

function SignupForm({ identity, onBack }) {
  const { acceptSession } = useSession();
  const business = identity === 'installer' || identity === 'distributor';
  const [f, setF] = useState({ identity, name: '', company: '', zip: '', orgNo: '', phone: '', login: '', code: '', password: '', confirm: '', inverterSn: '', registerNo: '', agree: false });
  const [sent, setSent] = useState(null);
  const [notice, setNotice] = useState(business); // SolaX shows a "User Notice" when a business form opens
  const [orgHelp, setOrgHelp] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function submit() {
    const weak = f.password && passwordProblem(f.password);
    if (weak) return setErr(weak);
    if (f.password !== f.confirm) return setErr('Passwords do not match.');
    if (!f.agree) return setErr('Please read and accept the Privacy Policy and User Terms.');
    setBusy(true); setErr(null);
    try {
      const { confirm, ...body } = f;
      const r = await api('/api/auth/register', { method: 'POST', body });
      await storage.set('voltra.lastLogin', f.login.trim());
      await acceptSession(r);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <AuthScreen onBack={onBack} backLabel={IDENTITIES.find((x) => x.id === identity)?.title}>
      <Text style={a.hello}>Create account</Text>
      <Text style={a.welcome}>{business ? 'Monitor the systems you install and service' : 'Link your Voltra system to see it in the app'}</Text>

      {business && <>
        <AuthField icon="device" label="Company Name" required>
          <AuthInput value={f.company} onChangeText={set('company')} placeholder="Please Enter" autoComplete="organization" textContentType="organizationName" />
        </AuthField>
        {identity === 'installer' && (
          <AuthField icon="mail" label="Zip Code" required>
            <AuthInput value={f.zip} onChangeText={set('zip')} placeholder="Please Enter" keyboardType="number-pad" autoComplete="postal-code" textContentType="postalCode" />
          </AuthField>
        )}
        <AuthField icon="device" label="Distributor Organization Number" required={identity === 'distributor'}
          right={<Pressable onPress={() => setOrgHelp((v) => !v)} hitSlop={10} style={st.helpDot} accessibilityLabel="What is this?"><Text style={st.helpDotText}>?</Text></Pressable>}>
          <AuthInput value={f.orgNo} onChangeText={set('orgNo')} autoCapitalize="characters" autoCorrect={false}
            placeholder={identity === 'distributor' ? 'Number of your superior channel partner' : 'Optional: your distributor\'s number'} />
        </AuthField>
        {orgHelp && (
          <Text style={st.orgHelp}>
            Ask your superior channel partner for their Organization Number (shown in their Voltra app under Me).{' '}
            {identity === 'installer' ? 'Leave empty if you work directly with Voltra.' : 'If you work directly with Voltra, ask Voltra for its number.'}
          </Text>
        )}
      </>}

      <AuthField icon="user" label={business ? 'Contact Person' : 'Full name'}>
        <AuthInput value={f.name} onChangeText={set('name')} placeholder={business ? 'Please Enter' : 'Your name'} autoComplete="name" textContentType="name" />
      </AuthField>
      {business && (
        <AuthField icon="mail" label="Phone Number">
          <AuthInput value={f.phone} onChangeText={set('phone')} placeholder="+91 Please Enter" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        </AuthField>
      )}
      <AuthField icon="mail" label="E-Mail Address" required>
        <View style={a.codeRow}>
          <AuthInput style={{ flex: 1 }} value={f.login} onChangeText={set('login')} placeholder="Enter Your Email" keyboardType="email-address"
            autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
          <SendCodeButton email={f.login} purpose="signup" onSent={setSent} onError={setErr} />
        </View>
      </AuthField>
      {sent && (
        <Text style={a.codeSent}>
          Code sent to {sent.sentTo} from no-reply@voltra.in.
          {sent.devCodes ? ' (Test mode: email is not set up yet — the code is in the server log.)' : ' Not in your inbox within a minute? Check Spam and Promotions. The code works for 10 minutes.'}
        </Text>
      )}
      <AuthField icon="shield" label="Verification Code" required>
        <AuthInput value={f.code} onChangeText={(v) => set('code')(v.replace(/\D/g, ''))} maxLength={6} placeholder="6-digit code from the e-mail"
          keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
      </AuthField>
      <AuthField icon="lock" label="Password">
        <PasswordInput value={f.password} onChange={set('password')} placeholder="At least 8 characters, letters + numbers" autoComplete="new-password" textContentType="newPassword" />
        <PasswordRules value={f.password} />
      </AuthField>
      <AuthField icon="lock" label="Confirm password">
        <PasswordInput value={f.confirm} onChange={set('confirm')} placeholder="Re-enter password" autoComplete="new-password" textContentType="newPassword" />
      </AuthField>

      {business ? (
        <View style={a.section}>
          <Text style={a.sectionTitle}>Approval by Voltra</Text>
          <Text style={a.muted}>Business accounts are checked by Voltra before use. After approval you can add the systems you install.</Text>
        </View>
      ) : <>
        <View style={a.section}>
          <Text style={a.sectionTitle}>Your system</Text>
          <Text style={a.muted}>Both numbers are printed on the labels of your devices. If someone shared their system with your e-mail, leave both empty.</Text>
        </View>
        <AuthField icon="device" label="Inverter SN">
          <ScanInput style={a.input} value={f.inverterSn} onChange={set('inverterSn')} length={14} scanTitle="inverter label" placeholder="14 characters, e.g. H34XXXXXXXXXXX" />
        </AuthField>
        <AuthField icon="wifi" label="Registration No. (on the WiFi dongle)">
          <ScanInput style={a.input} value={f.registerNo} onChange={set('registerNo')} length={10} scanTitle="WiFi dongle" placeholder="10 characters, e.g. SXXXXXXXXX" />
        </AuthField>
      </>}

      <ErrorBox>{err}</ErrorBox>
      <PrimaryButton title="Sign Up" busyTitle="Creating account…" busy={busy} onPress={submit} />
      <Agree checked={f.agree} onChange={set('agree')} />
      <Text style={a.switch}>Account already exists? <Text style={a.link} onPress={leave}>Login</Text></Text>

      <Modal visible={notice} transparent animationType="fade" onRequestClose={() => setNotice(false)}>
        <View style={st.backdrop}>
          <View style={st.modal}>
            <View style={st.modalArt}><Text style={{ fontSize: 36 }}>🪪</Text></View>
            <Text style={st.modalTitle}>User Notice</Text>
            <Text style={st.modalText}>If your superior channel partner has already registered on this platform, we recommend that you contact the superior channel partner to add it directly.</Text>
            <PrimaryButton title="Confirm" onPress={() => setNotice(false)} />
          </View>
        </View>
      </Modal>
    </AuthScreen>
  );
}

const st = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 16, backgroundColor: '#fff' },
  identityOn: { borderColor: C.ink, shadowColor: C.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  idTitle: { fontSize: 18, fontWeight: '600', color: C.ink },
  idDesc: { fontSize: 13, color: C.muted, lineHeight: 18 },
  helpDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#c9ced4', alignItems: 'center', justifyContent: 'center' },
  helpDotText: { fontSize: 10, color: C.muted, lineHeight: 12 },
  orgHelp: { fontSize: 13, color: C.ink2, backgroundColor: C.soft, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: -8, marginBottom: 16, overflow: 'hidden', lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 18, paddingTop: 26, paddingHorizontal: 22, paddingBottom: 20, maxWidth: 360, width: '100%' },
  modalArt: { width: 76, height: 76, borderRadius: 18, backgroundColor: C.accentSoft, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 8 },
  modalText: { fontSize: 15, color: C.ink2, lineHeight: 21, textAlign: 'center', marginBottom: 8 },
});
