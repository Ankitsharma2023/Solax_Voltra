import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { markRead, refreshUnread } from '../lib/messages';
import { Card, Empty, Page, Segmented } from '../components/ui';
import { C, card } from '../theme';

// Message centre (web src/screens/Messages.jsx): alarms, automation actions and changes, grouped by day.
const TYPES = {
  alarm: { icon: '⚠️', group: 'alarms' },
  alarm_cleared: { icon: '✅', group: 'alarms' },
  automation: { icon: '⚙️', group: 'automation' },
  control: { icon: '🎛', group: 'changes' },
  partner: { icon: '🤝', group: 'changes' },
  share: { icon: '🔗', group: 'changes' },
  service: { icon: '🛠', group: 'changes' },
  system: { icon: 'ℹ️', group: 'changes' },
};
const TABS = [['all', 'All'], ['alarms', 'Alarms'], ['automation', 'Automation'], ['changes', 'Changes']];
// message.link → route (web: a sub-page or a tab of the plant app).
const LINKS = {
  alarms: '/alarms', history: '/control/history', partners: '/partners',
  home: '/', device: '/device', intelligence: '/intelligence', service: '/service', me: '/me',
};

export default function Messages() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('all');
  const load = () => refreshUnread().then((r) => r && setData(r));
  useEffect(() => { load(); }, []);

  async function markAll() {
    await markRead({ all: true }).catch(() => {});
    load();
  }
  function open(m) {
    if (!m.read) markRead({ ids: [m.id] }).then(load).catch(() => {});
    const to = LINKS[m.link];
    if (to) router.push(to);
  }

  const list = (data?.messages ?? []).filter((m) => tab === 'all' || TYPES[m.type]?.group === tab);
  const byDay = list.reduce((acc, m) => { const d = dayLabel(m.at); (acc[d] ??= []).push(m); return acc; }, {});
  return (
    <Page title="Messages" subtitle={data ? `${data.unread} unread` : ''} onRefresh={load}
      actions={data?.unread > 0 && <Pressable onPress={markAll} hitSlop={8}><Text style={s.textBtn}>Mark all read</Text></Pressable>}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {!data ? <Empty>Loading…</Empty>
        : !list.length ? (
          <Card style={s.emptyState}>
            <View style={s.okCircle}><Text style={s.okText}>✓</Text></View>
            <Text style={s.title}>No messages</Text>
            <Text style={[s.muted, { textAlign: 'center' }]}>Alarms, automation actions and changes to the inverter will appear here.</Text>
          </Card>
        ) : Object.entries(byDay).map(([day, items]) => (
          <View key={day}>
            <Text style={s.subHead}>{day}</Text>
            {items.map((m) => (
              <Pressable key={m.id} onPress={() => open(m)} style={({ pressed }) => [card, s.row, !m.read && s.unread, pressed && { opacity: 0.7 }]}>
                <Text style={s.icon}>{TYPES[m.type]?.icon ?? 'ℹ️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, !m.read && { color: C.ink }]}>{m.title}</Text>
                  {!!m.body && <Text style={s.muted}>{m.body}</Text>}
                </View>
                <Text style={s.time}>{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      <Text style={s.note}>Messages are kept for 90 days.</Text>
    </Page>
  );
}

function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, now)) return 'Today';
  if (same(d, new Date(now - 864e5))) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

const s = StyleSheet.create({
  textBtn: { color: C.accentDark, fontWeight: '600', fontSize: 14 },
  subHead: { fontSize: 13, fontWeight: '600', color: C.muted, marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  unread: { borderLeftWidth: 3, borderLeftColor: C.accent },
  icon: { fontSize: 20, lineHeight: 24 },
  title: { fontSize: 15, fontWeight: '600', color: C.ink2, marginBottom: 2 },
  muted: { color: C.muted, fontSize: 13 },
  time: { color: C.muted, fontSize: 12 },
  emptyState: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  okCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  okText: { color: C.accentDark, fontSize: 22, fontWeight: '700' },
  note: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8 },
});
