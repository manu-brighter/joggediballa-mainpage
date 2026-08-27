import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from './db';
import {
  kasseOrderItems,
  kasseOrders,
  kasseProductOptions,
  kasseProducts,
  kasseSessions,
  kasseSettings,
  kasseTables,
  type InsertKasseOrder,
  type InsertKasseOrderItem,
  type InsertKasseProduct,
  type InsertKasseProductOption,
  type InsertKasseSettings,
  type InsertKasseTable,
  type KasseSettings,
} from '../drizzle/schema';

// ============================================
// SETTINGS (Single-Row, id=1)
// ============================================

/** Single-Row Settings; legt die Row mit frischem Token an, falls sie fehlt. */
export async function getKasseSettings(): Promise<KasseSettings> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const existing = await db
    .select()
    .from(kasseSettings)
    .where(eq(kasseSettings.id, 1))
    .limit(1);
  if (existing.length > 0) return existing[0];

  // Idempotent create — parallele First-Hits kollidieren auf dem Primary Key,
  // statt eine zweite Settings-Row anzulegen (Pattern: getSlideshowSettings).
  await db
    .insert(kasseSettings)
    .values({ id: 1, accessToken: nanoid(16) })
    .onDuplicateKeyUpdate({ set: { id: 1 } });

  const created = await db
    .select()
    .from(kasseSettings)
    .where(eq(kasseSettings.id, 1))
    .limit(1);
  return created[0];
}

export async function updateKasseSettings(
  patch: Partial<InsertKasseSettings>,
  updatedBy: number | null,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const settings = await getKasseSettings();
  await db
    .update(kasseSettings)
    .set({ ...patch, updatedBy })
    .where(eq(kasseSettings.id, settings.id));
}

// ============================================
// SESSIONS (Kassen-Events)
// ============================================

/** Die offene Session, oder null. Es ist immer höchstens eine offen. */
export async function getOpenKasseSession() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db
    .select()
    .from(kasseSessions)
    .where(eq(kasseSessions.status, 'open'))
    .orderBy(desc(kasseSessions.openedAt))
    .limit(1);
  return rows[0] || null;
}

export async function getKasseSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db
    .select()
    .from(kasseSessions)
    .where(eq(kasseSessions.id, sessionId))
    .limit(1);
  return rows[0] || null;
}

export async function listKasseSessions() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.select().from(kasseSessions).orderBy(desc(kasseSessions.openedAt));
}

/** Öffnet eine neue Session und schliesst dabei eine allenfalls offene. */
export async function createKasseSession(
  name: string,
  createdBy: number | null,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // B-P0-05: Schliessen und Anlegen in einer Transaktion, sonst kann ein
  // Fehler dazwischen die Invariante „höchstens eine offene Session" brechen
  // (gleiche Begründung wie bei sdkCreateSession).
  return db.transaction(async tx => {
    await tx
      .update(kasseSessions)
      .set({ status: 'closed', closedAt: new Date() })
      .where(eq(kasseSessions.status, 'open'));

    const result = await tx.insert(kasseSessions).values({ name, createdBy });
    return Number(result[0].insertId);
  });
}

export async function closeKasseSession(sessionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(kasseSessions)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(kasseSessions.id, sessionId));
}

export async function reopenKasseSession(sessionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // B-P0-05: siehe createKasseSession — schliessen und öffnen atomar.
  await db.transaction(async tx => {
    await tx
      .update(kasseSessions)
      .set({ status: 'closed', closedAt: new Date() })
      .where(eq(kasseSessions.status, 'open'));

    await tx
      .update(kasseSessions)
      .set({ status: 'open', closedAt: null })
      .where(eq(kasseSessions.id, sessionId));
  });
}

export async function deleteKasseSession(sessionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Orders + Items hängen per ON DELETE CASCADE dran.
  await db.delete(kasseSessions).where(eq(kasseSessions.id, sessionId));
}

// ============================================
// PRODUKTE + ZUSÄTZE
// ============================================

/** Alle Produkte (inkl. inaktiver) — für die Verwaltung. */
export async function listKasseProducts() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db
    .select()
    .from(kasseProducts)
    .orderBy(asc(kasseProducts.displayOrder), asc(kasseProducts.id));
}

export async function listKasseProductOptions(productIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (productIds && productIds.length === 0) return [];
  const rows = productIds
    ? await db
        .select()
        .from(kasseProductOptions)
        .where(inArray(kasseProductOptions.productId, productIds))
        .orderBy(
          asc(kasseProductOptions.displayOrder),
          asc(kasseProductOptions.id),
        )
    : await db
        .select()
        .from(kasseProductOptions)
        .orderBy(
          asc(kasseProductOptions.displayOrder),
          asc(kasseProductOptions.id),
        );
  return rows;
}

export async function createKasseProduct(
  data: InsertKasseProduct,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(kasseProducts).values(data);
  return Number(result[0].insertId);
}

