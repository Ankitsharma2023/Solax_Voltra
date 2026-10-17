import { useSession } from '../lib/session';
import { Page } from '../components/ui';
import StatsPanel from '../components/home/StatsPanel';

// Statistics page (web src/screens/Stats.jsx).
export default function Stats() {
  const { plant } = useSession();
  return <Page title="Statistics" subtitle={plant.plantName}><StatsPanel plant={plant} /></Page>;
}
