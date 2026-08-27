/**
 * Kassensystem — geteilte Helfer für Service-, Küchen- und Verwaltungsseite.
 *
 * Geld wird durchgehend als Integer in Rappen gehalten (nie Float), damit sich
 * beim Summieren keine Rundungsfehler einschleichen. Formatiert wird erst für
 * die Anzeige.
 */

export function formatChf(rappen: number): string {
  return `CHF ${(rappen / 100).toFixed(2)}`;
}

/** "12.50" / "12,50" / "12" → Rappen. Ungültige Eingaben ergeben null. */
export function parseChfToRappen(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Minuten seit Bestelleingang — Basis für die Farbeskalation in der Küche. */
export function minutesSince(date: Date | string, now: number): number {
  const ts = typeof date === 'string' ? Date.parse(date) : date.getTime();
  return Math.max(0, Math.floor((now - ts) / 60000));
}

/**
 * Farbstufe einer wartenden Bestellung. Bis 5 Minuten normal, danach
 * „dringend", ab 10 Minuten „überfällig" — die Küche sieht auf einen Blick,
 * was liegen geblieben ist.
 */
export function urgency(minutes: number): 'normal' | 'urgent' | 'overdue' {
  if (minutes >= 10) return 'overdue';
  if (minutes >= 5) return 'urgent';
  return 'normal';
}
