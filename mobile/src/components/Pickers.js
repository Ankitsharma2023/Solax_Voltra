import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from '../theme';

// Small native helpers: a value with a copy button, and a calendar date field.

const CopyIcon = ({ color }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="9" y="9" width="11" height="11" rx="2" /><Path d="M5 15V5a1 1 0 0 1 1-1h9" />
  </Svg>
);

// Text + tap-to-copy (serial numbers, organization number, temporary passwords).
export function CopyText({ value, style, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await Clipboard.setStringAsync(String(value ?? ''));
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Pressable onPress={copy} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${label} ${value}`} style={s.copy}>
      <Text style={style} selectable>{String(value ?? '--')}</Text>
      {copied ? <Text style={s.copied}>Copied ✓</Text> : <CopyIcon color={C.accentDark} />}
    </Pressable>
  );
}

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); };

// Calendar picker. Android shows its own dialog; iOS a calendar in a sheet. `onPick('YYYY-MM-DD')`.
export function DatePicker({ visible, value, onPick, onClose, maximumDate = new Date() }) {
  const [draft, setDraft] = useState(null);
  if (!visible || Platform.OS === 'web') return null;
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker value={parse(value)} mode="date" maximumDate={maximumDate}
        onChange={(e, d) => { onClose(); if (e.type === 'set' && d) onPick(ymd(d)); }} />
    );
  }
  const current = draft || parse(value);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <DateTimePicker value={current} mode="date" display="inline" maximumDate={maximumDate} accentColor={C.accent}
          onChange={(_e, d) => d && setDraft(d)} />
        <View style={s.sheetBtns}>
          <Pressable onPress={() => { setDraft(null); onClose(); }} hitSlop={8}><Text style={s.cancel}>Cancel</Text></Pressable>
          <Pressable onPress={() => { onPick(ymd(current)); setDraft(null); onClose(); }} hitSlop={8}><Text style={s.done}>Done</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Form field showing a date; tap to open the calendar (typed in on the web).
export function DateField({ value, onChange, placeholder = 'Select date', style }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') {
    return <TextInput value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor="#b3b9c0" style={[s.input, style]} />;
  }
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[s.input, s.dateBtn, style]} accessibilityRole="button">
        <Text style={{ fontSize: 16, color: value ? C.ink : '#b3b9c0' }}>{value || placeholder}</Text>
        {!!value && <Pressable onPress={() => onChange('')} hitSlop={10}><Text style={s.clear}>✕</Text></Pressable>}
      </Pressable>
      <DatePicker visible={open} value={value} onPick={onChange} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  copy: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  copied: { color: C.accentDark, fontSize: 12, fontWeight: '600' },
  input: { fontSize: 16, color: C.ink, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clear: { color: C.muted, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 12, paddingBottom: 30 },
  sheetBtns: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 },
  cancel: { color: C.muted, fontSize: 16 },
  done: { color: C.accentDark, fontSize: 16, fontWeight: '700' },
});
