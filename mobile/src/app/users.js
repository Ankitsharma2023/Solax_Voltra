import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useApi } from '../lib/api';
import { Page, Empty } from '../components/ui';
import { ChevronIcon, PlusIcon } from '../components/Icons';
import { Chips, SearchIcon } from '../components/me/common';
import { StatusBadge } from '../components/biz/PlantRow';
import { ROLE } from '../components/biz/admin';
import { C, card } from '../theme';

// Admin: all accounts, pending approvals first (web: src/screens/business/Users.jsx).
export default function Users() {
  const users = useApi('/api/admin/users');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  // Coming back from an account page or "New account": show the changes.
  const first = useRef(true);
  useFocusEffect(useCallback(() => { if (first.current) first.current = false; else users.reload(); }, [users.reload])); // eslint-disable-line react-hooks/exhaustive-deps

  const list = (users.data ?? [])
    .filter((u) => role === 'all' || u.role === role)
    .filter((u) => !q || `${u.login} ${u.name} ${u.company}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || a.login.localeCompare(b.login));
  const pending = (users.data ?? []).filter((u) => u.status === 'pending').length;

  return (
    <Page title="Users & approvals" subtitle={users.data ? `${users.data.length} accounts${pending ? ` · ${pending} waiting` : ''}` : ''}
      onRefresh={users.reload}
      actions={<Pressable onPress={() => router.push('/user-new')} hitSlop={10} accessibilityLabel="New account"><PlusIcon size={26} color={C.ink} /></Pressable>}>
      <View style={st.search}>
        <SearchIcon size={18} color={C.muted} />
        <TextInput style={st.searchInput} placeholder="Search email, name or company" placeholderTextColor="#b3b9c0"
          value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" />
      </View>
      <Chips options={['all', 'customer', 'installer', 'distributor', 'admin'].map((r) => [r, r === 'all' ? 'All' : ROLE[r]])} value={role} onChange={setRole} />
      {users.error && !users.data ? <Empty error>{users.error.message}</Empty> : !users.data ? <Empty>Loading…</Empty>
        : !list.length ? <Empty>No accounts match.</Empty>
        : list.map((u) => (
          <Pressable key={u.id} onPress={() => router.push({ pathname: '/user-detail', params: { id: u.id } })}
            style={({ pressed }) => [card, st.row, pressed && { backgroundColor: C.soft }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.name} numberOfLines={1}>{u.company || u.name || u.login}</Text>
              <Text style={st.muted} numberOfLines={2}>{u.login} · {ROLE[u.role]} · {u.role === 'admin' ? 'all plants' : `${u.plantIds.length} plant${u.plantIds.length === 1 ? '' : 's'}`}</Text>
            </View>
            {u.status !== 'active' && <StatusBadge status={u.status === 'pending' ? 'Alarm' : 'Offline'} label={u.status === 'pending' ? 'Pending' : 'Suspended'} />}
            <ChevronIcon size={18} color={C.muted} />
          </Pressable>
        ))}
    </Page>
  );
}

const st = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.soft, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  name: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 2 },
  muted: { color: C.muted, fontSize: 13 },
});
