import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ChevronIcon } from './Icons';
import { C, card } from '../theme';

// Shared building blocks for every screen — the phone versions of the web app's CSS classes
// (.card, .list-row, .data-tile, .segmented, .btn, Page with back arrow).

// Scrollable screen. `onRefresh` (async) adds pull-to-refresh.
export function Screen({ children, onRefresh, edges = ['top'], scroll = true, padded = true }) {
  const [pulling, setPulling] = useState(false);
  const refresh = onRefresh && (async () => { setPulling(true); try { await onRefresh(); } finally { setPulling(false); } });
  const body = scroll ? (
    <ScrollView contentContainerStyle={padded && s.page} keyboardShouldPersistTaps="handled"
      refreshControl={refresh && <RefreshControl refreshing={pulling} onRefresh={refresh} tintColor={C.accent} colors={[C.accent]} />}>
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1 }, padded && s.page]}>{children}</View>;
  return <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: C.bg }}>{body}</SafeAreaView>;
}

// Sub-page: back arrow + title (+ subtitle, right-side actions), like the web app's <Page>.
export function Page({ title, subtitle, actions, children, onRefresh, scroll = true }) {
  return (
    <Screen onRefresh={onRefresh} scroll={scroll} padded={false}>
      <View style={s.pageHead}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityLabel="Back" style={s.back}>
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="m15 6-6 6 6 6" /></Svg>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.pageTitle} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={s.muted} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {actions}
      </View>
      <View style={s.pageBody}>{children}</View>
    </Screen>
  );
}

export function Card({ children, style, title, right }) {
  return (
    <View style={[card, style]}>
      {(title || right) && (
        <View style={s.cardHead}>
          {!!title && <Text style={s.cardTitle}>{title}</Text>}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

// A card of tappable rows (web .card.list).
export function List({ children }) { return <View style={[card, { paddingVertical: 4, paddingHorizontal: 0 }]}>{children}</View>; }
export function ListRow({ icon, title, sub, right, onPress, last, danger }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, !last && s.rowLine, pressed && { backgroundColor: C.soft }]}>
      {icon && <View style={s.rowIcon}>{icon}</View>}
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, danger && { color: C.bad }]}>{title}</Text>
        {!!sub && <Text style={s.muted} numberOfLines={2}>{sub}</Text>}
      </View>
      {right}
      {onPress && <ChevronIcon size={20} color={C.muted} />}
    </Pressable>
  );
}

export function SectionTitle({ children, right }) {
  return <View style={s.section}><Text style={s.h2}>{children}</Text>{right}</View>;
}

// Grid of small label/value tiles (web .data-tiles).
export function Tiles({ items }) {
  return (
    <View style={s.tiles}>
      {items.map(([label, value, unit]) => (
        <View key={label} style={s.tile}>
          <Text style={s.muted} numberOfLines={1}>{label}</Text>
          <Text style={s.tileVal}>{value ?? '--'}{unit ? <Text style={s.small}> {unit}</Text> : null}</Text>
        </View>
      ))}
    </View>
  );
}

// Key/value table (web table.kv).
export function KV({ rows }) {
  return rows.filter(Boolean).map(([k, v], i) => (
    <View key={k} style={[s.kv, i < rows.length - 1 && s.rowLine]}>
      <Text style={s.kvKey}>{k}</Text><Text style={s.kvVal} selectable>{v ?? '--'}</Text>
    </View>
  ));
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const [id, label] = Array.isArray(o) ? o : [o, o];
        const on = id === value;
        return (
          <Pressable key={id} onPress={() => onChange(id)} style={[s.segBtn, on && s.segOn]}>
            <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({ title, onPress, busy, disabled, ghost, danger, style }) {
  return (
    <Pressable onPress={onPress} disabled={busy || disabled}
      style={({ pressed }) => [s.btn, ghost && s.btnGhost, danger && { backgroundColor: C.bad }, (pressed || disabled) && { opacity: 0.6 }, style]}>
      {busy ? <ActivityIndicator color={ghost ? C.ink : '#fff'} /> : <Text style={[s.btnText, ghost && { color: C.ink }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, required, children, hint }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.fieldLabel}>{label}{required && <Text style={{ color: C.bad }}> *</Text>}</Text>
      {children}
      {!!hint && <Text style={[s.small, { marginTop: 4 }]}>{hint}</Text>}
    </View>
  );
}
export function Input(props) {
  return <TextInput placeholderTextColor="#b3b9c0" {...props} style={[s.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, props.style]} />;
}

export function Badge({ status }) {
  const tone = status === 'Normal' ? [C.accentSoft, C.accentDark] : status === 'Alarm' || status === 'Fault' ? [C.badSoft, C.bad] : [C.soft, C.muted];
  return <Text style={[s.badge, { backgroundColor: tone[0], color: tone[1] }]}>{status}</Text>;
}

export function Empty({ children, error }) {
  return <Text style={[s.empty, error && { color: C.bad }]}>{children}</Text>;
}
export function Loading({ height = 160 }) { return <View style={[s.skeleton, { height }]} />; }
export function Note({ children, ok, error }) {
  return <Text style={[s.note, ok && { color: C.accentDark }, error && { color: C.bad }]}>{children}</Text>;
}

export const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: '#fff' },
  back: { padding: 4 },
  pageTitle: { fontSize: 18, fontWeight: '700', color: C.ink },
  pageBody: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 24, fontWeight: '700', color: C.ink },
  h2: { fontSize: 20, fontWeight: '700', color: C.ink },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  muted: { color: C.muted, fontSize: 13 },
  small: { color: C.muted, fontSize: 12 },
  text: { color: C.ink, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: C.ink, marginBottom: 2 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.5%', backgroundColor: C.soft, borderRadius: 12, padding: 12, gap: 2 },
  tileVal: { fontSize: 17, fontWeight: '700', color: C.ink, fontVariant: ['tabular-nums'] },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  kvKey: { color: C.muted, fontSize: 14, flexShrink: 0 },
  kvVal: { color: C.ink, fontSize: 14, flexShrink: 1, textAlign: 'right' },
  seg: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: 12, padding: 4, marginBottom: 12 },
  segBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: '#fff', shadowColor: '#111827', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 14, color: C.muted },
  segTextOn: { color: C.ink, fontWeight: '600' },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnGhost: { backgroundColor: C.soft },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 13, color: C.muted, marginBottom: 6 },
  input: { fontSize: 16, color: C.ink, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  badge: { alignSelf: 'flex-start', fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  empty: { color: C.muted, textAlign: 'center', marginVertical: 32, fontSize: 15 },
  skeleton: { backgroundColor: C.soft, borderRadius: 18, marginBottom: 12 },
  note: { color: C.ink2, fontSize: 14, lineHeight: 20, marginVertical: 8 },
});
