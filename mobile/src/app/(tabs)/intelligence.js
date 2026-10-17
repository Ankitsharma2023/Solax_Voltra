import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, s as ui } from '../../components/ui';
import { BoltIcon, ChartIcon, ChevronIcon, IntelIcon } from '../../components/Icons';
import { ExportIcon, HeatIcon, HistoryIcon, PulseIcon, RemoteIcon } from '../../components/control/icons';
import { useCaps } from '../../lib/control';
import { useSession } from '../../lib/session';
import { C, card } from '../../theme';

// Intelligence tab: same cards as the web app's Intelligence screen (src/screens/Intelligence.jsx).
const CARDS = [
  { Icon: PulseIcon, title: 'Live Data', sub: 'Every reading of every device, refreshed each minute', to: '/intel/live-data' },
  { Icon: BoltIcon, title: 'Work Mode', sub: 'Self Use · Feed-in Priority · Back Up · Manual', to: '/control/work-mode' },
  { Icon: ExportIcon, title: 'Export Limit', sub: 'Maximum power to the grid · zero export', to: '/control/export-limit' },
  { Icon: RemoteIcon, title: 'Remote Control', sub: 'Temporary charge / discharge / idle for a set time', to: '/control/remote-control' },
  { Icon: HeatIcon, title: 'Battery Heating', sub: 'Warm the battery in cold weather', to: '/control/battery-heating' },
  { Icon: ChartIcon, title: 'TOU - Time Of Use', sub: 'Plan modes by time of day', to: '/intel/tou' },
  { Icon: IntelIcon, title: 'Automation', sub: 'If this happens, then do that', to: '/intel/automation' },
  { Icon: HistoryIcon, title: 'Command History', sub: 'Every change sent to the inverter, with its result', to: '/control/history' },
];

export default function Intelligence() {
  const { plant } = useSession();
  const caps = useCaps(plant.plantId);
  return (
    <Screen onRefresh={caps.reload}>
      <Text style={[ui.h1, { marginBottom: 12 }]} numberOfLines={1}>{plant.plantName}</Text>
      <ControlBanner caps={caps.data} />
      {CARDS.map(({ Icon, title, sub, to }) => (
        <Pressable key={title} onPress={() => router.push(to)} style={({ pressed }) => [card, s.card, pressed && { backgroundColor: C.soft }]}>
          <View style={s.icon}><Icon color={C.accentDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={ui.rowTitle}>{title}</Text>
            <Text style={ui.muted}>{sub}</Text>
          </View>
          <ChevronIcon size={20} color={C.muted} />
        </Pressable>
      ))}
      <View style={[card, s.card, { opacity: 0.55 }]}>
        <View style={s.icon}><Text style={{ fontSize: 18, color: C.accentDark }}>✦</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={ui.rowTitle}>XSchedule</Text>
          <Text style={ui.muted}>AI energy manager. Needs the SolaX XHub device.</Text>
        </View>
      </View>
    </Screen>
  );
}

// Live control / view-only notice (web ControlBanner).
function ControlBanner({ caps }) {
  if (!caps) return null;
  if (caps.control) {
    return (
      <View style={[s.banner, s.live]}>
        <Text style={[s.bannerTitle, { color: C.accentDark }]}>● Live control</Text>
        <Text style={s.bannerText}>Changes here are sent to the inverter. Each one asks for confirmation and is logged in Command History.</Text>
      </View>
    );
  }
  return (
    <View style={s.banner}>
      <Text style={s.bannerTitle}>{caps.mayControl ? 'View-only mode' : 'View only'}</Text>
      <Text style={s.bannerText}>{caps.mayControl
        ? 'Inverter commands are not switched on yet. Settings are saved for this plant and can be sent once control is enabled.'
        : caps.viewOnly ? 'This system was shared with you as view only. Ask the owner for control access to change settings.' : 'Your account can see these settings but only the owner, their installer or Voltra can change them.'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  banner: { backgroundColor: C.soft, borderRadius: 14, padding: 14, marginBottom: 12, gap: 4 },
  live: { backgroundColor: C.accentSoft },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  bannerText: { fontSize: 13, color: C.ink2, lineHeight: 18 },
});
