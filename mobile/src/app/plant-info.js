import { useSession } from '../lib/session';
import { Page, Card, KV, Empty } from '../components/ui';

// Plant information (web: PlantInfo in Me.jsx), opened from the "Plant" tile on Me.
export default function PlantInfo() {
  const { plant } = useSession();
  if (!plant) return <Page title="Plant information"><Empty>No plant selected.</Empty></Page>;
  const rows = [
    ['Plant name', plant.plantName], ['Plant ID', plant.plantId], ['PV capacity', `${plant.pvCapacity} kWp`],
    ['Battery capacity', `${plant.batteryCapacity} kWh`], ['Address', plant.plantAddress || '--'],
    ['Location', plant.latitude != null ? `${Number(plant.latitude).toFixed(4)}, ${Number(plant.longitude).toFixed(4)}` : '--'],
    ['Time zone', plant.plantTimeZone?.replace(/\).*/, ')')], ['Created', plant.createTime?.slice(0, 10)], ['Owner account', plant.loginName],
  ];
  return (
    <Page title="Plant information" subtitle={plant.plantName}>
      <Card style={{ paddingVertical: 8 }}><KV rows={rows} /></Card>
    </Page>
  );
}
