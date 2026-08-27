/**
 * Rate-Limiting für die token-gegateten Kassen-Mutationen.
 *
 * Liegt bewusst hier und nicht bei den Express-Limitern: per-Procedure-Limits
 * gehören laut `server/CLAUDE.md` in tRPC-Middleware, weil die tRPC-Batch-URLs
 * (`/api/trpc/a,b`) an Express-Route-Matchern vorbeilaufen. Der Express-Limiter
 * lässt Kassen-Mutationen darum nur durch — das eigentliche Budget wird hier
 * pro Procedure vergeben.
 *
 * Warum überhaupt ein eigenes Budget: am Event hängen alle Handys und das
 * Küchen-Tablet an derselben NAT-IP, und jede Bestellung kostet drei
 * Mutationen (anlegen → bereit → serviert). Das generelle 60/15min-Fenster
 * wäre nach Minuten dicht. Die Limits unten sind trotzdem knapp gehalten: wer
 * den per QR verteilten Token hat, soll die Küche nicht mit Müllbestellungen
 * fluten können.
 */

const WINDOW_MS = 15 * 60 * 1000;

/** Bestellungen legen Zeilen an — das engste Budget. */
export const CREATE_ORDER_LIMIT = 150;

/** Statuswechsel sind durch die Zahl bestehender Bestellungen gedeckelt. */
export const SET_STATUS_LIMIT = 400;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Zählt einen Treffer auf `key` und meldet, ob er noch im Budget liegt.
 * Fixed Window pro Key; `now` ist injizierbar, damit der Ablauf testbar bleibt.
 */
export function consume(
  key: string,
  limit: number,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    pruneExpired(now);
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/**
 * Hält die Map klein — ohne das wächst sie über die Laufzeit mit jeder je
 * gesehenen IP. Läuft nur beim Anlegen eines neuen Fensters, nicht auf jedem
 * Request.
 */
function pruneExpired(now: number): void {
  for (const [key, bucket] of Array.from(buckets.entries())) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Nur für Tests. */
export function resetRateLimit(): void {
  buckets.clear();
}
