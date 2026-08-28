import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from './db';
import {
  kasseOrderItemOptions,
  kasseOrderItems,
  kasseOrders,
  kasseProductOptions,
  kasseProducts,
  kasseSessions,
  kasseSettings,
  kasseTables,
  type InsertKasseOrder,
  type InsertKasseOrderItem,
  type InsertKasseOrderItemOption,
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

  // Idempotent create, parallele First-Hits kollidieren auf dem Primary Key,
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
  // Fehler dazwischen die Invariante „höchstens eine offene Session“ brechen
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

/**
 * Offene Bestellungen stornieren und die Session schliessen, in einer
 * Transaktion und unter Sperre der Session-Zeile.
 *
 * Zwei getrennte Statements liessen eine Lücke: eine Bestellung, die zwischen
 * Storno und Schliessen eintrifft, hat ihre `requireOpenSession`-Prüfung
 * vorher bestanden, bleibt danach aber als `pending` in einer geschlossenen
 * Session liegen, unsichtbar in Küche und Service, aber im Umsatz. Das
 * `FOR UPDATE` serialisiert sie gegen das Schliessen: entweder ist sie vorher
 * da und wird mitstorniert, oder createKasseOrder sieht die geschlossene
 * Session und lehnt ab.
 */
export async function closeKasseSessionSettling(
  sessionId: number,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  return db.transaction(async tx => {
    await tx
      .select({ id: kasseSessions.id })
      .from(kasseSessions)
      .where(eq(kasseSessions.id, sessionId))
      .for('update');

    const stillOpen = and(
      eq(kasseOrders.sessionId, sessionId),
      inArray(kasseOrders.status, ['pending', 'ready']),
    );

    const open = await tx
      .select({ id: kasseOrders.id })
      .from(kasseOrders)
      .where(stillOpen);

    if (open.length > 0) {
      await tx
        .update(kasseOrders)
        .set({ status: 'cancelled', cancelledAt: sql`NOW()` })
        .where(stillOpen);
    }

    await tx
      .update(kasseSessions)
      .set({ status: 'closed', closedAt: sql`NOW()` })
      .where(eq(kasseSessions.id, sessionId));

    return open.length;
  });
}

export async function reopenKasseSession(sessionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // B-P0-05: siehe createKasseSession, schliessen und öffnen atomar.
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

/** Alle Produkte inklusive inaktiver, für die Verwaltung. */
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
 * Hart löschen. Bestellpositionen verlieren nur die FK. `productName` und die
 * Preis-Snapshots bleiben, die Auswertung alter Events stimmt weiterhin.
 */
export async function deleteKasseProduct(productId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(kasseOrderItems)
    .set({ productId: null })
    .where(eq(kasseOrderItems.productId, productId));

  // Die Zusätze verschwinden per ON DELETE CASCADE mit dem Produkt, ihre FK in
  // den gewählten Zusätzen muss vorher weg, sonst blockt MySQL das Löschen.
  const options = await db
    .select({ id: kasseProductOptions.id })
    .from(kasseProductOptions)
    .where(eq(kasseProductOptions.productId, productId));
  if (options.length > 0) {
    await db
      .update(kasseOrderItemOptions)
      .set({ optionId: null })
      .where(
        inArray(
          kasseOrderItemOptions.optionId,
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
 * Zusätze werden hart gelöscht. Bestellpositionen halten `optionName` als
 * Snapshot, die History bleibt also lesbar.
 */
export async function deleteKasseProductOption(
  optionId: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(kasseOrderItemOptions)
    .set({ optionId: null })
    .where(eq(kasseOrderItemOptions.optionId, optionId));
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
  const tables = await db.select().from(kasseTables);

  // Natürlich sortieren statt nach displayOrder: bei Bereichsanlage bekommen
  // A1, B1, A2, B2 ihre Reihenfolge in der Anlagereihenfolge, was in der
  // Verwaltung durcheinander aussieht. `numeric` sorgt ausserdem dafür, dass
  // A10 nach A2 kommt und nicht dazwischen.
  return tables.sort((a, b) =>
    a.name.localeCompare(b.name, 'de-CH', { numeric: true }),
  );
}

/**
 * `kasse_tables.name` ist UNIQUE. Ohne Vorprüfung wird aus einem doppelten
 * Namen ein ER_DUP_ENTRY und daraus ein INTERNAL_SERVER_ERROR-Toast; die
 * Bereichsanlage filtert vorhandene Namen längst weg (createKasseTablesBulk).
 */
export async function createKasseTable(
  data: InsertKasseTable,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const existing = await db
    .select({ id: kasseTables.id })
    .from(kasseTables)
    .where(eq(kasseTables.name, data.name))
    .limit(1);
  if (existing.length > 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Tisch \u201E${data.name}\u201C gibt es schon.`,
    });
  }

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

export type NewOrderItemOption = {
  optionId: number;
  optionName: string;
  priceDeltaRappen: number;
};

export type NewOrderItem = {
  productId: number;
  productName: string;
  quantity: number;
  unitPriceRappen: number;
  lineTotalRappen: number;
  options: NewOrderItemOption[];
};

export async function createKasseOrder(
  order: InsertKasseOrder,
  items: NewOrderItem[],
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // B-P0-05: Kopf und Positionen in einer Transaktion, sonst kann eine
  // Bestellung mit Betrag, aber ohne Positionen zurückbleiben: die Küche sieht
  // eine leere Bestellung und die Auswertung zählt Umsatz ohne Produkte.
  return db.transaction(async tx => {
    // Session unter Sperre gegenprüfen: die Prüfung im Router lief vor dieser
    // Transaktion, dazwischen kann die Kasse geschlossen worden sein. Ohne das
    // landet die Bestellung als `pending` in einer geschlossenen Session,
    // unsichtbar in Küche und Service, aber im Umsatz.
    const target = await tx
      .select({ status: kasseSessions.status })
      .from(kasseSessions)
      .where(eq(kasseSessions.id, order.sessionId))
      .for('update');

    if (target[0]?.status !== 'open') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Die Kasse wurde gerade geschlossen, Bestellung nicht erfasst.',
      });
    }

    const result = await tx.insert(kasseOrders).values(order);
    const orderId = Number(result[0].insertId);

    // Positionen einzeln, weil wir die insertId jeder Position brauchen, um
    // die gewählten Zusätze daranzuhängen. Eine Bestellung hat eine Handvoll
    // Positionen, das kostet nichts und bleibt in derselben Transaktion.
    for (const item of items) {
      const row: InsertKasseOrderItem = {
        orderId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPriceRappen: item.unitPriceRappen,
        lineTotalRappen: item.lineTotalRappen,
      };
      const inserted = await tx.insert(kasseOrderItems).values(row);
      const orderItemId = Number(inserted[0].insertId);

      if (item.options.length > 0) {
        const optionRows: InsertKasseOrderItemOption[] = item.options.map(
          option => ({
            orderItemId,
            optionId: option.optionId,
            optionName: option.optionName,
            priceDeltaRappen: option.priceDeltaRappen,
          }),
        );
        await tx.insert(kasseOrderItemOptions).values(optionRows);
      }
    }

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
 * Bestellungen einer Session inkl. Positionen, älteste zuerst, die Küche
 * arbeitet von oben nach unten ab.
 */
export async function listKasseOrders(
  sessionId: number,
  statuses?: Array<'pending' | 'ready' | 'delivered' | 'cancelled'>,
  opts?: { limit?: number; newestFirst?: boolean },
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

  // Die Wartezeit rechnet MySQL, nicht der Client: `createdAt` kommt aus
  // `DEFAULT (now())` der Datenbank, `Date.now()` aus der Uhr des Handys. Weichen
  // die Zeitzonen voneinander ab, liegt der Zeitstempel in der Zukunft und die
  // Wartezeit klebt auf 0. TIMESTAMPDIFF vergleicht beide Werte innerhalb
  // derselben Uhr und ist damit unabhängig von Gerät und Zeitzone.
  const orders = await db
    .select({
      ...getTableColumns(kasseOrders),
      waitSeconds: sql<number>`TIMESTAMPDIFF(SECOND, ${kasseOrders.createdAt}, NOW())`,
      readySeconds: sql<
        number | null
      >`TIMESTAMPDIFF(SECOND, ${kasseOrders.createdAt}, ${kasseOrders.readyAt})`,
      deliveredSeconds: sql<
        number | null
      >`TIMESTAMPDIFF(SECOND, ${kasseOrders.createdAt}, ${kasseOrders.deliveredAt})`,
    })
    .from(kasseOrders)
    .where(where)
    .orderBy(
      ...(opts?.newestFirst
        ? [desc(kasseOrders.createdAt), desc(kasseOrders.id)]
        : [asc(kasseOrders.createdAt), asc(kasseOrders.id)]),
    )
    .limit(opts?.limit ?? Number.MAX_SAFE_INTEGER);

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

  const chosenOptions =
    items.length > 0
      ? await db
          .select()
          .from(kasseOrderItemOptions)
          .where(
            inArray(
              kasseOrderItemOptions.orderItemId,
              items.map(i => i.id),
            ),
          )
          .orderBy(asc(kasseOrderItemOptions.id))
      : [];

  const optionsByItem = new Map<number, typeof chosenOptions>();
  for (const option of chosenOptions) {
    const list = optionsByItem.get(option.orderItemId);
    if (list) list.push(option);
    else optionsByItem.set(option.orderItemId, [option]);
  }

  const itemsWithOptions = items.map(item => ({
    ...item,
    options: optionsByItem.get(item.id) ?? [],
  }));

  const byOrder = new Map<number, typeof itemsWithOptions>();
  for (const item of itemsWithOptions) {
    const list = byOrder.get(item.orderId);
    if (list) list.push(item);
    else byOrder.set(item.orderId, [item]);
  }

  return orders.map(order => ({
    ...order,
    waitSeconds: Number(order.waitSeconds ?? 0),
    readySeconds:
      order.readySeconds == null ? null : Number(order.readySeconds),
    deliveredSeconds:
      order.deliveredSeconds == null ? null : Number(order.deliveredSeconds),
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

  // NOW() statt `new Date()`: `createdAt` setzt MySQL selbst per DEFAULT. Käme
  // der zweite Zeitstempel aus der Node-Uhr, wären die beiden bei
  // abweichender Zeitzone nicht vergleichbar und die Wartezeit-Auswertung
  // rechnete Unsinn.
  const stamped =
    status === 'ready'
      ? { readyAt: sql`NOW()` }
      : status === 'delivered'
        ? { deliveredAt: sql`NOW()` }
        : status === 'cancelled'
          ? { cancelledAt: sql`NOW()` }
          : {};

  await db
    .update(kasseOrders)
    .set({ status, ...stamped })
    .where(eq(kasseOrders.id, orderId));
}

// ============================================
// AUSWERTUNG / HISTORY
// ============================================

export type KasseSessionStats = {
  orderCount: number;
  cancelledCount: number;
  revenueRappen: number;
  /** Schnitt Bestellung → „bereit“, in Sekunden. Null, solange nichts fertig ist. */
  avgReadySeconds: number | null;
  /** Schnitt Bestellung → „serviert“, in Sekunden. */
  avgDeliveredSeconds: number | null;
  products: Array<{
    productName: string;
    quantity: number;
    revenueRappen: number;
  }>;
  /** Verbrauch pro Zusatz, unabhängig vom Produkt, für den Einkauf. */
  options: Array<{
    optionName: string;
    quantity: number;
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
    .groupBy(kasseOrderItems.productName)
    .orderBy(desc(sql`SUM(${kasseOrderItems.quantity})`));

  // Zusätze separat: eine Position kann mehrere haben, und für den Einkauf
  // zählt „wie viel Mayo ist weg“, nicht die Kombination.
  const options = await db
    .select({
      optionName: kasseOrderItemOptions.optionName,
      quantity: sql<number>`SUM(${kasseOrderItems.quantity})`,
    })
    .from(kasseOrderItemOptions)
    .innerJoin(
      kasseOrderItems,
      eq(kasseOrderItemOptions.orderItemId, kasseOrderItems.id),
    )
    .innerJoin(kasseOrders, eq(kasseOrderItems.orderId, kasseOrders.id))
    .where(
      and(
        eq(kasseOrders.sessionId, sessionId),
        inArray(kasseOrders.status, ['pending', 'ready', 'delivered']),
      ),
    )
    .groupBy(kasseOrderItemOptions.optionName)
    .orderBy(desc(sql`SUM(${kasseOrderItems.quantity})`));

  // Wartezeiten rechnet MySQL, aus demselben Grund wie in listKasseOrders:
  // beide Zeitstempel stammen aus der DB-Uhr, ein Vergleich mit der Node-Uhr
  // wäre bei abweichender Zeitzone falsch. Stornierte zählen nicht mit.
  const durations = await db
    .select({
      avgReady: sql<
        number | null
      >`AVG(TIMESTAMPDIFF(SECOND, ${kasseOrders.createdAt}, ${kasseOrders.readyAt}))`,
      avgDelivered: sql<
        number | null
      >`AVG(TIMESTAMPDIFF(SECOND, ${kasseOrders.createdAt}, ${kasseOrders.deliveredAt}))`,
    })
    .from(kasseOrders)
    .where(
      and(
        eq(kasseOrders.sessionId, sessionId),
        inArray(kasseOrders.status, ['ready', 'delivered']),
      ),
    );

  const avgReady = durations[0]?.avgReady;
  const avgDelivered = durations[0]?.avgDelivered;

  return {
    orderCount,
    cancelledCount,
    revenueRappen,
    avgReadySeconds: avgReady == null ? null : Math.round(Number(avgReady)),
    avgDeliveredSeconds:
      avgDelivered == null ? null : Math.round(Number(avgDelivered)),
    products: products.map(p => ({
      productName: p.productName,
      quantity: Number(p.quantity),
      revenueRappen: Number(p.revenue),
    })),
    options: options.map(o => ({
      optionName: o.optionName,
      quantity: Number(o.quantity),
    })),
  };
}
