import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { Screen, SectionTitle, Empty } from '../../components/ui';
import { AllGood } from '../../components/me/common';
import { usePortfolio } from '../../components/biz/portfolio';
import { MessagesBell, NoPlants, PlantRow } from '../../components/biz/PlantRow';
import { Benefits, GenerationCard, GenerationStats, StatusCard } from '../../components/biz/OverviewCards';
import { C } from '../../theme';

// Status ring labels → Plants tab filter values.
const STATUS_FILTER = { Fault: 'Alarm', Connecting: 'No device' };

// Portfolio home for installers, distributors and Voltra admins (web: Overview in Business.jsx).
export default function Overview() {
  const { user } = useSession();
  const pf = usePortfolio();
  const s = pf.data?.summary;
  const attention = (pf.data?.plants ?? []).filter((p) => p.status !== 'Normal');
  const onStatus = (f) => router.push({ pathname: '/plants', params: { filter: STATUS_FILTER[f] || f, t: String(Date.now()) } });

  return (
    <Screen onRefresh={pf.reload}>
      <View style={st.head}>
        <Image source={require('../../../assets/voltra-logo.png')} style={st.logo} resizeMode="contain" accessibilityLabel="Voltra" />
        <MessagesBell />
      </View>
      <Text style={st.title}>Welcome to Voltra</Text>
      {pf.error && !s ? <Empty error>{pf.error.message}</Empty> : !s ? (
        <>
          <View style={[st.skeleton, { height: 160 }]} />
          <View style={[st.skeleton, { height: 230 }]} />
        </>
      ) : (
        <>
          <GenerationCard s={s} />
          <StatusCard s={s} onStatus={onStatus} />
          {s.plants > 0 && <GenerationStats />}
          {s.plants > 0 && <Benefits totalKwh={s.totalYield} />}
          <SectionTitle>Needs attention</SectionTitle>
          {attention.length === 0
            ? <AllGood title="All plants are running normally" />
            : attention.map((p, i) => <PlantRow key={p.plantId} p={p} delay={i * 40} />)}
          {s.plants === 0 && <NoPlants user={user} />}
        </>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  logo: { width: 118, height: 52 },
  title: { fontSize: 24, fontWeight: '700', color: C.ink, marginBottom: 14 },
  skeleton: { backgroundColor: C.soft, borderRadius: 18, marginBottom: 12 },
});
