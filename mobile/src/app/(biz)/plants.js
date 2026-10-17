import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../lib/session';
import { Empty } from '../../components/ui';
import { PlusIcon } from '../../components/Icons';
import { Chips, SearchIcon } from '../../components/me/common';
import { usePortfolio } from '../../components/biz/portfolio';
import { NoPlants, PlantRow } from '../../components/biz/PlantRow';
import { C } from '../../theme';

const FILTERS = ['All', 'Normal', 'Alarm', 'Offline', 'No device'].map((f) => [f, f === 'Alarm' ? 'Fault' : f]);
const rank = (s) => ({ Alarm: 0, Offline: 1, 'No device': 2, Normal: 3 }[s] ?? 4);

// Every plant the partner looks after (web: Plants in Business.jsx). The Overview status ring opens
// this tab with ?filter=…
export default function Plants() {
  const { user } = useSession();
  const pf = usePortfolio();
  const params = useLocalSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(params.filter || 'All');
  const [pulling, setPulling] = useState(false);
  useEffect(() => { if (params.filter) setFilter(String(params.filter)); }, [params.filter, params.t]);

  const list = useMemo(() => (pf.data?.plants ?? [])
    .filter((p) => filter === 'All' || p.status === filter)
    .filter((p) => !q || `${p.plantName} ${p.address} ${p.owner}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => rank(a.status) - rank(b.status) || a.plantName.localeCompare(b.plantName)), [pf.data, q, filter]);

  const refresh = async () => { setPulling(true); try { await pf.reload(); } finally { setPulling(false); } };

  const header = (
    <>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Text style={st.h1}>Plants</Text>
          <Text style={st.muted}>{pf.data ? `${pf.data.plants.length} total` : 'Loading…'}</Text>
        </View>
        <Pressable style={({ pressed }) => [st.create, pressed && { opacity: 0.7 }]} onPress={() => router.push('/plant-create')}>
          <PlusIcon size={18} color="#fff" /><Text style={st.createText}>Create new plant</Text>
        </Pressable>
      </View>
      <View style={st.search}>
        <SearchIcon size={18} color={C.muted} />
        <TextInput style={st.searchInput} placeholder="Search name, address or owner" placeholderTextColor="#b3b9c0"
          value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" />
      </View>
      <Chips options={FILTERS} value={filter} onChange={setFilter} />
    </>
  );

  const empty = pf.error && !pf.data ? <Empty error>{pf.error.message}</Empty>
    : !pf.data ? <View>{[0, 1, 2].map((i) => <View key={i} style={st.skeleton} />)}</View>
    : !pf.data.plants.length ? <NoPlants user={user} />
    : <Empty>No plants match.</Empty>;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={pf.data ? list : []}
        keyExtractor={(p) => String(p.plantId)}
        renderItem={({ item, index }) => <PlantRow p={item} delay={index < 15 ? index * 40 : 0} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={st.page}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} tintColor={C.accent} colors={[C.accent]} />}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '700', color: C.ink },
  muted: { color: C.muted, fontSize: 13 },
  create: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  createText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.soft, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 11 },
  skeleton: { height: 96, borderRadius: 18, marginBottom: 12, backgroundColor: C.soft },
});
