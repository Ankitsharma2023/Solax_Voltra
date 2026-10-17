import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useUnread } from '../../lib/messages';
import { AlarmIcon, MoreIcon } from '../Icons';
import { C } from '../../theme';

// Plant header (web src/components/Header.jsx): name, status, and the bell → Message centre (badge = unread messages).
export default function Header({ plant, status = 'Normal', sub, actions, onMore }) {
  const unread = useUnread();
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.h1} numberOfLines={1}>{plant.plantName}</Text>
        {!!status && <Text style={[s.badge, status === 'Alarm' ? s.badgeBad : status === 'Offline' ? s.badgeOff : null]}>{status}</Text>}
        {sub}
      </View>
      <View style={s.actions}>
        {actions ?? (
          <>
            <Pressable onPress={() => router.push('/messages')} hitSlop={8} accessibilityLabel={`Messages (${unread} unread)`} style={s.iconBtn}>
              <AlarmIcon size={28} color={C.ink} />
              {unread > 0 && <Text style={s.count}>{unread > 99 ? '99+' : unread}</Text>}
            </Pressable>
            {onMore && <Pressable onPress={onMore} hitSlop={8} accessibilityLabel="More" style={s.iconBtn}><MoreIcon size={28} color={C.ink} /></Pressable>}
          </>
        )}
      </View>
    </View>
  );
}

// Bottom sheet of actions (web Home's ⋯ menu).
export function Sheet({ visible, items, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grip} />
          {items.map((it) => (
            <Pressable key={it.label} onPress={() => { onClose(); it.onPress(); }} style={({ pressed }) => [s.item, pressed && { backgroundColor: C.soft }]}>
              <Text style={s.itemText}>{it.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={({ pressed }) => [s.item, pressed && { backgroundColor: C.soft }]}>
            <Text style={[s.itemText, { color: C.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  h1: { fontSize: 24, fontWeight: '700', color: C.ink },
  badge: { alignSelf: 'flex-start', marginTop: 4, fontSize: 14, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', backgroundColor: C.accentSoft, color: C.accentDark },
  badgeBad: { backgroundColor: C.badSoft, color: C.bad },
  badgeOff: { backgroundColor: C.soft, color: C.muted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  iconBtn: { padding: 4 },
  count: {
    position: 'absolute', top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, overflow: 'hidden',
    backgroundColor: C.bad, color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 18,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, paddingBottom: 28 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 8 },
  item: { paddingVertical: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line },
  itemText: { fontSize: 16, color: C.ink, fontWeight: '500' },
});
