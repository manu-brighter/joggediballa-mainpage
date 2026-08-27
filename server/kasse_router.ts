import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { router, publicProcedure, protectedProcedure } from './_core/trpc';
import { hasPermission } from './permissions';
import { createActivityLog } from './db';
import {
  closeKasseSession,
  createKasseOrder,
  createKasseProduct,
  createKasseProductOption,
  createKasseSession,
  createKasseTable,
  createKasseTablesBulk,
  deleteKasseProduct,
  deleteKasseProductOption,
  deleteKasseSession,
  deleteKasseTable,
  getKasseOrder,
  getKasseSession,
  getKasseSessionStats,
  getKasseSettings,
  getOpenKasseSession,
  listKasseOrders,
  listKasseProductOptions,
  listKasseProducts,
  listKasseSessions,
  listKasseTables,
  reopenKasseSession,
  setKasseOrderStatus,
  updateKasseProduct,
  updateKasseProductOption,
  updateKasseSettings,
  updateKasseTable,
} from './kasse_db';
import { buildOrderItems, orderTotalRappen } from './kasse_pricing';

/**
 * Local copy of the requirePermission middleware factory — same reasoning as
 * in attendance_router.ts (routers.ts imports this file, so importing back
 * would be circular).
 */
const requirePermission = (permissionKey: string) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    const allowed = await hasPermission(ctx.user.role, permissionKey);
    if (!allowed) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Forbidden' });
    }
    return next({ ctx });
  });

const manageKasse = requirePermission('manage_kasse');

/**
 * Service- und Küchen-Seite laufen ohne Login: das Personal am Event hat in der
 * Regel keinen Account. Zugang gated ein rotierbarer Token in der URL — gleiches
 * Konzept wie beim Diashow-Upload. Der Token ist damit das Geheimnis; er wird
 * per QR/Link verteilt und kann jederzeit rotiert werden.
 */
async function requireToken(token: string): Promise<void> {
  const settings = await getKasseSettings();
  if (token !== settings.accessToken) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Ungültiger Token' });
  }
}

/** Die aktuell offene Session, oder ein sprechender Fehler. */
async function requireOpenSession() {
  const session = await getOpenKasseSession();
  if (!session) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Keine offene Kassen-Session. Bitte im Kassen-Admin öffnen.',
    });
  }
  return session;
}

const orderItemInput = z.object({
  productId: z.number().int().positive(),
  optionId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).max(99),
});

const statusEnum = z.enum(['pending', 'ready', 'delivered', 'cancelled']);

