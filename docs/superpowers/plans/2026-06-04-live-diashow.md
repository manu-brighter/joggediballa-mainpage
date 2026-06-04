# Live-Diashow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine versteckte, token-geschützte Live-Foto-Diashow (Beamer), eine mobile Gäste-Upload-Seite (QR-Ziel) und ein maintainer-only Control-Panel (Moderation, Album, Toggles).

**Architecture:** React-Pages (Wouter, lazy) + tRPC-Namespace `slideshow` + eine öffentliche Express-Upload-Route. Realtime via React-Query-Polling mit `photoVersion`-Counter (kein WebSocket). Self-hosted Disk-Storage + `sharp`-Kompression. Moderation default AN, ein aktives Event, nur Fotos, keine Originale.

**Tech Stack:** TypeScript, React 19, Wouter, tRPC v11, Drizzle (MySQL), `sharp`, `multer`, `express-rate-limit`, `browser-image-compression` (neu), `qrcode.react` (neu), `framer-motion` (vorhanden).

**Spec:** `docs/superpowers/specs/2026-06-04-live-diashow-design.md`

**Branch:** `feat/live-diashow` (bereits angelegt).

---

## File Structure

**Neu:**
- `client/src/pages/diashow/Diashow.tsx` — Fullscreen-Slideshow.
- `client/src/pages/diashow/DiashowUpload.tsx` — Mobile Gäste-Upload.
- `client/src/pages/diashow/DiashowControl.tsx` — Maintainer-Control.
- `client/src/lib/slideshow-layout.ts` — Reine Layout-Engine (Slides bauen).
- `server/slideshow.test.ts` — Vitest (createCaller).

**Geändert:**
- `drizzle/schema.ts` — Tabellen `slideshowPhotos`, `slideshowSettings`.
- `server/db.ts` — Helper für beide Tabellen.
- `server/permissions.ts` — Permission-Key `manage_slideshow`.
- `server/routers.ts` — tRPC-Namespace `slideshow`.
- `server/uploadRoutes.ts` — öffentliche Route `/slideshow-photo`.
- `client/src/App.tsx` — Routen + Bare-Route-Refactor + lazy Pages.
- `client/src/pages/admin/Dashboard.tsx` — `manage_slideshow` in Permission-Matrix.
- `package.json` — zwei neue Client-Deps.

---

## Phase 0 — Setup

### Task 0: Dependencies installieren

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Deps installieren**

```bash
pnpm add browser-image-compression qrcode.react
```

- [ ] **Step 2: Typecheck (Sanity)**

Run: `pnpm check`
Expected: PASS (keine neuen Fehler durch die Deps).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add browser-image-compression + qrcode.react for live slideshow"
```

---

## Phase 1 — Datenmodell & DB

### Task 1: Schema — `slideshowPhotos` + `slideshowSettings`

**Files:**
- Modify: `drizzle/schema.ts` (ans Ende anfügen, vor evtl. abschließenden Exports)

- [ ] **Step 1: Tabellen + Typen ergänzen**

`drizzle/schema.ts` — am Dateiende anhängen. `int`, `varchar`, `text`, `timestamp`, `boolean`, `mysqlEnum`, `mysqlTable`, `index` sind bereits importiert.

```typescript
/**
 * Live-Diashow — hochgeladene Gäste-Fotos (eigenes Konzept, NICHT `photos`).
 * Nur komprimierte Varianten (kein Original). Ablehnen = Files + Row hart löschen.
 */
export const slideshowPhotos = mysqlTable(
  'slideshow_photos',
  {
    id: int('id').autoincrement().primaryKey(),
    status: mysqlEnum('status', ['pending', 'approved'])
      .default('pending')
      .notNull(),
    displayUrl: text('displayUrl').notNull(), // 2560px-Variante (Bühne)
    displayKey: text('displayKey').notNull(),
    thumbnailUrl: text('thumbnailUrl').notNull(), // 480px-Variante (Grids)
    thumbnailKey: text('thumbnailKey').notNull(),
    width: int('width').notNull(), // Display-Dimensionen (Layout-Engine)
    height: int('height').notNull(),
    bytes: int('bytes').notNull(), // Dateigröße Display-Variant (Speicher-Tracking)
    moderatedBy: int('moderatedBy').references(() => users.id),
    moderatedAt: timestamp('moderatedAt'),
    uploaderIp: varchar('uploaderIp', { length: 45 }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  table => ({
    statusCreatedIdx: index('idx_slideshow_photos_status_createdAt').on(
      table.status,
      table.createdAt,
    ),
  }),
);

export type SlideshowPhoto = typeof slideshowPhotos.$inferSelect;
export type InsertSlideshowPhoto = typeof slideshowPhotos.$inferInsert;

/**
 * Live-Diashow — Single-Row Settings/State (id=1, Pattern wie sdkSession).
 */
export const slideshowSettings = mysqlTable('slideshow_settings', {
  id: int('id').autoincrement().primaryKey(),
  eventTitle: varchar('eventTitle', { length: 255 }),
  isVisible: boolean('isVisible').default(false).notNull(), // Master-Schalter Anzeige
  uploadsOpen: boolean('uploadsOpen').default(true).notNull(),
  moderationEnabled: boolean('moderationEnabled').default(true).notNull(),
  showQr: boolean('showQr').default(true).notNull(),
  uploadToken: varchar('uploadToken', { length: 64 }).notNull(), // Geheim-Token
  slideDurationMs: int('slideDurationMs').default(6000).notNull(),
  transition: mysqlEnum('transition', ['fade', 'kenburns'])
    .default('kenburns')
    .notNull(),
  photoVersion: int('photoVersion').default(0).notNull(), // Bump → Client-Refetch
  maxPhotos: int('maxPhotos').default(3000).notNull(), // Disk-Schutz
  uploadRateLimit: int('uploadRateLimit').default(80).notNull(), // Uploads/IP/10min
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  updatedBy: int('updatedBy').references(() => users.id),
});

export type SlideshowSettings = typeof slideshowSettings.$inferSelect;
export type InsertSlideshowSettings = typeof slideshowSettings.$inferInsert;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Schema auf die DB pushen**

Run: `pnpm db:push`
Expected: Drizzle legt `slideshow_photos` + `slideshow_settings` an. (Bei manueller DB-Pflege: SQL-Äquivalent ausführen. Server-CLAUDE.md: live-DB vor Queries verifizieren.)

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts
git commit -m "feat: add slideshow_photos + slideshow_settings schema"
```

---

### Task 2: DB-Helper in `server/db.ts`

**Files:**
- Modify: `server/db.ts` (Imports erweitern; Helper-Block am Ende anhängen)

- [ ] **Step 1: Imports erweitern**

In `server/db.ts` den Schema-Import um die neuen Symbole erweitern und `nanoid` importieren. Die bestehende Import-Liste aus `'../drizzle/schema'` um diese Zeilen ergänzen:

```typescript
  slideshowPhotos,
  slideshowSettings,
  SlideshowSettings,
  InsertSlideshowPhoto,
  InsertSlideshowSettings,
```

Und nach den bestehenden Top-Imports (z.B. unter `import { ENV } from './_core/env';`) ergänzen:

```typescript
import { nanoid } from 'nanoid';
```

- [ ] **Step 2: Helper anhängen**

Am Ende von `server/db.ts` anfügen:

```typescript
// ============================================
// LIVE-DIASHOW (SLIDESHOW)
// ============================================

/** Single-Row Settings; legt die Row mit frischem Token an, falls sie fehlt. */
export async function getSlideshowSettings(): Promise<SlideshowSettings> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const rows = await db
    .select()
    .from(slideshowSettings)
    .orderBy(slideshowSettings.id)
    .limit(1);
  if (rows.length > 0) return rows[0];
  await db.insert(slideshowSettings).values({ uploadToken: nanoid(16) });
  const created = await db
    .select()
    .from(slideshowSettings)
    .orderBy(slideshowSettings.id)
    .limit(1);
  return created[0];
}

export async function updateSlideshowSettings(
  patch: Partial<InsertSlideshowSettings>,
  updatedBy: number | null,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const settings = await getSlideshowSettings();
  await db
    .update(slideshowSettings)
    .set({ ...patch, updatedBy })
    .where(eq(slideshowSettings.id, settings.id));
}

export async function bumpPhotoVersion(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const settings = await getSlideshowSettings();
  await db
    .update(slideshowSettings)
    .set({ photoVersion: settings.photoVersion + 1 })
    .where(eq(slideshowSettings.id, settings.id));
}

export async function createSlideshowPhoto(
  data: InsertSlideshowPhoto,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(slideshowPhotos).values(data);
  return Number(result[0].insertId);
}

export async function listApprovedSlideshowPhotos() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slideshowPhotos)
    .where(eq(slideshowPhotos.status, 'approved'))
    .orderBy(slideshowPhotos.createdAt);
}

