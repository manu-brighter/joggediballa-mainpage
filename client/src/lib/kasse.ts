/**
 * Kassensystem: geteilte Helfer für Service-, Küchen- und Verwaltungsseite.
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

/**
 * Wartezeit in Minuten. Die Sekunden kommen vom Server, wo MySQL sie per
 * TIMESTAMPDIFF gegen dieselbe Uhr rechnet, aus der `createdAt` stammt. Die
 * Uhr des Handys bleibt bewusst aussen vor. Weicht sie ab (oder liegt die
 * Zeitzone daneben), zeigte eine Rechnung gegen `Date.now()` sonst dauerhaft 0.
 */
export function waitMinutes(seconds: number | null | undefined): number {
  if (seconds == null) return 0;
  return Math.max(0, Math.floor(seconds / 60));
}

/** Wartezeit für die Anzeige: "7′" bis 59 Minuten, danach "1 h 05′". */
export function formatWait(seconds: number | null | undefined): string {
  if (seconds == null) return '–';
  const total = waitMinutes(seconds);
  if (total < 60) return `${total}′`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}′`;
}

/**
 * Farbstufe einer wartenden Bestellung. Bis 5 Minuten normal, danach
 * „dringend“, ab 10 Minuten „überfällig“. So sieht die Küche auf einen Blick, was
 * liegen geblieben ist.
 */
export function urgency(minutes: number): 'normal' | 'urgent' | 'overdue' {
  if (minutes >= 10) return 'overdue';
  if (minutes >= 5) return 'urgent';
  return 'normal';
}

/**
 * Kategorie-Label für Produkte ohne Kategorie. Küche, Bar und Service
 * gruppieren alle danach, darum hier einmal.
 */
export const CATEGORY_FALLBACK = 'Weiteres';

/** Anzuzeigendes Kategorie-Label ("Food", sonst „Weiteres“). */
export function categoryLabel(category: string | null | undefined): string {
  return category?.trim() || CATEGORY_FALLBACK;
}

/**
 * Vergleichsschlüssel einer Kategorie. Die Kategorie ist ein Freitextfeld in
 * der Verwaltung; „Food“ und „food“ sind dieselbe Station, sollen den Filter
 * einer Bar also nicht auseinanderreissen.
 */
export function categoryKey(category: string | null | undefined): string {
  return categoryLabel(category).toLocaleLowerCase('de-CH');
}

/**
 * Ob eine Position in die Ansicht einer Station gehört. Leere Auswahl heisst
 * „alles“: eine Station ohne eingestellten Filter soll nichts verpassen,
 * insbesondere nicht am ersten Event, bevor jemand den Filter gesetzt hat.
 */
export function matchesCategories(
  category: string | null | undefined,
  selectedKeys: string[],
): boolean {
  if (selectedKeys.length === 0) return true;
  return selectedKeys.includes(categoryKey(category));
}
