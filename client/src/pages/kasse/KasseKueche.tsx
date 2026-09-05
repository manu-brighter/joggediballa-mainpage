import { Utensils } from 'lucide-react';
import KasseStation, { type StationConfig } from './KasseStation';

/**
 * Küchen-Ansicht (Tablet). Küche und Bar sind dieselbe Ansicht auf
 * verschiedene Produktkategorien, die Logik steht darum einmal in
 * KasseStation; hier wird sie nur benannt.
 */
const KUECHE: StationConfig = {
  id: 'kueche',
  title: 'Küche',
  seoTitle: 'Kassen-Küche',
  icon: Utensils,
};

export default function KasseKueche() {
  return <KasseStation station={KUECHE} />;
}