export async function listPendingSlideshowPhotos() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slideshowPhotos)
    .where(eq(slideshowPhotos.status, 'pending'))
    .orderBy(slideshowPhotos.createdAt);
}

export async function listAllSlideshowPhotos() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slideshowPhotos)
    .orderBy(desc(slideshowPhotos.createdAt));
}

export async function getSlideshowPhotoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(slideshowPhotos)
    .where(eq(slideshowPhotos.id, id))
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function approveSlideshowPhoto(
  id: number,
  moderatedBy: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(slideshowPhotos)
    .set({ status: 'approved', moderatedBy, moderatedAt: new Date() })
    .where(eq(slideshowPhotos.id, id));
}

export async function approveAllPendingSlideshowPhotos(
  moderatedBy: number,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(slideshowPhotos)
    .set({ status: 'approved', moderatedBy, moderatedAt: new Date() })
    .where(eq(slideshowPhotos.status, 'pending'));
}

/** Löscht Row, gibt die Storage-Keys zum Unlink zurück. */
export async function deleteSlideshowPhoto(
  id: number,
): Promise<{ displayKey: string; thumbnailKey: string } | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const photo = await getSlideshowPhotoById(id);
  if (!photo) return undefined;
  await db.delete(slideshowPhotos).where(eq(slideshowPhotos.id, id));
  return { displayKey: photo.displayKey, thumbnailKey: photo.thumbnailKey };
}

/** Löscht alle Rows, gibt alle Storage-Keys zum Unlink zurück. */
export async function clearAllSlideshowPhotos(): Promise<
  Array<{ displayKey: string; thumbnailKey: string }>
> {
  const db = await getDb();
  if (!db) return [];
  const all = await db
    .select({
      displayKey: slideshowPhotos.displayKey,
      thumbnailKey: slideshowPhotos.thumbnailKey,
    })
    .from(slideshowPhotos);
  await db.delete(slideshowPhotos);
  return all;
}

export async function getSlideshowStats(): Promise<{
  pending: number;
  approved: number;
  totalBytes: number;
}> {
  const db = await getDb();
  if (!db) return { pending: 0, approved: 0, totalBytes: 0 };
  const rows = await db
    .select({ status: slideshowPhotos.status, bytes: slideshowPhotos.bytes })
    .from(slideshowPhotos);
  let pending = 0;
  let approved = 0;
  let totalBytes = 0;
  for (const r of rows) {
    if (r.status === 'approved') approved++;
    else pending++;
    totalBytes += r.bytes;
  }
  return { pending, approved, totalBytes };
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/db.ts
git commit -m "feat: add slideshow db helpers"
```

---

### Task 3: Permission-Key `manage_slideshow`

**Files:**
- Modify: `server/permissions.ts` (PERMISSION_KEYS)
- Modify: `server/db.ts` (`initializeDefaultPermissions` defaultPermissions-Array)
- Modify: `client/src/pages/admin/Dashboard.tsx` (PERMISSIONS-Array)

- [ ] **Step 1: PERMISSION_KEYS erweitern**

In `server/permissions.ts`, das `PERMISSION_KEYS`-Tuple um den Key ergänzen (vor der schließenden `]`):

```typescript
  'manage_attendance',
  'manage_slideshow',
] as const;
```

- [ ] **Step 2: Fresh-Install-Seed ergänzen**

In `server/db.ts`, im `defaultPermissions`-Array in `initializeDefaultPermissions` ergänzen (nach `manage_attendance`):

```typescript
    { permissionKey: 'manage_attendance', roles: ['admin', 'maintainer'] },
    { permissionKey: 'manage_slideshow', roles: ['admin', 'maintainer'] },
  ];
```

- [ ] **Step 3: Dashboard-Permission-Matrix ergänzen**

In `client/src/pages/admin/Dashboard.tsx`: zuerst sicherstellen, dass ein passendes Icon importiert ist (Lucide). Falls `Projector` noch nicht importiert ist, zur bestehenden `lucide-react`-Import-Zeile hinzufügen. Dann im `PERMISSIONS`-Array (ca. Zeile 71) einen Eintrag ergänzen — exakt im Stil der bestehenden Einträge:

```typescript
  {
    key: 'manage_slideshow',
    label: 'Live-Diashow verwalten',
    icon: Projector,
    description: 'Moderation, Album & Anzeige der Event-Diashow steuern',
  },
```

(Falls die bestehenden Einträge kein `description`-Feld haben, dieses weglassen — exakt an die vorhandene Objektform anpassen.)

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/permissions.ts server/db.ts client/src/pages/admin/Dashboard.tsx
git commit -m "feat: add manage_slideshow permission key"
```

> **Deploy-Hinweis (nicht Teil der Tasks):** Auf der bestehenden Prod-DB wird der Key NICHT automatisch geseedet (`initializeDefaultPermissions` läuft nur bei leerer Tabelle). Nach Deploy einmalig im Admin-Dashboard → Berechtigungen für `admin` + `maintainer` aktivieren. SQL-Alternative:
> ```sql
> INSERT INTO role_permissions (permissionKey, role) VALUES
>   ('manage_slideshow','admin'), ('manage_slideshow','maintainer');
> ```

---

## Phase 2 — tRPC-Router (TDD)

> Server-Tests nutzen `appRouter.createCaller(ctx)` mit echter lokaler DB (kein Mock — Projekt-Konvention). In CI ohne DB sind diese Tests **erwartet rot**; lokal mit laufender dev-DB grün. Dev-DB muss laufen (`pnpm dev` / dev-docker).

### Task 4: Router-Skeleton + `publicState` + `listApproved` (TDD)

**Files:**
- Modify: `server/routers.ts` (Imports, neuer `slideshow`-Namespace in `appRouter`)
- Test: `server/slideshow.test.ts`

- [ ] **Step 1: Failing Test schreiben**

`server/slideshow.test.ts` neu anlegen:

