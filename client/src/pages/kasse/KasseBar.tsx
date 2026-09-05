import { Martini } from 'lucide-react';
import KasseStation, { type StationConfig } from './KasseStation';

/**
 * Bar-Ansicht (Tablet). Identisch zur Küche, nur mit eigenem gespeichertem
 * Kategorienfilter: die Bar stellt z. B. „Drinks“ und „Shots“ ein, die Küche
 * „Food“.
 */
const BAR: StationConfig = {
  id: 'bar',
  title: 'Bar',
  seoTitle: 'Kassen-Bar',
  icon: Martini,
};

export default function KasseBar() {
  return <KasseStation station={BAR} />;
}
