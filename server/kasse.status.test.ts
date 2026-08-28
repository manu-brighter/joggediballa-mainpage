/**
 * Der Statusfluss einer Bestellung ist vorwärts-only. Der teure Fall, den das
 * verhindert: das Küchen-Tablet zeigt (3-Sekunden-Poll) noch „in Arbeit“,
 * während der Service schon serviert hat. Ein Tipp auf „Bereit“ würde die
 * Bestellung sonst zurückholen und das Essen ginge ein zweites Mal raus.
 */
import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  assertTransition,
  isAllowedTransition,
  type KasseOrderStatus,
} from './kasse_status';

const ALL: KasseOrderStatus[] = ['pending', 'ready', 'delivered', 'cancelled'];

describe('isAllowedTransition', () => {
  it('erlaubt den regulären Weg pending → ready → delivered', () => {
    expect(isAllowedTransition('pending', 'ready')).toBe(true);
    expect(isAllowedTransition('ready', 'delivered')).toBe(true);
  });

  it('erlaubt Storno nur aus pending', () => {
    expect(isAllowedTransition('pending', 'cancelled')).toBe(true);
    expect(isAllowedTransition('ready', 'cancelled')).toBe(false);
    expect(isAllowedTransition('delivered', 'cancelled')).toBe(false);
  });

  it('lässt keine Rückwärtsschritte zu', () => {
    expect(isAllowedTransition('ready', 'pending')).toBe(false);
    expect(isAllowedTransition('delivered', 'ready')).toBe(false);
    expect(isAllowedTransition('delivered', 'pending')).toBe(false);
  });

  it('behandelt delivered und cancelled als Endzustände', () => {
    for (const to of ALL) {
      expect(isAllowedTransition('delivered', to)).toBe(false);
      expect(isAllowedTransition('cancelled', to)).toBe(false);
    }
  });
});

describe('assertTransition', () => {
  it('meldet den regulären Wechsel als Änderung', () => {
    expect(assertTransition('pending', 'ready')).toEqual({ changed: true });
    expect(assertTransition('ready', 'delivered')).toEqual({ changed: true });
  });

  it('ist idempotent: gleicher Status ist ein No-op, kein Fehler', () => {
    // Ein Handy, das nach einem Netzunterbruch dieselbe Mutation nochmal
    // schickt, soll keinen Fehler sehen.
    for (const status of ALL) {
      expect(assertTransition(status, status)).toEqual({ changed: false });
    }
  });

  it('wirft beim Rückholen einer servierten Bestellung', () => {
    expect(() => assertTransition('delivered', 'ready')).toThrow(TRPCError);
  });

  it('wirft beim Stornieren einer bereits fertigen Bestellung', () => {
    expect(() => assertTransition('ready', 'cancelled')).toThrow(
      /nicht möglich/,
    );
  });

  it('wirft bei jeder Änderung an einer stornierten Bestellung', () => {
    expect(() => assertTransition('cancelled', 'pending')).toThrow(TRPCError);
    expect(() => assertTransition('cancelled', 'ready')).toThrow(TRPCError);
  });

  it('nennt im Fehler den aktuellen Status', () => {
    expect(() => assertTransition('delivered', 'pending')).toThrow(
      /bereits serviert/,
    );
  });
});
