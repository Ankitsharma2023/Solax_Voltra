import { Linking, Text } from 'react-native';
import { useApi } from '../lib/api';
import { modelName } from '../lib/format';
import { useSession } from '../lib/session';
import { COMPANY } from '../lib/company';
import { Button, Card, Empty, KV, Page, s } from '../components/ui';

// Warranty (web Service.jsx): the plant's devices, and a link to Voltra's warranty system when configured.
export default function Warranty() {
  const { plant } = useSession();
  const ov = useApi(`/api/plants/${plant.plantId}/overview`);
  return (
    <Page title="Warranty" subtitle={plant.plantName} onRefresh={ov.reload}>
      {!ov.data ? <Empty error={!!ov.error}>{ov.error ? ov.error.message : 'Loading…'}</Empty> : ov.data.devices.map((d) => (
        <Card key={d.deviceSn} title={modelName(d.deviceModel)}>
          <KV rows={[
            ['Serial number', d.deviceSn],
            ['Registration no.', d.registerNo],
            ['Installed at', plant.plantAddress || '--'],
            ['Commissioned', plant.createTime?.slice(0, 10)],
          ]} />
        </Card>
      ))}
      {COMPANY.warrantyUrl
        ? <Button title="Check warranty certificate" onPress={() => Linking.openURL(COMPANY.warrantyUrl)} />
        : <Text style={[s.small, { marginTop: 4 }]}>Warranty certificates come from Voltra's warranty system. Set EXPO_PUBLIC_WARRANTY_URL to link it here.</Text>}
    </Page>
  );
}
