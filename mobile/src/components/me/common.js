import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { api } from '../../lib/api';
import { C } from '../../theme';

// Shared bits for the Me pages and the partner/admin portfolio (web: Me.jsx, Messages.jsx useUnread).

// ---------- icons only these pages use (web Me.jsx) ----------
const L = ({ children, size = 24, color = C.accentDark }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
);
export const ShareIcon = (p) => (<L {...p}><Circle cx="6" cy="12" r="2.5" /><Circle cx="17" cy="6" r="2.5" /><Circle cx="17" cy="18" r="2.5" /><Path d="m8.2 10.8 6.6-3.6M8.2 13.2l6.6 3.6" /></L>);
export const ChatIcon = (p) => (<L {...p}><Path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z" /><Path d="M9 12h.01M12 12h.01M15 12h.01" /></L>);
export const SendIcon = (p) => (<L {...p}><Path d="M21 3 3 10.5l7 2.5 2.5 7z M10 13l4-4" /></L>);
export const MailIcon = (p) => (<L {...p}><Rect x="3" y="5" width="18" height="14" rx="2" /><Path d="m3 7 9 6 9-6" /></L>);
export const GearIcon = (p) => (<L {...p}><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></L>);
export const UsersIcon = (p) => (<L {...p}><Circle cx="9" cy="8" r="3.2" /><Path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><Path d="M16 4.5a3 3 0 0 1 0 6M18 14c1.8.6 2.8 2.2 3 5" /></L>);
export const SearchIcon = (p) => (<L {...p}><Circle cx="11" cy="11" r="6.5" /><Path d="m20 20-4.2-4.2" /></L>);

// Unread messages count (shared with the Messages page, which refreshes it after reading).
export { useUnread, refreshUnread } from '../../lib/messages';

// Saves personal preferences (name, e-mail alerts, notification types). Returns the updated user or null.
export async function savePrefs(patch) {
  try { return (await api('/api/me/prefs', { method: 'POST', body: patch })).user ?? {}; } catch { return null; }
}

// ---------- small UI pieces ----------
export function CountBadge({ n }) {
  if (!n) return null;
  return <Text style={st.count}>{n > 99 ? '99+' : n}</Text>;
}

// A labelled on/off switch row (web .switch-row).
export function SwitchRow({ title, sub, value, onChange, disabled, last }) {
  return (
    <View style={[st.switchRow, !last && st.line]}>
      <View style={{ flex: 1 }}>
        <Text style={[st.title, disabled && { color: C.muted }]}>{title}</Text>
        {!!sub && <Text style={st.sub}>{sub}</Text>}
      </View>
      <Switch value={!!value} onValueChange={onChange} disabled={disabled}
        trackColor={{ true: C.accent, false: '#d7dce1' }} thumbColor="#fff" ios_backgroundColor="#d7dce1" />
    </View>
  );
}

// Filter chips (web .chips .chip).
export function Chips({ options, value, onChange, style }) {
  return (
    <View style={[st.chips, style]}>
      {options.map((o) => {
        const [id, label] = Array.isArray(o) ? o : [o, o];
        const on = id === value;
        return (
          <Pressable key={id} onPress={() => onChange(id)} style={[st.chip, on && st.chipOn]}>
            <Text style={[st.chipText, on && st.chipTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Fade + rise in on mount (web .pop-in with animationDelay).
export function PopIn({ delay = 0, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay: Math.min(delay, 600), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Big tick + text for "nothing to do" states (web .empty-state).
export function AllGood({ title, sub }) {
  return (
    <View style={st.okCard}>
      <View style={st.okCircle}><Text style={st.okTick}>✓</Text></View>
      <Text style={st.title}>{title}</Text>
      {!!sub && <Text style={[st.sub, { textAlign: 'center' }]}>{sub}</Text>}
    </View>
  );
}

export const st = StyleSheet.create({
  count: { minWidth: 22, paddingHorizontal: 6, height: 22, lineHeight: 22, borderRadius: 11, overflow: 'hidden', backgroundColor: C.bad, color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  line: { borderBottomWidth: 1, borderBottomColor: C.line },
  title: { fontSize: 15, fontWeight: '600', color: C.ink },
  sub: { fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: C.soft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.soft },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipText: { fontSize: 13, color: C.muted },
  chipTextOn: { color: C.accentDark, fontWeight: '600' },
  okCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 24, alignItems: 'center', gap: 6, marginBottom: 12 },
  okCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  okTick: { color: C.accentDark, fontSize: 24, fontWeight: '700' },
});
