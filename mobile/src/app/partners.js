import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, useApi } from '../lib/api';
import { useSession } from '../lib/session';
import { Page, Note, Empty } from '../components/ui';
import { PlusIcon } from '../components/Icons';
import { StatusBadge } from '../components/biz/PlantRow';
import { ROLE } from '../components/biz/admin';
import { C, card } from '../theme';
import { CopyText } from '../components/Pickers';

// Downstream channel partners (installers / sub-distributors) — the SolaX "superior channel partner" view.
// Web: src/screens/business/Partners.jsx.
export default function Partners() {
  const { user } = useSession();
  const res = useApi('/api/partners');
  const [msg, setMsg] = useState(null);
  const canAdd = user.role === 'distributor' || user.role === 'admin';
  const first = useRef(true);
  useFocusEffect(useCallback(() => { if (first.current) first.current = false; else res.reload(); }, [res.reload])); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (p, action) => {
    try {
      const r = await api(`/api/partners/${p.id}`, { method: 'POST', body: { action } });
      setMsg(r.tempPassword ? { pw: true, text: `${p.login} · temporary password: ${r.tempPassword}` } : { text: `${p.company}: ${action === 'approve' ? 'approved' : action === 'suspend' ? 'suspended' : 'done'} ✓` });
      res.reload();
    } catch (e) { setMsg({ err: true, text: e.message }); }
  };
  const act = (p, action, confirmText) => {
    if (!confirmText) return run(p, action);
    Alert.alert(confirmText, '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', style: action === 'suspend' ? 'destructive' : 'default', onPress: () => run(p, action) },
    ]);
  };

  const list = [...(res.data ?? [])].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || String(a.company).localeCompare(String(b.company)));
  return (
    <Page title="Partners" subtitle={res.data ? `${res.data.length} downstream · ${res.data.filter((p) => p.status === 'pending').length} waiting` : ''}
      onRefresh={res.reload}
      actions={canAdd && <Pressable onPress={() => router.push('/partner-new')} hitSlop={10} accessibilityLabel="Add partner"><PlusIcon size={26} color={C.ink} /></Pressable>}>
      {msg && <Note ok={!msg.err && !msg.pw} error={msg.err}>{msg.pw ? <CopyText value={msg.text} style={{ fontWeight: '700', color: C.ink }} /> : msg.text}</Note>}
      {res.error && !res.data ? <Empty error>{res.error.message}</Empty>
        : !res.data ? <Empty>Loading…</Empty>
        : !list.length ? (
          <View style={[card, { alignItems: 'center', gap: 6, padding: 24 }]}>
            <Text style={st.name}>No partners yet</Text>
            <Text style={[st.muted, { textAlign: 'center' }]}>Installers and distributors who sign up with your Organization Number appear here{canAdd ? ', or add them directly with +' : ''}.</Text>
          </View>
        ) : list.map((p) => (
          <View key={p.id} style={[card, { gap: 4 }]}>
            <View style={st.top}>
              <Text style={st.name} numberOfLines={1}>{p.company || p.login}</Text>
              <StatusBadge status={p.status === 'active' ? 'Normal' : p.status === 'pending' ? 'Alarm' : 'Offline'}
                label={p.status === 'active' ? ROLE[p.role] : p.status === 'pending' ? 'Pending' : 'Suspended'} />
            </View>
            <Text style={st.small} selectable>{[p.name, p.login, p.phone].filter(Boolean).join(' · ')}</Text>
            <Text style={st.small}>Org No. {p.orgNo} · {p.plantCount} plant{p.plantCount === 1 ? '' : 's'}{p.downstream ? ` · ${p.downstream} downstream` : ''} · under {p.parentCompany}</Text>
            <View style={st.actions}>
              {p.status !== 'active' && <Act title={p.status === 'pending' ? 'Approve' : 'Re-activate'} onPress={() => act(p, 'approve')} />}
              {p.status === 'active' && <Act danger title="Suspend" onPress={() => act(p, 'suspend', `Suspend ${p.company}? They will lose access to their plants.`)} />}
              <Act title="Reset password" onPress={() => act(p, 'reset', `Reset the password for ${p.login}?`)} />
            </View>
          </View>
        ))}
    </Page>
  );
}

function Act({ title, onPress, danger }) {
  return <Pressable onPress={onPress} hitSlop={8}><Text style={[st.act, danger && { color: C.bad }]}>{title}</Text></Pressable>;
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: C.ink, flexShrink: 1 },
  muted: { color: C.muted, fontSize: 13 },
  small: { color: C.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 8 },
  act: { color: C.accentDark, fontWeight: '600', fontSize: 14 },
});
