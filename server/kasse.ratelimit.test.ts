/**
 * Das Kassen-Budget wird pro Procedure und IP vergeben (tRPC-Middleware, nicht
 * Express, siehe server/CLAUDE.md). Getestet wird der Zähler selbst: Grenze,
 * Trennung der Buckets und der Fensterwechsel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  consume,
  resetRateLimit,
  CREATE_ORDER_LIMIT,
  SET_STATUS_LIMIT,
} from './kasse_ratelimit';

const WINDOW_MS = 15 * 60 * 1000;

describe('kasse rate limit', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('lässt Treffer bis zur Grenze durch und blockt danach', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(consume('createOrder:1.2.3.4', 5, now)).toBe(true);
    }
    expect(consume('createOrder:1.2.3.4', 5, now)).toBe(false);
  });

  it('trennt die Buckets pro IP', () => {
    const now = 1_000_000;
    expect(consume('createOrder:1.2.3.4', 1, now)).toBe(true);
    expect(consume('createOrder:1.2.3.4', 1, now)).toBe(false);
    // Andere IP, eigenes Budget.
    expect(consume('createOrder:5.6.7.8', 1, now)).toBe(true);
  });

  it('trennt die Buckets pro Procedure', () => {
    const now = 1_000_000;
    expect(consume('createOrder:1.2.3.4', 1, now)).toBe(true);
    expect(consume('createOrder:1.2.3.4', 1, now)).toBe(false);
    // Statuswechsel haben ein eigenes, weiteres Budget.
    expect(consume('setOrderStatus:1.2.3.4', 1, now)).toBe(true);
  });

  it('öffnet nach Ablauf des Fensters wieder', () => {
    const now = 1_000_000;
    expect(consume('createOrder:1.2.3.4', 1, now)).toBe(true);
    expect(consume('createOrder:1.2.3.4', 1, now)).toBe(false);
    expect(consume('createOrder:1.2.3.4', 1, now + WINDOW_MS + 1)).toBe(true);
  });

  it('deckt einen realistischen Event-Peak ab', () => {
    // 200 Bestellungen/Stunde von einer NAT-IP sind ~50 pro 15-Minuten-Fenster,
    // dazu ~100 Statuswechsel (bereit + serviert). Beide Limits müssen das mit
    // Reserve tragen.
    const now = 1_000_000;
    for (let i = 0; i < 50; i++) {
      expect(consume('createOrder:1.2.3.4', CREATE_ORDER_LIMIT, now)).toBe(
        true,
      );
    }
    for (let i = 0; i < 100; i++) {
      expect(consume('setOrderStatus:1.2.3.4', SET_STATUS_LIMIT, now)).toBe(
        true,
      );
    }
  });
});