export const kasseRouter = router({
  // ============================================
  // TOKEN-GATED (Service + Küche, ohne Login)
  // ============================================

  /** Token-Prüfung + Zustand für Service-/Küchenseite. */
  publicState: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const settings = await getKasseSettings();
      if (input.token !== settings.accessToken) {
        return {
          valid: false as const,
          ordersOpen: false,
          session: null as { id: number; name: string } | null,
        };
      }
      const session = await getOpenKasseSession();
      return {
        valid: true as const,
        ordersOpen: settings.ordersOpen,
        session: session ? { id: session.id, name: session.name } : null,
      };
    }),

  /** Speisekarte + Tische für die Bestellaufnahme (nur Aktives). */
  menu: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      await requireToken(input.token);

      const [products, tables] = await Promise.all([
        listKasseProducts(),
        listKasseTables(),
      ]);
      const active = products.filter(p => p.isActive);
      const options = await listKasseProductOptions(active.map(p => p.id));

      return {
        products: active.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          priceRappen: p.priceRappen,
          options: options
            .filter(o => o.productId === p.id && o.isActive)
            .map(o => ({
              id: o.id,
              name: o.name,
              priceDeltaRappen: o.priceDeltaRappen,
            })),
        })),
        tables: tables
          .filter(t => t.isActive)
          .map(t => ({ id: t.id, name: t.name, area: t.area })),
      };
    }),

  /** Offene Bestellungen der laufenden Session, älteste zuerst. */
  listOpenOrders: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      await requireToken(input.token);
      const session = await getOpenKasseSession();
      if (!session) return [];
      return listKasseOrders(session.id, ['pending', 'ready']);
    }),

  /** Bereits ausgelieferte Bestellungen der laufenden Session (Kontrolle). */
  listDeliveredOrders: publicProcedure
    .input(
      z.object({
        token: z.string(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ input }) => {
      await requireToken(input.token);
      const session = await getOpenKasseSession();
      if (!session) return [];
      const orders = await listKasseOrders(session.id, ['delivered']);
      return orders.slice(-input.limit).reverse();
    }),

  /**
   * Bestellung aufnehmen. Preise kommen ausschliesslich aus der DB — der Client
   * schickt nur Produkt-, Options- und Mengenangaben.
   */
  createOrder: publicProcedure
    .input(
      z.object({
        token: z.string(),
        tableId: z.number().int().positive(),
        waiterName: z.string().trim().max(60).optional(),
        note: z.string().trim().max(255).optional(),
        items: z.array(orderItemInput).min(1).max(40),
      }),
    )
    .mutation(async ({ input }) => {
      await requireToken(input.token);

      const settings = await getKasseSettings();
      if (!settings.ordersOpen) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Bestellungen sind aktuell geschlossen.',
        });
      }
      const session = await requireOpenSession();

      const tables = await listKasseTables();
      const table = tables.find(t => t.id === input.tableId && t.isActive);
      if (!table) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unbekannter Tisch',
        });
      }

      const products = await listKasseProducts();
      const productIds = Array.from(new Set(input.items.map(i => i.productId)));
      const options = await listKasseProductOptions(productIds);

      const items = buildOrderItems(products, options, input.items);
      const totalRappen = orderTotalRappen(items);

      const orderId = await createKasseOrder(
        {
          sessionId: session.id,
          tableId: table.id,
          tableName: table.name,
          totalRappen,
          note: input.note || null,
          waiterName: input.waiterName || null,
        },
        items,
      );

      return { orderId, totalRappen };
    }),

  /** Küche: fertig. Service: abgeschlossen. Storno nur solange pending. */
  setOrderStatus: publicProcedure
    .input(
      z.object({
        token: z.string(),
        orderId: z.number().int().positive(),
        status: statusEnum,
      }),
    )
    .mutation(async ({ input }) => {
      await requireToken(input.token);

      const order = await getKasseOrder(input.orderId);
      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bestellung nicht gefunden',
        });
      }
      if (order.status === input.status) return { success: true };
      if (order.status === 'cancelled') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Stornierte Bestellungen lassen sich nicht mehr ändern.',
        });
      }
      if (input.status === 'cancelled' && order.status !== 'pending') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Nur offene Bestellungen können storniert werden.',
        });
      }

      await setKasseOrderStatus(input.orderId, input.status);
      return { success: true };
    }),

  // ============================================
  // VERWALTUNG (manage_kasse)
  // ============================================

  getSettings: manageKasse.query(async () => {
    const [settings, session, sessions] = await Promise.all([
      getKasseSettings(),
      getOpenKasseSession(),
      listKasseSessions(),
    ]);
    return {
      accessToken: settings.accessToken,
      ordersOpen: settings.ordersOpen,
      openSession: session,
      sessions,
    };
  }),

  updateSettings: manageKasse
    .input(z.object({ ordersOpen: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await updateKasseSettings(input, ctx.user.id);
      await createActivityLog({
        userId: ctx.user.id,
        userName: ctx.user.name || 'Unknown',
        action: 'kasse_settings',
        details: `ordersOpen=${input.ordersOpen}`,
        ipAddress: null,
        userAgent: null,
      });
      return { success: true };
    }),

  rotateToken: manageKasse.mutation(async ({ ctx }) => {
    const accessToken = nanoid(16);
    await updateKasseSettings({ accessToken }, ctx.user.id);
    await createActivityLog({
      userId: ctx.user.id,
      userName: ctx.user.name || 'Unknown',
      action: 'kasse_rotate_token',
      details: 'Rotated kasse access token',
      ipAddress: null,
      userAgent: null,
    });
    return { accessToken };
  }),

  // ---- Sessions ----

  openSession: manageKasse
    .input(z.object({ name: z.string().trim().min(1).max(150) }))
    .mutation(async ({ input, ctx }) => {
      const id = await createKasseSession(input.name, ctx.user.id);
      await createActivityLog({
        userId: ctx.user.id,
        userName: ctx.user.name || 'Unknown',
        action: 'kasse_session_open',
        details: `Opened session "${input.name}" (#${id})`,
        ipAddress: null,
        userAgent: null,
      });
      return { id };
    }),

  closeSession: manageKasse
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getKasseSession(input.sessionId);
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      await closeKasseSession(input.sessionId);
      await createActivityLog({
        userId: ctx.user.id,
        userName: ctx.user.name || 'Unknown',
        action: 'kasse_session_close',
        details: `Closed session "${session.name}" (#${session.id})`,
        ipAddress: null,
        userAgent: null,
      });
      return { success: true };
    }),

  reopenSession: manageKasse
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getKasseSession(input.sessionId);
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      await reopenKasseSession(input.sessionId);
      await createActivityLog({
        userId: ctx.user.id,
        userName: ctx.user.name || 'Unknown',
        action: 'kasse_session_reopen',
        details: `Reopened session "${session.name}" (#${session.id})`,
        ipAddress: null,
        userAgent: null,
      });
      return { success: true };
    }),

  deleteSession: manageKasse
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getKasseSession(input.sessionId);
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      await deleteKasseSession(input.sessionId);
      await createActivityLog({
        userId: ctx.user.id,
        userName: ctx.user.name || 'Unknown',
        action: 'kasse_session_delete',
        details: `Deleted session "${session.name}" (#${session.id}) incl. orders`,
        ipAddress: null,
        userAgent: null,
      });
      return { success: true };
    }),

  // ---- Produkte + Zusätze ----

  listProducts: manageKasse.query(async () => {
    const products = await listKasseProducts();
    const options = await listKasseProductOptions(products.map(p => p.id));
    return products.map(p => ({
      ...p,
      options: options.filter(o => o.productId === p.id),
    }));
  }),

  createProduct: manageKasse
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        category: z.string().trim().max(50).nullable().optional(),
        priceRappen: z.number().int().min(0).max(1000000),
        displayOrder: z.number().int().min(0).max(9999).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const id = await createKasseProduct({
        name: input.name,
        category: input.category || null,
        priceRappen: input.priceRappen,
        displayOrder: input.displayOrder ?? 0,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

  updateProduct: manageKasse
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(100).optional(),
        category: z.string().trim().max(50).nullable().optional(),
        priceRappen: z.number().int().min(0).max(1000000).optional(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await updateKasseProduct(id, patch);
      return { success: true };
    }),

  deleteProduct: manageKasse
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteKasseProduct(input.id);
      return { success: true };
    }),

  createOption: manageKasse
    .input(
      z.object({
        productId: z.number().int().positive(),
        name: z.string().trim().min(1).max(100),
        priceDeltaRappen: z.number().int().min(-100000).max(100000).optional(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await createKasseProductOption({
        productId: input.productId,
        name: input.name,
        priceDeltaRappen: input.priceDeltaRappen ?? 0,
        displayOrder: input.displayOrder ?? 0,
      });
      return { id };
    }),

  updateOption: manageKasse
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(100).optional(),
        priceDeltaRappen: z.number().int().min(-100000).max(100000).optional(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await updateKasseProductOption(id, patch);
      return { success: true };
    }),

  deleteOption: manageKasse
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteKasseProductOption(input.id);
      return { success: true };
    }),

  // ---- Tische ----

  listTables: manageKasse.query(async () => listKasseTables()),

  createTable: manageKasse
    .input(
      z.object({
        name: z.string().trim().min(1).max(20),
        area: z.string().trim().max(10).nullable().optional(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await createKasseTable({
        name: input.name,
        area: input.area || null,
        displayOrder: input.displayOrder ?? 0,
      });
      return { id };
    }),

  /** A1…A10 in einem Rutsch. Bereits existierende Namen werden übersprungen. */
  createTableRange: manageKasse
    .input(
      z.object({
        area: z.string().trim().min(1).max(10),
        from: z.number().int().min(1).max(999),
        to: z.number().int().min(1).max(999),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.to < input.from) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '„Bis" muss grösser oder gleich „von" sein.',
        });
      }
      const rows = [];
      for (let n = input.from; n <= input.to; n++) {
        rows.push({
          name: `${input.area}${n}`,
          area: input.area,
          displayOrder: n,
        });
      }
      const created = await createKasseTablesBulk(rows);
      return { created };
    }),

  updateTable: manageKasse
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(20).optional(),
        area: z.string().trim().max(10).nullable().optional(),
        displayOrder: z.number().int().min(0).max(9999).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await updateKasseTable(id, patch);
      return { success: true };
    }),

  deleteTable: manageKasse
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteKasseTable(input.id);
      return { success: true };
    }),

  // ---- Auswertung ----

  sessionStats: manageKasse
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const session = await getKasseSession(input.sessionId);
      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }
      const stats = await getKasseSessionStats(input.sessionId);
      return { session, ...stats };
    }),

  sessionOrders: manageKasse
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ input }) => listKasseOrders(input.sessionId)),
});