```typescript
import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import * as db from './db';

function ctx(role: 'admin' | 'maintainer' | 'editor' | 'visitor' | null): TrpcContext {
  const user =
    role === null
      ? null
      : ({
          id: 1,
          openId: 'x',
          name: 'Test',
          displayName: null,
          email: 't@example.com',
          loginMethod: 'google',
          role,
          profilePictureUrl: null,
          profilePictureKey: null,
          memberSince: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as TrpcContext['user']);
  return {
    user,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: () => {} } as unknown as TrpcContext['res'],
  };
}

describe('slideshow.publicState', () => {
  it('returns valid:false for a wrong token', async () => {
    const caller = appRouter.createCaller(ctx(null));
    const state = await caller.slideshow.publicState({ token: 'definitely-wrong' });
    expect(state.valid).toBe(false);
  });

  it('returns valid:true for the correct token', async () => {
    const settings = await db.getSlideshowSettings();
    const caller = appRouter.createCaller(ctx(null));
    const state = await caller.slideshow.publicState({ token: settings.uploadToken });
    expect(state.valid).toBe(true);
    expect(typeof state.photoVersion).toBe('number');
  });

  it('listApproved returns [] for a wrong token', async () => {
    const caller = appRouter.createCaller(ctx(null));
    const list = await caller.slideshow.listApproved({ token: 'nope' });
    expect(list).toEqual([]);
  });
});
```

- [ ] **Step 2: Test ausführen → muss fehlschlagen**

Run: `pnpm test server/slideshow.test.ts`
Expected: FAIL (`caller.slideshow` ist undefined — Namespace existiert noch nicht).

- [ ] **Step 3: Router implementieren**

In `server/routers.ts` die Top-Imports erweitern:

```typescript
import { nanoid } from 'nanoid';
import { storageDelete } from './storage';
```

Dann innerhalb des `router({ ... })` von `appRouter` einen neuen Namespace ergänzen (z.B. nach `attendance: attendanceRouter,`):

```typescript
  slideshow: router({
    // ---- Public (Token-validiert) ----
    publicState: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const s = await db.getSlideshowSettings();
        if (input.token !== s.uploadToken) {
          return {
            valid: false as const,
            isVisible: false,
            showQr: false,
            moderationEnabled: true,
            uploadsOpen: false,
            eventTitle: null as string | null,
            slideDurationMs: 6000,
            transition: 'kenburns' as 'fade' | 'kenburns',
            photoVersion: 0,
            approvedCount: 0,
          };
        }
        const stats = await db.getSlideshowStats();
        return {
          valid: true as const,
          isVisible: s.isVisible,
          showQr: s.showQr,
          moderationEnabled: s.moderationEnabled,
          uploadsOpen: s.uploadsOpen,
          eventTitle: s.eventTitle,
          slideDurationMs: s.slideDurationMs,
          transition: s.transition,
          photoVersion: s.photoVersion,
          approvedCount: stats.approved,
        };
      }),
    listApproved: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const s = await db.getSlideshowSettings();
        if (input.token !== s.uploadToken) return [];
        const photos = await db.listApprovedSlideshowPhotos();
        return photos.map(p => ({
          id: p.id,
          displayUrl: p.displayUrl,
          width: p.width,
          height: p.height,
          createdAt: p.createdAt,
        }));
      }),
  }),
```

- [ ] **Step 4: Test ausführen → muss grün sein**

Run: `pnpm test server/slideshow.test.ts`
Expected: PASS (dev-DB läuft).

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts server/slideshow.test.ts
git commit -m "feat: add slideshow public tRPC procedures (publicState, listApproved)"
```

---

### Task 5: Maintainer-Procedures — Settings + Listen (TDD)

**Files:**
- Modify: `server/routers.ts` (`slideshow`-Namespace erweitern)
- Test: `server/slideshow.test.ts`

- [ ] **Step 1: Failing Tests ergänzen**

In `server/slideshow.test.ts` anhängen:

```typescript
describe('slideshow maintainer access', () => {
  it('getSettings is forbidden for editor', async () => {
    const caller = appRouter.createCaller(ctx('editor'));
    await expect(caller.slideshow.getSettings()).rejects.toThrow();
  });

  it('getSettings is forbidden for visitor/anonymous', async () => {
    const caller = appRouter.createCaller(ctx(null));
    await expect(caller.slideshow.getSettings()).rejects.toThrow();
  });

  it('updateSettings persists eventTitle for maintainer', async () => {
    const caller = appRouter.createCaller(ctx('maintainer'));
    await caller.slideshow.updateSettings({ eventTitle: 'Jogge di Balla 2026' });
    const s = await caller.slideshow.getSettings();
    expect(s.eventTitle).toBe('Jogge di Balla 2026');
  });

  it('rotateToken changes the token', async () => {
    const caller = appRouter.createCaller(ctx('admin'));
    const before = (await caller.slideshow.getSettings()).uploadToken;
    const { token } = await caller.slideshow.rotateToken();
    expect(token).not.toBe(before);
  });
});
```

> Hinweis: `manage_slideshow` muss in der lokalen dev-DB für `admin`+`maintainer` existieren (Task 3 Deploy-Hinweis / SQL-Snippet einmal lokal ausführen), sonst schlagen diese Tests mit FORBIDDEN fehl.

- [ ] **Step 2: Test ausführen → muss fehlschlagen**

Run: `pnpm test server/slideshow.test.ts`
Expected: FAIL (`getSettings`/`updateSettings`/`rotateToken` existieren nicht).

- [ ] **Step 3: Procedures implementieren**

Im `slideshow`-Namespace (nach `listApproved`) ergänzen:

```typescript
    // ---- Maintainer+ (requirePermission) ----
    getSettings: requirePermission('manage_slideshow').query(async () => {
      const s = await db.getSlideshowSettings();
      const stats = await db.getSlideshowStats();
      return {
        ...s,
        pendingCount: stats.pending,
        approvedCount: stats.approved,
        totalBytes: stats.totalBytes,
      };
    }),
    listPending: requirePermission('manage_slideshow').query(async () => {
      return db.listPendingSlideshowPhotos();
    }),
    listAll: requirePermission('manage_slideshow').query(async () => {
      return db.listAllSlideshowPhotos();
    }),
    updateSettings: requirePermission('manage_slideshow')
      .input(
        z.object({
          isVisible: z.boolean().optional(),
          uploadsOpen: z.boolean().optional(),
          moderationEnabled: z.boolean().optional(),
          showQr: z.boolean().optional(),
          eventTitle: z.string().max(255).nullable().optional(),
          slideDurationMs: z.number().int().min(2000).max(60000).optional(),
          transition: z.enum(['fade', 'kenburns']).optional(),
          maxPhotos: z.number().int().min(1).max(100000).optional(),
          uploadRateLimit: z.number().int().min(1).max(100000).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateSlideshowSettings(input, ctx.user.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_settings',
          details: `Updated: ${Object.keys(input).join(', ')}`,
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      }),
    rotateToken: requirePermission('manage_slideshow').mutation(
      async ({ ctx }) => {
        const token = nanoid(16);
        await db.updateSlideshowSettings({ uploadToken: token }, ctx.user.id);
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_rotate_token',
          details: 'Rotated upload token',
          ipAddress: null,
          userAgent: null,
        });
        return { token };
      },
    ),
