import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../lib/api';
import { C } from '../../theme';

// "Unlock Password" / "Installer Password" dialog (web UnlockDialog in src/screens/RemoteSettings.jsx).
// POST /api/plants/:id/unlock → { level: 'basic' | 'advanced' }; wrong passwords show the server's message.
export default function UnlockDialog({ visible, plantId, advanced, onCancel, onUnlocked }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (!pw || busy) return;
    setBusy(true); setErr(null);
    try {
      const b = await api(`/api/plants/${plantId}/unlock`, { method: 'POST', body: { password: pw } });
      setPw('');
      onUnlocked(b.level);
    } catch (e) { setErr(e.message || 'Incorrect password.'); }
    finally { setBusy(false); }
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={d.backdrop}>
        <View style={d.box}>
          <Text style={d.title}>{advanced ? 'Installer Password' : 'Unlock Password'}</Text>
          <TextInput value={pw} onChangeText={setPw} secureTextEntry autoFocus keyboardType="number-pad" autoComplete="off"
            placeholder="Password" placeholderTextColor="#b3b9c0" style={d.input} onSubmitEditing={confirm} returnKeyType="done" />
          {err ? <Text style={[d.small, { color: C.bad }]}>{err}</Text>
            : <Text style={d.small}>{advanced ? 'Ask Voltra for the installer password.' : 'The inverter password (default 0000, or the one saved under Backup Password).'}</Text>}
          <View style={d.actions}>
            <Pressable onPress={onCancel} style={d.action} hitSlop={6}><Text style={d.cancel}>Cancel</Text></Pressable>
            <Pressable onPress={confirm} disabled={busy || !pw} style={[d.action, (busy || !pw) && { opacity: 0.5 }]} hitSlop={6}>
              <Text style={d.ok}>{busy ? '…' : 'Confirm'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const d = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 18, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: C.ink, textAlign: 'center' },
  input: { fontSize: 18, color: C.ink, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, textAlign: 'center', letterSpacing: 4 },
  small: { fontSize: 12, color: C.muted, textAlign: 'center' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, marginTop: 4, marginHorizontal: -20, marginBottom: -20 },
  action: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  cancel: { fontSize: 16, color: C.muted },
  ok: { fontSize: 16, color: C.accentDark, fontWeight: '700' },
});