export async function updateKasseProduct(
  productId: number,
  patch: Partial<InsertKasseProduct>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(kasseProducts)
    .set(patch)
    .where(eq(kasseProducts.id, productId));
}

/**
 * Hart löschen. Bestellpositionen verlieren nur die FK — `productName` und die
 * Preis-Snapshots bleiben, die Auswertung alter Events stimmt weiterhin.
 */
export async function deleteKasseProduct(productId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(kasseOrderItems)
    .set({ productId: null })
    .where(eq(kasseOrderItems.productId, productId));

  // Die Zusätze verschwinden per ON DELETE CASCADE mit dem Produkt — ihre FK in
  // den Bestellpositionen muss vorher weg, sonst blockt MySQL das Löschen.
  const options = await db
    .select({ id: kasseProductOptions.id })
    .from(kasseProductOptions)
    .where(eq(kasseProductOptions.productId, productId));
  if (options.length > 0) {
    await db
      .update(kasseOrderItems)
      .set({ optionId: null })
      .where(
        inArray(
          kasseOrderItems.optionId,
          options.map(o => o.id),
        ),
      );
  }

  await db.delete(kasseProducts).where(eq(kasseProducts.id, productId));
}

export async function createKasseProductOption(
  data: InsertKasseProductOption,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(kasseProductOptions).values(data);
  return Number(result[0].insertId);
}

export async function updateKasseProductOption(
  optionId: number,
  patch: Partial<InsertKasseProductOption>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(kasseProductOptions)
    .set(patch)
    .where(eq(kasseProductOptions.id, optionId));
}

/**
 * Zusätze werden hart gelöscht — Bestellpositionen halten `optionName` als
 * Snapshot, die History bleibt also lesbar.
 */
export async function deleteKasseProductOption(
  optionId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(kasseOrderItems)
    .set({ optionId: null })
    .where(eq(kasseOrderItems.optionId, optionId));
  await db
    .delete(kasseProductOptions)
    .where(eq(kasseProductOptions.id, optionId));
}

// ============================================
// TISCHE
// ============================================

export async function listKasseTables() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db
    .select()
    .from(kasseTables)
    .orderBy(asc(kasseTables.displayOrder), asc(kasseTables.name));
}

export async function createKasseTable(
  data: InsertKasseTable,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(kasseTables).values(data);
  return Number(result[0].insertId);
}

/** Mehrere Tische auf einmal (A1…A10). Bestehende Namen werden übersprungen. */
export async function createKasseTablesBulk(
  rows: InsertKasseTable[],
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  if (rows.length === 0) return 0;
  const existing = await db
    .select({ name: kasseTables.name })
    .from(kasseTables)
    .where(
      inArray(
        kasseTables.name,
        rows.map(r => r.name),
      ),
    );
  const taken = new Set(existing.map(e => e.name));
  const fresh = rows.filter(r => !taken.has(r.name));
  if (fresh.length === 0) return 0;
  await db.insert(kasseTables).values(fresh);
  return fresh.length;
}

export async function updateKasseTable(
  tableId: number,
  patch: Partial<InsertKasseTable>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(kasseTables).set(patch).where(eq(kasseTables.id, tableId));
}

export async function deleteKasseTable(tableId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // Bestellungen behalten `tableName` als Snapshot; die FK wird auf NULL gesetzt.
  await db
    .update(kasseOrders)
    .set({ tableId: null })
    .where(eq(kasseOrders.tableId, tableId));
  await db.delete(kasseTables).where(eq(kasseTables.id, tableId));
}

// ============================================
// BESTELLUNGEN
// ============================================

export type NewOrderItem = {
  productId: number;
  productName: string;
  optionId: number | null;
  optionName: string | null;
  quantity: number;
  unitPriceRappen: number;
  lineTotalRappen: number;
};

export async function createKasseOrder(
  order: InsertKasseOrder,
  items: NewOrderItem[],
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // B-P0-05: Kopf und Positionen in einer Transaktion — sonst kann eine
  // Bestellung mit Betrag, aber ohne Positionen zurückbleiben: die Küche sieht
  // eine leere Bestellung und die Auswertung zählt Umsatz ohne Produkte.
  return db.transaction(async tx => {
    const result = await tx.insert(kasseOrders).values(order);
    const orderId = Number(result[0].insertId);

    const rows: InsertKasseOrderItem[] = items.map(item => ({
      orderId,
      productId: item.productId,
      productName: item.productName,
      optionId: item.optionId,
      optionName: item.optionName,
      quantity: item.quantity,
      unitPriceRappen: item.unitPriceRappen,
      lineTotalRappen: item.lineTotalRappen,
    }));
    await tx.insert(kasseOrderItems).values(rows);

    return orderId;
  });
}

export async function getKasseOrder(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db
    .select()
    .from(kasseOrders)
    .where(eq(kasseOrders.id, orderId))
    .limit(1);
  return rows[0] || null;
}

