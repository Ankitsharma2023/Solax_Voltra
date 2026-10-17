import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../lib/session';
import { useDeviceCards } from '../../lib/devices';
import { Card, Empty, Loading, Page } from '../../components/ui';
import { DeviceArt } from '../../components/device/DeviceParts';
import { WifiIcon } from '../../components/Icons';
import { C } from '../../theme';

// Topology: dongle → inverter → battery, joined by a moving dashed line (web Topology in Device.jsx).
export default function Topology() {
  const { plant } = useSession();
  const { overview, cards } = useDeviceCards(plant.plantId);
  const find = (kind) => cards?.find((c) => c.kind === kind);
  const inv = find('inverter'), dongle = find('dongle'), bat = find('battery');
  return (
    <Page title="Topology" subtitle={plant.plantName} onRefresh={overview.reload}>
      {!cards ? (overview.error ? <Empty error>{overview.error.message}</Empty> : <Loading height={260} />) : (
        <Card>
          {dongle && <TopoNode card={dongle} />}
          {dongle && <TopoLink />}
          {inv && <TopoNode card={inv} />}
          {bat && <TopoLink />}
          {bat && <TopoNode card={bat} />}
        </Card>
      )}
    </Page>
  );
}

const TopoNode = ({ card }) => (
  <View style={st.node}>
    <DeviceArt kind={card.kind} />
    <View style={{ flex: 1 }}><Text style={st.name}>{card.name}</Text><Text style={st.sn}>{card.sn}</Text></View>
    <WifiIcon size={20} color={card.online ? C.accent : C.muted} />
  </View>
);

// 2px dashed teal line whose dashes flow downwards.
function TopoLink() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(t, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [t]);
  return (
    <View style={st.link}>
      <Animated.View style={{ transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
        {Array.from({ length: 5 }, (_, i) => <View key={i} style={st.dash} />)}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  node: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 },
  name: { fontSize: 15, fontWeight: '700', color: C.ink },
  sn: { fontSize: 12, color: C.muted },
  link: { width: 2, height: 26, marginLeft: 40, overflow: 'hidden' },
  dash: { width: 2, height: 4, marginBottom: 4, backgroundColor: C.accent },
});
