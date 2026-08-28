import { TRPCError } from '@trpc/server';

/**
 * Statusfluss einer Bestellung — bewusst vorwärts-only und als reine Funktion
 * ausgelagert, damit er ohne DB testbar ist.
 *
 *   pending → ready → delivered
 *   pending → cancelled
 *
 * Ohne diese Regel kann ein Gerät mit veralteter Ansicht eine bereits
 * servierte Bestellung zurück auf „bereit" setzen (Küchen-Tablet pollt alle
 * 3 s) — sie taucht dann auf allen Service-Handys wieder in der Abholliste auf
 * und das Essen wird ein zweites Mal serviert.
 */

export type KasseOrderStatus = 'pending' | 'ready' | 'delivered' | 'cancelled';

const ALLOWED_TRANSITIONS: Record<KasseOrderStatus, KasseOrderStatus[]> = {
  pending: ['ready', 'cancelled'],
  ready: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function isAllowedTransition(
  from: KasseOrderStatus,
  to: KasseOrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

const STATUS_LABEL: Record<KasseOrderStatus, string> = {
  pending: 'in Arbeit',
  ready: 'bereit',
  delivered: 'serviert',
  cancelled: 'storniert',
};

/**
 * Wirft, wenn der Übergang nicht erlaubt ist. Gleicher Status auf gleichen
 * Status ist kein Fehler, sondern ein No-op: ein Handy, das nach einem
 * Netzunterbruch dieselbe Mutation nochmal schickt, soll keinen Fehler sehen.
 */
export function assertTransition(
  from: KasseOrderStatus,
  to: KasseOrderStatus,
): { changed: boolean } {
  if (from === to) return { changed: false };

  if (!isAllowedTransition(from, to)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Bestellung ist bereits ${STATUS_LABEL[from]} — Wechsel auf „${STATUS_LABEL[to]}" ist nicht möglich.`,
    });
  }

  return { changed: true };
}