/**
 * Bestellungen einer Session inkl. Positionen, älteste zuerst — die Küche
 * arbeitet von oben nach unten ab.
 */
export async function listKasseOrders(
  sessionId: number,
  statuses?: Array<'pending' | 'ready' | 'delivered' | 'cancelled'>,
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const where =
    statuses && statuses.length > 0
      ? and(
          eq(kasseOrders.sessionId, sessionId),
          inArray(kasseOrders.status, statuses),
        )
      : eq(kasseOrders.sessionId, sessionId);

  const orders = await db
    .select()
    .from(kasseOrders)
    .where(where)
    .orderBy(asc(kasseOrders.createdAt), asc(kasseOrders.id));

  if (orders.length === 0) return [];

  const items = await db
    .select()
    .from(kasseOrderItems)
    .where(
      inArray(
        kasseOrderItems.orderId,
        orders.map(o => o.id),
      ),
    )
    .orderBy(asc(kasseOrderItems.id));

  const byOrder = new Map<number, typeof items>();
  for (const item of items) {
    const list = byOrder.get(item.orderId);
    if (list) list.push(item);
    else byOrder.set(item.orderId, [item]);
  }

  return orders.map(order => ({
    ...order,
    items: byOrder.get(order.id) ?? [],
  }));
}

/** Wie viele Bestellungen einer Session noch offen sind (pending + ready). */
export async function countOpenKasseOrders(sessionId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(kasseOrders)
    .where(
      and(
        eq(kasseOrders.sessionId, sessionId),
        inArray(kasseOrders.status, ['pending', 'ready']),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Storniert alle noch offenen Bestellungen einer Session. Wird beim Schliessen
 * einer Kasse mit Restbestellungen gebraucht: sonst verschwinden sie
 * kommentarlos aus Küche und Service und zählen weiter zum Umsatz.
 */
export async function cancelOpenKasseOrders(
  sessionId: number,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const open = await countOpenKasseOrders(sessionId);
  if (open === 0) return 0;
  await db
    .update(kasseOrders)
    .set({ status: 'cancelled', cancelledAt: new Date() })
    .where(
      and(
        eq(kasseOrders.sessionId, sessionId),
        inArray(kasseOrders.status, ['pending', 'ready']),
      ),
    );
  return open;
}

export async function setKasseOrderStatus(
  orderId: number,
  status: 'pending' | 'ready' | 'delivered' | 'cancelled',
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const patch: Partial<InsertKasseOrder> = { status };
  if (status === 'ready') patch.readyAt = new Date();
  if (status === 'delivered') patch.deliveredAt = new Date();
  if (status === 'cancelled') patch.cancelledAt = new Date();

  await db.update(kasseOrders).set(patch).where(eq(kasseOrders.id, orderId));
}

// ============================================
// AUSWERTUNG / HISTORY
// ============================================

export type KasseSessionStats = {
  orderCount: number;
  cancelledCount: number;
  revenueRappen: number;
  products: Array<{
    productName: string;
    optionName: string | null;
    quantity: number;
    revenueRappen: number;
  }>;
};

/**
 * Umsatz und Stückzahlen einer Session. Stornierte Bestellungen zählen nicht
 * zum Umsatz, werden aber separat ausgewiesen.
 */
export async function getKasseSessionStats(
  sessionId: number,
): Promise<KasseSessionStats> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const totals = await db
    .select({
      status: kasseOrders.status,
      count: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(${kasseOrders.totalRappen}), 0)`,
    })
    .from(kasseOrders)
    .where(eq(kasseOrders.sessionId, sessionId))
    .groupBy(kasseOrders.status);

  let orderCount = 0;
  let cancelledCount = 0;
  let revenueRappen = 0;
  for (const row of totals) {
    const count = Number(row.count);
    if (row.status === 'cancelled') {
      cancelledCount += count;
      continue;
    }
    orderCount += count;
    revenueRappen += Number(row.revenue);
  }

  const products = await db
    .select({
      productName: kasseOrderItems.productName,
      optionName: kasseOrderItems.optionName,
      quantity: sql<number>`SUM(${kasseOrderItems.quantity})`,
      revenue: sql<number>`SUM(${kasseOrderItems.lineTotalRappen})`,
    })
    .from(kasseOrderItems)
    .innerJoin(kasseOrders, eq(kasseOrderItems.orderId, kasseOrders.id))
    .where(
      and(
        eq(kasseOrders.sessionId, sessionId),
        inArray(kasseOrders.status, ['pending', 'ready', 'delivered']),
      ),
    )
    .groupBy(kasseOrderItems.productName, kasseOrderItems.optionName)
    .orderBy(desc(sql`SUM(${kasseOrderItems.quantity})`));

  return {
    orderCount,
    cancelledCount,
    revenueRappen,
    products: products.map(p => ({
      productName: p.productName,
      optionName: p.optionName,
      quantity: Number(p.quantity),
      revenueRappen: Number(p.revenue),
    })),
  };
}