```

- [ ] **Step 4: Test ausführen → grün**

Run: `pnpm test server/slideshow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts server/slideshow.test.ts
git commit -m "feat: add slideshow settings/list tRPC procedures + rotateToken"
```

---

### Task 6: Moderation-Mutations — approve/reject/delete/clear (TDD)

**Files:**
- Modify: `server/routers.ts` (`slideshow`-Namespace erweitern)
- Test: `server/slideshow.test.ts`

- [ ] **Step 1: Failing Test ergänzen**

In `server/slideshow.test.ts` anhängen:

```typescript
describe('slideshow moderation', () => {
  it('approve bumps photoVersion', async () => {
    const admin = appRouter.createCaller(ctx('admin'));
    const before = (await admin.slideshow.getSettings()).photoVersion;
    // Direkt eine pending-Row anlegen (Upload-Route ist Express, hier DB-Helper):
    const id = await db.createSlideshowPhoto({
      status: 'pending',
      displayUrl: 'https://example.com/d.jpg',
      displayKey: 'slideshow/display/test.jpg',
      thumbnailUrl: 'https://example.com/t.jpg',
      thumbnailKey: 'slideshow/thumb/test.jpg',
      width: 1000,
      height: 1500,
      bytes: 12345,
      uploaderIp: null,
    });
    await admin.slideshow.approve({ id });
    const after = (await admin.slideshow.getSettings()).photoVersion;
    expect(after).toBe(before + 1);
    // Cleanup
    await admin.slideshow.deletePhoto({ id });
  });

  it('editor cannot approve', async () => {
    const editor = appRouter.createCaller(ctx('editor'));
    await expect(editor.slideshow.approve({ id: 999999 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Test ausführen → fehlschlagen**

Run: `pnpm test server/slideshow.test.ts`
Expected: FAIL (`approve`/`deletePhoto` existieren nicht).

- [ ] **Step 3: Mutations implementieren**

Im `slideshow`-Namespace (nach `rotateToken`) ergänzen:

```typescript
    approve: requirePermission('manage_slideshow')
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const photo = await db.getSlideshowPhotoById(input.id);
        if (!photo)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Photo not found' });
        await db.approveSlideshowPhoto(input.id, ctx.user.id);
        await db.bumpPhotoVersion();
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_approve',
          details: `Approved photo ${input.id}`,
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      }),
    approveAll: requirePermission('manage_slideshow').mutation(
      async ({ ctx }) => {
        await db.approveAllPendingSlideshowPhotos(ctx.user.id);
        await db.bumpPhotoVersion();
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_approve_all',
          details: 'Approved all pending photos',
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      },
    ),
    // Ablehnen (pending) — Files + Row hart löschen, KEIN Version-Bump (nicht sichtbar).
    reject: requirePermission('manage_slideshow')
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const keys = await db.deleteSlideshowPhoto(input.id);
        if (keys) {
          await storageDelete(keys.displayKey);
          await storageDelete(keys.thumbnailKey);
        }
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_reject',
          details: `Rejected photo ${input.id}`,
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      }),
    // Aus Album löschen (approved) — Files + Row löschen + Version-Bump.
    deletePhoto: requirePermission('manage_slideshow')
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const keys = await db.deleteSlideshowPhoto(input.id);
        if (keys) {
          await storageDelete(keys.displayKey);
          await storageDelete(keys.thumbnailKey);
        }
        await db.bumpPhotoVersion();
        await db.createActivityLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'slideshow_delete',
          details: `Deleted photo ${input.id}`,
          ipAddress: null,
          userAgent: null,
        });
        return { success: true };
      }),
    clearAll: requirePermission('manage_slideshow').mutation(async ({ ctx }) => {
      const keys = await db.clearAllSlideshowPhotos();
      for (const k of keys) {
        await storageDelete(k.displayKey);
        await storageDelete(k.thumbnailKey);
      }
      await db.bumpPhotoVersion();
      await db.createActivityLog({
        userId: ctx.user.id,
        userName: ctx.user.name || 'Unknown',
        action: 'slideshow_clear_all',
        details: `Deleted ${keys.length} photos`,
        ipAddress: null,
        userAgent: null,
      });
      return { success: true, deleted: keys.length };
    }),
```

- [ ] **Step 4: Test ausführen → grün**

Run: `pnpm test server/slideshow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routers.ts server/slideshow.test.ts
git commit -m "feat: add slideshow moderation mutations (approve/reject/delete/clear)"
```

---

## Phase 3 — Öffentliche Upload-Route

### Task 7: `POST /api/upload/slideshow-photo`

**Files:**
- Modify: `server/uploadRoutes.ts`

- [ ] **Step 1: Imports erweitern**

In `server/uploadRoutes.ts`:

```typescript
import rateLimit from 'express-rate-limit';
```

Den bestehenden Import `import { getUserByOpenId } from './db';` erweitern zu:

```typescript
import {
  getUserByOpenId,
  getSlideshowSettings,
  getSlideshowStats,
  createSlideshowPhoto,
  bumpPhotoVersion,
} from './db';
```

- [ ] **Step 2: Rate-Limiter + Route ergänzen**

In `server/uploadRoutes.ts`, **vor** der Zeile `router.use(multerErrorMiddleware);` einfügen:

```typescript
// ---------------------------------------------------------------------------
// Public guest upload for the live slideshow. NO auth — gated by token +
// rate limit. Same-origin POST passes csrfGuard (Origin === appOrigin).
// All-in-one: validate → process (sharp) → store → DB insert (atomic, no
// orphans on the 40GB disk). Limit is DB-configurable (slideshowSettings).
// ---------------------------------------------------------------------------

const slideshowUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: async () => {
    try {
      const s = await getSlideshowSettings();
      return s.uploadRateLimit;
    } catch {
      return 80;
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Uploads. Bitte einen Moment warten.' },
});

router.post(
  '/slideshow-photo',
  slideshowUploadLimiter,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const token =
        (typeof req.query.token === 'string' ? req.query.token : '') ||
        (typeof req.body?.token === 'string' ? req.body.token : '');
      const settings = await getSlideshowSettings();
      if (!token || token !== settings.uploadToken) {
        res.status(403).json({ error: 'Ungültiger Link' });
        return;
      }
      if (!settings.uploadsOpen) {
        res.status(423).json({ error: 'Uploads sind aktuell geschlossen' });
        return;
      }
      const stats = await getSlideshowStats();
      if (stats.pending + stats.approved >= settings.maxPhotos) {
        res.status(409).json({ error: 'Das Album ist voll' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file provided (field name: "file")' });
        return;
      }
      const sniffed = await sniffImage(req.file.buffer);
      if (!sniffed) {
        res
          .status(415)
          .json({ error: 'Ungültiges Bild (nur JPEG/PNG/WebP)' });
        return;
      }

      const id = nanoid();
      // .rotate() ohne Args = EXIF-Auto-Orientierung, dann EXIF/GPS gestrippt.
      const displayBuf = await sharp(sniffed.buffer, {
        limitInputPixels: MAX_PIXELS,
      })
        .rotate()
        .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer();
      const displayMeta = await sharp(displayBuf).metadata();
      const thumbBuf = await sharp(sniffed.buffer, {
        limitInputPixels: MAX_PIXELS,
      })
        .rotate()
        .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 55 })
        .toBuffer();

      const display = await storagePut(
        `slideshow/display/${id}.jpg`,
        displayBuf,
        'image/jpeg',
      );
      const thumb = await storagePut(
        `slideshow/thumb/${id}.jpg`,
        thumbBuf,
        'image/jpeg',
      );

      const status: 'pending' | 'approved' = settings.moderationEnabled
        ? 'pending'
        : 'approved';
      await createSlideshowPhoto({
        status,
        displayUrl: display.url,
        displayKey: display.key,
        thumbnailUrl: thumb.url,
        thumbnailKey: thumb.key,
        width: displayMeta.width ?? sniffed.width,
        height: displayMeta.height ?? sniffed.height,
        bytes: displayBuf.length,
        uploaderIp: req.ip ?? null,
      });
      if (status === 'approved') await bumpPhotoVersion();

      res.json({ status: status === 'approved' ? 'live' : 'pending' });
    } catch (error) {
      console.error('[Upload] slideshow-photo failed:', error);
      res.status(500).json({ error: 'Upload fehlgeschlagen' });
    }
  },
);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Manuelle Verifikation (dev-Server)**

Run: `pnpm dev` (separates Terminal). Token aus dev-DB holen (z.B. `slideshow_settings.uploadToken` oder über Control später). Test-Upload:

```bash
curl -i -X POST "http://localhost:3000/api/upload/slideshow-photo?token=<TOKEN>" \
  -H "Origin: http://localhost:3000" \
  -F "file=@<pfad-zu-einem-foto>.jpg"
```

Expected: `200` mit `{"status":"pending"}` (Moderation default an). Falscher Token → `403`. Datei erscheint unter `UPLOAD_DIR/slideshow/display/` + `/thumb/`.

- [ ] **Step 5: Commit**

```bash
git add server/uploadRoutes.ts
git commit -m "feat: add public token-gated slideshow upload route"
```

---

## Phase 4 — Client-Routing

### Task 8: `App.tsx` — Bare-Route-Refactor + Routen + lazy Pages

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Lazy-Imports ergänzen**

Nach den bestehenden lazy-Imports (z.B. nach `SdkControl`):

```typescript
const Diashow = lazy(() => import('./pages/diashow/Diashow'));
const DiashowUpload = lazy(() => import('./pages/diashow/DiashowUpload'));
const DiashowControl = lazy(() => import('./pages/diashow/DiashowControl'));
```

- [ ] **Step 2: Layout-Mode-Helper statt `OVERLAY_ROUTES`-Exact-Match**

`OVERLAY_ROUTES` + die `isOverlayRoute`-Logik ersetzen. Die Konstante (Zeile 44) entfernen und durch einen Helper ersetzen (außerhalb der Komponente, z.B. unter `useBeamerMode`):

```typescript
type LayoutMode = 'overlay-transparent' | 'bare-black' | 'normal';

function getLayoutMode(location: string): LayoutMode {
  if (location === '/overlay/sdk') return 'overlay-transparent';
  // /diashow/<token> und /diashow/<token>/upload sind bare; /diashow/control normal.
  if (location.startsWith('/diashow/') && location !== '/diashow/control') {
    return 'bare-black';
  }
  return 'normal';
}
```

In `AppContent` die Zeile `const isOverlayRoute = OVERLAY_ROUTES.some(r => location === r);` ersetzen durch:

```typescript
  const layoutMode = getLayoutMode(location);
```

Und den bestehenden `if (isOverlayRoute) { ... }`-Block ersetzen durch:

```typescript
  // Transparent overlay (OBS) — unverändert.
  if (layoutMode === 'overlay-transparent') {
    return (
      <div style={{ background: 'transparent' }}>
        <Router />
      </div>
    );
  }

  // Bare routes (Diashow + Upload): kein Nav/Footer, Seite setzt eigenen Hintergrund.
  if (layoutMode === 'bare-black') {
    return (
      <div className="min-h-screen">
        <Router />
      </div>
    );
  }
```

- [ ] **Step 3: Routen im `<Switch>` ergänzen**

Im `Router()`-`<Switch>`, nach den SDK-Overlay-Routen und **vor** der `/404`-Route. Reihenfolge beachten: `/diashow/control` (literal) MUSS vor `/diashow/:token` (wildcard) stehen.

```typescript
        {/* Live-Diashow — nicht verlinkt, nicht indexiert */}
        <Route path="/diashow/control" component={DiashowControl} />
        <Route path="/diashow/:token/upload" component={DiashowUpload} />
        <Route path="/diashow/:token" component={Diashow} />
```

- [ ] **Step 4: Platzhalter-Pages anlegen (damit Build grün ist)**

Drei minimale Stub-Komponenten anlegen, damit `pnpm check` durchläuft (werden in Phase 5–7 ausgefüllt):

`client/src/pages/diashow/Diashow.tsx`:
```tsx
export default function Diashow() {
  return <div className="min-h-screen bg-black" />;
}
```

`client/src/pages/diashow/DiashowUpload.tsx`:
```tsx
export default function DiashowUpload() {
  return <div className="min-h-screen" />;
}
```

`client/src/pages/diashow/DiashowControl.tsx`:
```tsx
export default function DiashowControl() {
  return <div className="min-h-screen" />;
}
```

- [ ] **Step 5: Typecheck + manuelle Route-Prüfung**

Run: `pnpm check`
Expected: PASS.
Run (dev läuft): `/diashow/control` ohne Login → später „Kein Zugriff"; `/diashow/test-token` → schwarze Seite; Hauptseiten (`/`, `/shotcounter`) unverändert mit Nav/Footer.

- [ ] **Step 6: Commit**

```bash
git add client/src/App.tsx client/src/pages/diashow/
git commit -m "feat: add /diashow routes + bare-route layout mode"
```

---

## Phase 5 — Upload-Seite

### Task 9: `DiashowUpload.tsx` (mobile-first)

**Files:**
- Modify: `client/src/pages/diashow/DiashowUpload.tsx`

- [ ] **Step 1: Vollständige Implementierung**

`client/src/pages/diashow/DiashowUpload.tsx` ersetzen:

```tsx
import { useParams } from 'wouter';
import { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, Check, Loader2, X } from 'lucide-react';

type Item = {
  localId: string;
  previewUrl: string;
  state: 'compressing' | 'uploading' | 'pending' | 'live' | 'error';
  error?: string;
};

const COMPRESSION = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 2560,
  useWebWorker: true,
  initialQuality: 0.8,
};

export default function DiashowUpload() {
  const { token } = useParams<{ token: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: state } = trpc.slideshow.publicState.useQuery(
    { token: token ?? '' },
    { refetchInterval: 8000, enabled: !!token },
  );

  function patch(localId: string, next: Partial<Item>) {
    setItems(prev =>
      prev.map(it => (it.localId === localId ? { ...it, ...next } : it)),
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !token) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const localId = `${file.name}-${file.size}-${items.length}-${Math.round(
        performance.now(),
      )}`;
      const previewUrl = URL.createObjectURL(file);
      setItems(prev => [
        ...prev,
        { localId, previewUrl, state: 'compressing' },
      ]);
      try {
        const compressed = await imageCompression(file, COMPRESSION);
        patch(localId, { state: 'uploading' });
        const form = new FormData();
        form.append('file', compressed, 'photo.jpg');
        const res = await fetch(
          `/api/upload/slideshow-photo?token=${encodeURIComponent(token)}`,
          { method: 'POST', body: form, credentials: 'include' },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          patch(localId, {
            state: 'error',
            error: body.error || 'Upload fehlgeschlagen',
          });
          continue;
        }
        const body = (await res.json()) as { status: 'pending' | 'live' };
        patch(localId, { state: body.status });
      } catch (e) {
        patch(localId, { state: 'error', error: 'Fehler beim Verarbeiten' });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  const invalid = state && state.valid === false;
  const uploadsClosed = state?.valid && !state.uploadsOpen;
  const contributed = items.filter(
    it => it.state === 'pending' || it.state === 'live',
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-8">
      <SEO title="Foto hochladen" noIndex />

      <img
        src="/logo.png"
        alt=""
        className="h-14 w-auto mb-4 opacity-90"
        onError={e => (e.currentTarget.style.display = 'none')}
      />
      <h1 className="text-2xl font-bold text-center">
        {state?.valid && state.eventTitle ? state.eventTitle : 'Live-Diashow'}
      </h1>
      <p className="text-muted-foreground text-center mt-1 mb-6 max-w-sm">
        Lade deine Fotos hoch — sie erscheinen auf der Event-Leinwand.
      </p>

      {invalid ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-center max-w-sm">
          Dieser Link ist ungültig oder abgelaufen.
        </div>
      ) : uploadsClosed ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-center max-w-sm">
          Uploads sind aktuell geschlossen.
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button
              size="lg"
              className="h-16 text-lg"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="mr-2 size-6" /> Fotos auswählen
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-16 text-lg"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.setAttribute('capture', 'environment');
                  inputRef.current.click();
                  inputRef.current.removeAttribute('capture');
                }
              }}
            >
              <Camera className="mr-2 size-6" /> Foto aufnehmen
            </Button>
          </div>

          {state?.valid && state.moderationEnabled && (
            <p className="text-xs text-muted-foreground mt-4 text-center max-w-sm">
              Deine Fotos werden kurz vom Team geprüft, bevor sie erscheinen.
            </p>
          )}

          {contributed > 0 && (
            <p className="text-sm font-medium mt-4">
              Du hast {contributed}{' '}
              {contributed === 1 ? 'Foto' : 'Fotos'} beigesteuert 🎉
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 mt-6 w-full max-w-sm">
            {items.map(it => (
              <div
                key={it.localId}
                className="relative aspect-square rounded-md overflow-hidden bg-muted"
              >
                <img
                  src={it.previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  {(it.state === 'compressing' || it.state === 'uploading') && (
                    <Loader2 className="size-5 animate-spin text-white" />
                  )}
                  {it.state === 'pending' && (
                    <span className="text-[10px] text-white text-center px-1">
                      Wird geprüft…
                    </span>
                  )}
                  {it.state === 'live' && (
                    <Check className="size-6 text-success" />
                  )}
                  {it.state === 'error' && (
                    <X className="size-6 text-destructive" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

> **Hinweis:** `/logo.png` an den tatsächlichen Logo-Pfad anpassen (Navigation-Komponente prüfen, welches Asset verwendet wird). Falls keins existiert, das `<img>` entfernen.

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Manuelle Verifikation**

Dev-Server + Handy-Emulation (DevTools). `/diashow/<TOKEN>/upload` öffnen → Foto wählen → komprimiert → Upload → „Wird geprüft…". Falscher Token → „Link ungültig".

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/diashow/DiashowUpload.tsx
git commit -m "feat: add mobile guest upload page for live slideshow"
```

---

## Phase 6 — Control-Panel

### Task 10: `DiashowControl.tsx` (maintainer+)

**Files:**
- Modify: `client/src/pages/diashow/DiashowControl.tsx`

- [ ] **Step 1: Vollständige Implementierung**

`client/src/pages/diashow/DiashowControl.tsx` ersetzen. Nutzt shadcn-Primitives aus `@/components/ui/*` (Switch, Button, Input, Card, Select, AlertDialog) und `sonner` für Toasts.

```tsx
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { usePermission } from '@/hooks/usePermissions';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Check, X, Trash2, Copy, RefreshCw, ExternalLink } from 'lucide-react';

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DiashowControl() {
  const canManage = usePermission('manage_slideshow');
  const utils = trpc.useUtils();

  const { data: settings } = trpc.slideshow.getSettings.useQuery(undefined, {
    enabled: canManage,
    refetchInterval: 5000,
  });
  const { data: pending = [] } = trpc.slideshow.listPending.useQuery(undefined, {
    enabled: canManage,
    refetchInterval: 3000,
  });
  const { data: all = [] } = trpc.slideshow.listAll.useQuery(undefined, {
    enabled: canManage,
    refetchInterval: 15000,
  });

  const invalidate = () => {
    utils.slideshow.getSettings.invalidate();
    utils.slideshow.listPending.invalidate();
    utils.slideshow.listAll.invalidate();
  };

  const update = trpc.slideshow.updateSettings.useMutation({
    onSuccess: () => utils.slideshow.getSettings.invalidate(),
    onError: e => toast.error(e.message),
  });
  const approve = trpc.slideshow.approve.useMutation({ onSuccess: invalidate });
  const reject = trpc.slideshow.reject.useMutation({ onSuccess: invalidate });
  const approveAll = trpc.slideshow.approveAll.useMutation({
    onSuccess: invalidate,
  });
  const del = trpc.slideshow.deletePhoto.useMutation({ onSuccess: invalidate });
  const rotate = trpc.slideshow.rotateToken.useMutation({
    onSuccess: () => {
      utils.slideshow.getSettings.invalidate();
      toast.success('Neuer Token — alter QR-Code ist jetzt ungültig.');
    },
  });
  const clearAll = trpc.slideshow.clearAll.useMutation({
    onSuccess: r => {
      invalidate();
      toast.success(`${r.deleted} Fotos gelöscht.`);
    },
  });

  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Kein Zugriff</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Diese Seite ist nur für Maintainer und Admins zugänglich.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        Lädt…
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const uploadUrl = `${origin}/diashow/${settings.uploadToken}/upload`;
  const liveUrl = `${origin}/diashow/${settings.uploadToken}`;
  const title = titleDraft ?? settings.eventTitle ?? '';

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <SEO title="Diashow-Steuerung" noIndex />
      <h1 className="text-2xl font-bold">Live-Diashow — Steuerung</h1>

      {/* Status & Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              ['isVisible', 'Diashow sichtbar'],
              ['uploadsOpen', 'Uploads offen'],
              ['moderationEnabled', 'Moderation (Freigabe nötig)'],
              ['showQr', 'QR-Code auf Diashow'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={settings[key]}
                onCheckedChange={v => update.mutate({ [key]: v })}
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="eventTitle">Event-Titel</Label>
            <div className="flex gap-2">
              <Input
                id="eventTitle"
                value={title}
                onChange={e => setTitleDraft(e.target.value)}
                placeholder="z.B. Jogge di Balla 2026"
              />
              <Button
                onClick={() => {
                  update.mutate({ eventTitle: title || null });
                  setTitleDraft(null);
                }}
              >
                Speichern
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Slide-Dauer (Sek.)</Label>
              <Input
                type="number"
                min={2}
                max={60}
                defaultValue={Math.round(settings.slideDurationMs / 1000)}
                onBlur={e =>
                  update.mutate({
                    slideDurationMs: Math.max(
                      2000,
                      Math.min(60000, Number(e.target.value) * 1000),
                    ),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Übergang</Label>
              <Select
                value={settings.transition}
                onValueChange={v =>
                  update.mutate({ transition: v as 'fade' | 'kenburns' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kenburns">Ken-Burns (verspielt)</SelectItem>
                  <SelectItem value="fade">Fade (ruhig)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max. Fotos</Label>
              <Input
                type="number"
                min={1}
                defaultValue={settings.maxPhotos}
                onBlur={e =>
                  update.mutate({ maxPhotos: Math.max(1, Number(e.target.value)) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Upload-Limit (pro IP / 10 min)</Label>
              <Input
                type="number"
                min={1}
                defaultValue={settings.uploadRateLimit}
                onBlur={e =>
                  update.mutate({
                    uploadRateLimit: Math.max(1, Number(e.target.value)),
                  })
                }
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {settings.approvedCount} live · {settings.pendingCount} ausstehend ·{' '}
            {formatBytes(settings.totalBytes)} belegt
          </div>
          <div className="flex gap-3">
            <a href={liveUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1 size-4" /> Diashow
              </Button>
            </a>
            <a href={uploadUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1 size-4" /> Upload
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* QR & Link */}
      <Card>
        <CardHeader>
          <CardTitle>QR-Code & Link</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-6 items-center">
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={uploadUrl} size={160} />
          </div>
          <div className="flex-1 space-y-3 w-full">
            <div className="flex gap-2">
              <Input readOnly value={uploadUrl} className="text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(uploadUrl);
                  toast.success('Link kopiert');
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <RefreshCw className="mr-1 size-4" /> Token rotieren
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Token rotieren?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Der alte QR-Code und Link werden sofort ungültig. Neuer
                    QR-Code muss neu verteilt werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => rotate.mutate()}>
                    Rotieren
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Moderation */}
      {settings.moderationEnabled && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Moderation ({pending.length})</CardTitle>
            {pending.length > 0 && (
              <Button size="sm" onClick={() => approveAll.mutate()}>
                Alle freigeben
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Keine ausstehenden Fotos.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pending.map(p => (
                  <div key={p.id} className="space-y-2">
                    <img
                      src={p.thumbnailUrl}
                      alt=""
                      className="w-full aspect-square object-cover rounded-md"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => approve.mutate({ id: p.id })}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => reject.mutate({ id: p.id })}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Album */}
      <Card>
        <CardHeader>
          <CardTitle>Album ({all.filter(p => p.status === 'approved').length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {all
              .filter(p => p.status === 'approved')
              .map(p => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-md overflow-hidden group"
                >
                  <img
                    src={p.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => del.mutate({ id: p.id })}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    aria-label="Löschen"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Gefahrenzone</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 size-4" /> Alle Fotos löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Wirklich ALLE Fotos löschen?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Löscht alle {settings.approvedCount + settings.pendingCount}{' '}
                  Fotos unwiderruflich von Disk und DB. Für das nächste Event.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => clearAll.mutate()}
                  className="bg-destructive text-destructive-foreground"
                >
                  Endgültig löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
```

> **Verify vor dem Schreiben:** Existenz/Export-Namen der UI-Primitives in `client/src/components/ui/` prüfen (`switch`, `select`, `alert-dialog`, `card`, `input`, `label`, `button`). Falls ein Import-Name abweicht, anpassen (nicht neu erfinden).

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Manuelle Verifikation**

Als maintainer/admin einloggen (mit lokal geseedetem `manage_slideshow`). `/diashow/control` → Toggles schalten, Titel speichern, QR sehen. Test-Upload (Task 7 curl) → erscheint in Moderation → „Freigeben". Als editor/ausgeloggt → „Kein Zugriff".

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/diashow/DiashowControl.tsx
git commit -m "feat: add maintainer slideshow control panel"
```

---

## Phase 7 — Slideshow-Seite

### Task 11: Layout-Engine `slideshow-layout.ts` (reine Funktion)

**Files:**
- Create: `client/src/lib/slideshow-layout.ts`

- [ ] **Step 1: Reine Layout-Funktion**

`client/src/lib/slideshow-layout.ts`:

```typescript
export type LayoutPhoto = {
  id: number;
  displayUrl: string;
  width: number;
  height: number;
};

export type Slide =
  | { kind: 'solo'; photos: [LayoutPhoto] }
  | { kind: 'portrait-row'; photos: LayoutPhoto[] };

const PORTRAIT_THRESHOLD = 1.2; // height/width >= 1.2 → Hochformat

function isPortrait(p: LayoutPhoto): boolean {
  return p.width > 0 && p.height / p.width >= PORTRAIT_THRESHOLD;
}

/**
 * Baut aus der (bereits geordneten/gemischten) Foto-Liste „Slides".
 * Querformat/Quadrat → solo. Aufeinanderfolgende Hochformate werden zu
 * k nebeneinander gruppiert (k passend zum Screen-Seitenverhältnis, 1–3),
 * damit sie die Breite füllen statt schwarzer Balken.
 */
export function buildSlides(photos: LayoutPhoto[], screenAR: number): Slide[] {
  const slides: Slide[] = [];
  let i = 0;
  while (i < photos.length) {
    const p = photos[i];
    if (isPortrait(p)) {
      const singleAR = p.width / p.height; // < 1 bei Hochformat
      let k = Math.round(screenAR / singleAR);
      k = Math.max(1, Math.min(3, k));
      const group: LayoutPhoto[] = [];
      while (group.length < k && i < photos.length && isPortrait(photos[i])) {
        group.push(photos[i]);
        i++;
      }
      slides.push({ kind: 'portrait-row', photos: group });
    } else {
      slides.push({ kind: 'solo', photos: [p] });
      i++;
    }
  }
  return slides;
}

/** Fisher-Yates mit injizierbarem RNG (für Determinismus testbar). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(rng() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS. (Kein vitest-Test — Frontend-Code; Verifikation visuell in Task 12.)

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/slideshow-layout.ts
git commit -m "feat: add slideshow layout engine (buildSlides)"
```

---

### Task 12: `Diashow.tsx` — Fullscreen-Bühne

**Files:**
- Modify: `client/src/pages/diashow/Diashow.tsx`

- [ ] **Step 1: Vollständige Implementierung**

`client/src/pages/diashow/Diashow.tsx` ersetzen:

```tsx
import { useParams } from 'wouter';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { trpc } from '@/lib/trpc';
import { SEO } from '@/components/SEO';
import { buildSlides, shuffle, type LayoutPhoto } from '@/lib/slideshow-layout';

function useScreenAR(): number {
  const [ar, setAr] = useState(
    typeof window !== 'undefined'
      ? window.innerWidth / window.innerHeight
      : 16 / 9,
  );
  useEffect(() => {
    const onResize = () => setAr(window.innerWidth / window.innerHeight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return ar;
}

// Eine Bild-Kachel mit unscharfem Backdrop + (optional) Ken-Burns.
function PhotoTile({
  photo,
  kenburns,
}: {
  photo: LayoutPhoto;
  kenburns: boolean;
}) {
  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <img
        src={photo.displayUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-50"
      />
      {kenburns ? (
        <motion.img
          src={photo.displayUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          initial={{ scale: 1.05, x: '-1%', y: '-1%' }}
          animate={{ scale: 1.15, x: '1%', y: '1%' }}
          transition={{ duration: 12, ease: 'linear' }}
        />
      ) : (
        <img
          src={photo.displayUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}
    </div>
  );
}

export default function Diashow() {
  const { token } = useParams<{ token: string }>();
  const screenAR = useScreenAR();

  const { data: state } = trpc.slideshow.publicState.useQuery(
    { token: token ?? '' },
    { refetchInterval: 3000, refetchIntervalInBackground: true, enabled: !!token },
  );

  const utils = trpc.useUtils();
  const { data: photos = [] } = trpc.slideshow.listApproved.useQuery(
    { token: token ?? '' },
    { enabled: !!token, refetchInterval: 60000 },
  );

  // Bei photoVersion-Änderung listApproved neu laden.
  const lastVersion = useRef<number>(-1);
  useEffect(() => {
    if (!state?.valid) return;
    if (state.photoVersion !== lastVersion.current) {
      lastVersion.current = state.photoVersion;
      utils.slideshow.listApproved.invalidate();
    }
  }, [state?.valid, state?.photoVersion, utils]);

  // Slide-Reihenfolge: gemischt, bei Bestandsänderung neu gemischt.
  const slides = useMemo(() => {
    if (photos.length === 0) return [];
    return buildSlides(shuffle(photos as LayoutPhoto[]), screenAR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length, screenAR]);

  const [index, setIndex] = useState(0);

  // Neu-Highlight: ein gerade dazugekommenes Bild bevorzugt als nächstes zeigen.
  const seenIds = useRef<Set<number>>(new Set());
  const [featured, setFeatured] = useState<LayoutPhoto | null>(null);
  useEffect(() => {
    if (photos.length === 0) return;
    const known = seenIds.current;
    const fresh = (photos as LayoutPhoto[]).filter(p => !known.has(p.id));
    photos.forEach(p => known.add(p.id));
    // Beim ersten Laden nicht highlighten (alles ist „neu").
    if (known.size === photos.length && fresh.length === photos.length) return;
    if (fresh.length > 0) setFeatured(fresh[fresh.length - 1]);
  }, [photos]);

  const durationMs = state?.valid ? state.slideDurationMs : 6000;
  const kenburns = state?.valid ? state.transition === 'kenburns' : true;

  // Timer für Slide-Wechsel.
  useEffect(() => {
    if (featured) {
      const t = setTimeout(() => setFeatured(null), Math.max(3500, durationMs));
      return () => clearTimeout(t);
    }
    if (slides.length === 0) return;
    const t = setTimeout(
      () => setIndex(i => (i + 1) % slides.length),
      durationMs,
    );
    return () => clearTimeout(t);
  }, [featured, index, slides.length, durationMs]);

  const uploadUrl =
    typeof window !== 'undefined' && token
      ? `${window.location.origin}/diashow/${token}/upload`
      : '';

  const showIdle =
    !state?.valid || !state.isVisible || (slides.length === 0 && !featured);

  const currentSlide = featured
    ? ({ kind: 'solo', photos: [featured] } as const)
    : slides[index % Math.max(1, slides.length)];

  const slideKey = featured
    ? `featured-${featured.id}`
    : `slide-${index}-${currentSlide?.photos.map(p => p.id).join('_')}`;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <SEO title="Diashow" noIndex />

      <AnimatePresence mode="wait">
        {showIdle ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-white gap-6"
          >
            <h1 className="text-4xl font-bold">
              {state?.valid && state.eventTitle
                ? state.eventTitle
                : 'Live-Diashow'}
            </h1>
            {uploadUrl && (
              <>
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG value={uploadUrl} size={220} />
                </div>
                <p className="text-xl opacity-80">
                  Scan & lade deine Fotos hoch
                </p>
              </>
            )}
          </motion.div>
        ) : currentSlide ? (
          <motion.div
            key={slideKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 flex gap-1"
          >
            {currentSlide.photos.map(p => (
              <PhotoTile key={p.id} photo={p} kenburns={kenburns} />
            ))}
            {featured && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 bg-coral text-white px-4 py-2 rounded-full text-lg font-semibold shadow-lg"
              >
                ✨ Gerade hochgeladen
              </motion.div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* QR-Overlay unten im Eck */}
      {state?.valid && state.showQr && !showIdle && uploadUrl && (
        <div className="absolute bottom-5 right-5 bg-white/95 rounded-lg p-2 flex items-center gap-2 shadow-lg">
          <QRCodeSVG value={uploadUrl} size={84} />
          <span className="text-black text-xs max-w-[90px] leading-tight pr-1">
            Scan & lade dein Foto hoch
          </span>
        </div>
      )}
    </div>
  );
}
```

> **Verify:** `bg-coral` existiert als Layer-2-Token (siehe `client/src/CLAUDE.md`). Falls ein anderer Akzent gewünscht, Token anpassen — keine rohen Tailwind-Farben.

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Manuelle Verifikation (Kernstück — live iterieren)**

Dev-Server. Mehrere Fotos hochladen + freigeben (Control). `/diashow/<TOKEN>` öffnen:
- Querformat solo mit unscharfem Backdrop + Ken-Burns; mehrere Hochformate nebeneinander.
- Neues freigegebenes Foto erscheint in ~1–3s mit „✨ Gerade hochgeladen".
- `isVisible=false` oder 0 Fotos → Idle-Screen mit großem QR.
- QR unten rechts ein/ausblendbar via Control-Toggle.
- Fenster resizen / Hochkant → Layout passt sich an.

Hier ggf. Timing/Layout-Feinschliff (Ken-Burns-Dauer, Gruppen-Größe, Fade-Dauer) live anpassen. **Playwright** zum Screenshotten in 1920×1080 + Hochkant nutzen.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/diashow/Diashow.tsx
git commit -m "feat: add fullscreen live slideshow stage"
```

---

## Phase 8 — Integration & Abschluss

### Task 13: Gesamt-Verifikation

**Files:** (keine — Verifikation)

- [ ] **Step 1: Typecheck + Format + Server-Tests**

```bash
pnpm check
pnpm format
pnpm test server/slideshow.test.ts
```
Expected: `check` PASS, `format` schreibt ggf. Formatierung, Tests grün (dev-DB läuft).

- [ ] **Step 2: End-to-End-Durchlauf (manuell)**

1. Control: Event-Titel setzen, `isVisible` an, Moderation an.
2. Handy/DevTools: `/diashow/<TOKEN>/upload` → 3–4 Fotos (Quer + Hoch) hochladen → „Wird geprüft…".
3. Control → Moderation → einzeln freigeben + „Alle freigeben".
4. `/diashow/<TOKEN>` (Beamer-Fenster) → Fotos rotieren, Neu-Highlight, QR-Eck.
5. `showQr` toggeln, `transition` auf `fade` → wirkt sofort (Polling).
6. Moderation aus → neuer Upload erscheint direkt als `live`.
7. „Token rotieren" → alter Upload-Link gibt 403; neuer QR funktioniert.
8. „Alle Fotos löschen" → Album leer, Diashow Idle, Files weg unter `UPLOAD_DIR/slideshow/`.

- [ ] **Step 3: Format-Commit (falls nötig)**

```bash
git add -A
git commit -m "chore: format live slideshow files"
```

---

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Coverage:** Routen/Sichtbarkeit (Task 8) · Datenmodell (Task 1) · Kompression+Storage (Task 7) · tRPC+Permission+db (Task 2–6) · Polling/Version-Sync (Task 12) · Slideshow-Layout (Task 11–12) · Upload-Seite (Task 9) · Control-Seite (Task 10) · App-Integration (Task 8) · Deps (Task 0) · Security/Privacy: Token (5/7), Rate-Limit (7), maxPhotos (7), EXIF-Strip (7), Moderation-default (1) · Tests (Task 4–6). Alle Spec-Abschnitte abgedeckt.
- **Platzhalter:** keine TBD/TODO; jeder Code-Step enthält vollständigen Code. Frontend-Visual-Feinschliff explizit als Live-Iteration im jeweiligen Verify-Step markiert (kein Platzhalter — funktionaler Code vorhanden).
- **Typ-Konsistenz:** `publicState`-Shape (valid + Felder) identisch in Task 4/9/12; `listApproved`-Shape `{id,displayUrl,width,height,createdAt}` ↔ `LayoutPhoto` (Task 11/12); db-Helper-Namen (Task 2) ↔ Router-Calls (Task 4–6) ↔ Upload-Route (Task 7) konsistent (`getSlideshowSettings`, `createSlideshowPhoto`, `getSlideshowStats`, `bumpPhotoVersion`, `deleteSlideshowPhoto`, `clearAllSlideshowPhotos`).
- **Bekannte Annahmen, die der Implementer prüfen muss:** exakte UI-Primitive-Import-Namen (`@/components/ui/*`), Logo-Asset-Pfad, `bg-coral`-Token, lokales Seeden von `manage_slideshow` für die Tests.
