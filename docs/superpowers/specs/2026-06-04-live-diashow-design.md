# Live-Diashow — Design / Spec

- **Datum:** 2026-06-04
- **Status:** Genehmigt (bereit für Implementierungsplan)
- **Autor:** Manuel Heller (mit Claude Code)

## 1. Kontext & Ziel

Eine versteckte, nur über URL erreichbare Live-Foto-Diashow für ein Event —
nach dem gleichen Schema wie das bestehende Stream-Overlay (`/overlay/sdk`).
Gäste laden per QR-Code Fotos hoch, ein Maintainer moderiert sie, und sie
erscheinen live auf einer bildschirmfüllenden Diashow (Beamer/Leinwand).

Drei Oberflächen:

1. **Diashow** — öffentlich (Token), Fullscreen, schwarz, dynamisch.
2. **Upload** — öffentlich (Token), mobile-first, QR-Code-Ziel.
3. **Control** — nur maintainer+, Moderation + Album + Toggles.

## 2. Getroffene Entscheidungen (Decision Log)

| #   | Entscheidung       | Wahl                                                                            |
| --- | ------------------ | ------------------------------------------------------------------------------- |
| 1   | Scope              | **Ein aktives Event** (globaler Pool, „archivieren & leeren" zwischen Events)   |
| 2   | Originale          | **Nur komprimiert** — keine Originale gespeichert                               |
| 3   | Moderation Default | **AN** (neue Bilder = `pending` bis Freigabe)                                   |
| 4   | Medientyp          | **Nur Fotos**                                                                   |
| 5   | URLs               | `/diashow/:token`, `/diashow/:token/upload`, `/diashow/control`                 |
| 6   | Sicherheit         | **Geheim-Token im Pfad**, im Control-Panel rotierbar                            |
| 7   | Diashow-Stil       | **Dynamisch & verspielt** (Ken-Burns, Multi-Hochformat-Layout, Neu-Highlight)   |
| A   | Realtime           | **Polling mit `photoVersion`-Counter** (konsistent mit Projekt, kein WebSocket) |
| B   | Upload-Flow        | **All-in-One Public Express-Route** (atomar, kein Orphan-Risiko)                |
| C   | ZIP-Download       | **Weggelassen** (YAGNI; Files werden bei Bedarf manuell vom Server geholt)      |

## 3. Nicht-Ziele (Out of Scope)

- Videos, mehrere parallele Galerien/Events, Captions/Gäste-Namen, echte
  Originaldateien, WebSocket/SSE, ZIP-Download, Benachrichtigung der Gäste bei
  Ablehnung. Bewusst weggelassen (YAGNI).

## 4. Routen & Sichtbarkeit

| Pfad                     | Wer                      | Layout                                    |
| ------------------------ | ------------------------ | ----------------------------------------- |
| `/diashow/:token`        | alle mit gültigem Token  | Bare, pure `#000`, Fullscreen-Bühne       |
| `/diashow/:token/upload` | alle mit gültigem Token  | Bare, mobile-first, eigenes Branding      |
| `/diashow/control`       | maintainer+ (auth-gated) | Normal (mit Nav/Footer, wie `SdkControl`) |

- Reihenfolge im `<Switch>`: `/diashow/control` **vor** `/diashow/:token`
  (literal vor Wildcard, sonst wird „control" als Token interpretiert).
  `/diashow/:token/upload` (3 Segmente) kollidiert nicht mit `/diashow/:token`.
- Alle drei Seiten rendern `<SEO noIndex />`.
- Ungültiger/fehlender Token auf Diashow → neutraler Idle/„Nichts zu sehen"-Screen;
  auf Upload → freundliche „Link ungültig"-Meldung.

## 5. Datenmodell (`drizzle/schema.ts`)

Konventionen des Projekts einhalten: `int().autoincrement().primaryKey()`,
`createdAt`/`updatedAt` mit `defaultNow()`/`onUpdateNow()`, `mysqlEnum` für
Status, Dual-Column `xxxUrl`+`xxxKey`, `$inferSelect`/`$inferInsert`-Exporte,
keine Drizzle-Relations-API.

### `slideshowPhotos` (eigene Tabelle — NICHT die bestehende `photos`)

- `id` — PK
- `status` — `mysqlEnum('pending','approved')`, default `pending`, notNull
- `displayUrl` / `displayKey` — text, notNull (2560px-Variante)
- `thumbnailUrl` / `thumbnailKey` — text, notNull (480px-Variante)
- `width` / `height` — int, notNull (Display-Variant-Dimensionen, für Layout-Engine)
- `bytes` — int, notNull (Dateigröße Display-Variant, Speicher-Tracking)
- `moderatedBy` — int, `references(() => users.id)`, nullable
- `moderatedAt` — timestamp, nullable
- `uploaderIp` — varchar(45), nullable (Abuse-Trace)
- `createdAt` — timestamp, defaultNow, notNull
- Index `(status, createdAt)` — für Slideshow-Query + Moderations-Queue

**Ablehnen (`reject`) = Files + DB-Row hart löschen** (spart Disk, kein totes
`rejected`-State). Begründung im Activity-Log. Es gibt daher nur `pending` und
`approved`.

### `slideshowSettings` (Single-Row, id=1 — Pattern wie `sdkSession`)

- `id` — PK
- `eventTitle` — varchar(255), nullable
- `isVisible` — boolean, default **false**, notNull (Master-Schalter Diashow-Anzeige)
- `uploadsOpen` — boolean, default true, notNull
- `moderationEnabled` — boolean, default **true**, notNull
- `showQr` — boolean, default true, notNull
- `uploadToken` — varchar(64), notNull (Geheim-Token, `nanoid`)
- `slideDurationMs` — int, default 6000, notNull
- `transition` — `mysqlEnum('fade','kenburns')`, default `kenburns`, notNull
- `photoVersion` — int, default 0, notNull (Bump bei Freigabe/Löschen/Clear → triggert Client-Refetch)
- `maxPhotos` — int, default 3000, notNull (Disk-Schutz)
- `uploadRateLimit` — int, default 80, notNull (max Uploads pro IP pro 10-min-Fenster; im Control anpassbar wegen Event-WLAN/NAT)
- `updatedAt` — timestamp, defaultNow, onUpdateNow, notNull
- `updatedBy` — int, `references(() => users.id)`, nullable

Helper `getSlideshowSettings()` legt die Row mit frisch generiertem `nanoid`-Token
an, falls sie fehlt (Create-if-missing, analog zur Permission-Seed-Logik).

## 6. Kompression & Speicher

**Client** (`browser-image-compression`):

- max Kante 2560px, Ziel ~1–1.2 MB, `initialQuality ≈ 0.8`, Web-Worker,
  EXIF-Auto-Rotation (Hochformat korrekt).

**Server** (`sharp`, in der Upload-Route):

- `display`: `.rotate()` (Rest-EXIF), `.resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })`, `.jpeg({ quality: 72, mozjpeg: true })` — **EXIF/GPS wird gestrippt** (sharp dropt Metadaten by default → Privacy).
- `thumbnail`: `.resize(480, 480, { fit: 'inside' })`, `.jpeg({ quality: 55 })`.
- `width`/`height`/`bytes` aus dem Display-Variant.
- Storage-Prefixe: `slideshow/display/<nanoid>.jpg`, `slideshow/thumb/<nanoid>.jpg`
  (via bestehendes `storagePut()` aus `server/storage.ts`).

**Rechnung:** 500 Bilder ≈ 0.4 GB, 2000 ≈ 1.6 GB — locker innerhalb 40 GB.
Doppel-Kompression (Client + Server) ist gewollt: Server-Pass validiert,
strippt Metadaten und erzeugt das Thumbnail.

## 7. Backend

### tRPC-Namespace `slideshow` (in `server/routers.ts`)

**Public (Token-validiert):**

- `publicState({ token })` — query. Validiert Token; gibt Anzeige-relevanten
  State zurück: `isVisible`, `showQr`, `moderationEnabled`, `uploadsOpen`,
  `eventTitle`, `slideDurationMs`, `transition`, `photoVersion`, `approvedCount`.
  Bei ungültigem Token: definierte „invalid"-Antwort (kein Secret-Leak).
- `listApproved({ token })` — query → `[{ id, displayUrl, width, height, createdAt }]`,
  nur `approved`, geordnet.

**`requirePermission('manage_slideshow')`:**

- `getSettings` — volle Settings inkl. `uploadToken`, Counts (pending/approved), Speicher-Bytes.
- `listPending`, `listAll`.
- `approve({ id })` — setzt `approved`, `moderatedBy/At`, bumpt `photoVersion`.
- `reject({ id })` — löscht Files (`storageDelete`) + Row.
- `deletePhoto({ id })` — wie reject (aus Album), bumpt `photoVersion`.
- `approveAll()` — alle pending → approved, ein Version-Bump.
- `updateSettings(partial)` — ein Mutation für alle Toggles/Felder
  (`isVisible`, `uploadsOpen`, `moderationEnabled`, `showQr`, `eventTitle`,
  `slideDurationMs`, `transition`, `maxPhotos`, `uploadRateLimit`), Zod-validiert partial.
- `rotateToken()` — neuer `nanoid`-Token (alte Links/QR sterben).
- `clearAll()` — alle Files + Rows löschen, `photoVersion` bumpen.

Jede Mutation schreibt einen Activity-Log-Eintrag (`db.createActivityLog`) und
bumpt `photoVersion` wo Bild-Bestand betroffen ist.

### Express-Route (public): `POST /api/upload/slideshow-photo`

In `server/uploadRoutes.ts`. Token via Query/Body. Ablauf:

1. `express-rate-limit` mit **dynamischem `limit`** (Funktion liest `slideshowSettings.uploadRateLimit`, default 80 / 10-min-Fenster pro IP). Großzügig wegen geteilter Event-WLAN-IPs; im Control anpassbar falls es Probleme macht.
2. Token gegen `slideshowSettings.uploadToken` prüfen → sonst 403.
3. `uploadsOpen`-Check → sonst 423/409 mit Klartext.
4. `maxPhotos`-Check (aktuelle Anzahl) → sonst „Album voll".
5. `multer` (memory, single `file`) + `sharp`-Validierung (Magic Bytes, Pixel-Cap wie bestehend).
6. `display` + `thumbnail` erzeugen, `storagePut`.
7. `db.createSlideshowPhoto(...)` mit `status = moderationEnabled ? 'pending' : 'approved'`;
   bei `approved` → `photoVersion` bumpen.
8. Antwort `{ status: 'pending' | 'live' }`.

Begründete Abweichung vom „Upload-Route → tRPC-create"-Pattern: anonyme Gäste
können keine `protectedProcedure` aufrufen; All-in-One ist atomar (kein Orphan
auf der 40-GB-Disk) und ein Roundtrip.

### `server/permissions.ts`

- `'manage_slideshow'` zu `PERMISSION_KEYS` hinzufügen.
- In `initializeDefaultPermissions()` für **admin UND maintainer** seeden
  (`hasPermission` behandelt admin NICHT speziell — verifiziert).

### `server/db.ts` (Helper, alle mit `getDb()`-Guard)

`getSlideshowSettings` (create-if-missing), `updateSlideshowSettings`,
`bumpPhotoVersion`, `createSlideshowPhoto`, `listApprovedSlideshowPhotos`,
`listPendingSlideshowPhotos`, `listAllSlideshowPhotos`, `getSlideshowPhotoById`,
`approveSlideshowPhoto`, `deleteSlideshowPhoto` (gibt Keys zum Unlink zurück),
`clearAllSlideshowPhotos` (gibt alle Keys zurück), `getSlideshowStorageBytes`,
`countSlideshowPhotos`.

## 8. Realtime / State-Sync (Polling)

- Slideshow pollt `publicState` alle ~3s (`refetchInterval`, auch im Hintergrund,
  wie `SdkOverlay`).
- Client vergleicht `photoVersion`; bei Änderung → `listApproved` invalidieren/neu
  laden. Zusätzlich ein 60s-Safety-Refetch von `listApproved`.
- Control-Moderations-Queue pollt `listPending` alle ~2–3s.
- Mutationen bumpen `photoVersion` serverseitig → Slideshow zieht in ~1–3s nach.

## 9. Slideshow-Seite (`/diashow/:token`)

Bühne pure `#000` (bewusst literal, wie `SdkOverlay` literale Farben nutzt — kein
Theme-Token, da Media-Canvas für Beamer). Layout-Engine:

- Misst Viewport-Seitenverhältnis (`window.innerWidth/Height`), re-misst bei
  `resize`/Orientation → funktioniert auch auf Hochkant-Screens.
- **Querformat-Bild** → solo, `object-contain`, unscharfer abgedunkelter Klon als
  Backdrop füllt Ränder, sanfter **Ken-Burns**-Zoom (CSS-Transform via framer-motion).
- **Hochformat** → bis zu **k nebeneinander**, `k = clamp(round(ScreenAR / BildAR), 1..3)`
  (bei 16:9 ≈ 2–3), leichter Stagger-Entrance → füllt Breite statt schwarzer Balken.
- **Quadratisch** → solo oder Paar.
- **Neues Bild** (id noch nicht gesehen) → wird als **nächster** Slide mit
  „✨ Gerade hochgeladen"-Badge + Spezial-Entrance gezeigt, danach normale Rotation.
- **Loop**: am Ende Reshuffle (kein Sofort-Repeat des letzten Bilds).
- `isVisible=false` oder 0 approved Bilder → **Idle-Screen**: Event-Titel, großer
  QR-Code, „Scan & lade hoch", Logo, dezente Animation.
- **QR** unten im Eck (Card, `qrcode.react` → `/diashow/:token/upload`),
  ein/ausblendbar via `showQr`.
- `transition`-Setting (`fade` | `kenburns`) und `slideDurationMs` steuern Wechsel.
- **Performance**: nur aktueller (+ direkter Nachbar-)Slide gemountet, nächste
  Bilder vorgeladen (`new Image()`), Rest entladen → stabil bei 500+ Bildern.
  Display-Variant auf der Bühne, Thumbnails nirgends hier.

## 10. Upload-Seite (`/diashow/:token/upload`)

Mobile-first, eigenes fokussiertes Layout (keine Website-Nav). Liest Token,
pollt/liest `publicState` (Token-Validität, `uploadsOpen`, `moderationEnabled`,
`eventTitle`).

- Großer „Foto hochladen"-Button: `<input type="file" accept="image/*" multiple>`
  - Kamera-Affordance (`capture`). Mehrfachauswahl.
- Pro Datei: clientseitig komprimieren (Progress) → POST an Upload-Route →
  Tile-Status: „✓ Wird vom Team geprüft" (Moderation an) bzw. „✓ Ist live! 🎉"
  (aus) / Fehler.
- Branding: Logo, Event-Titel, Vereinsfarben (Layer-2-Tokens).
- Fehlerfälle freundlich: `uploadsOpen=false` → „Uploads geschlossen",
  Album voll, Datei zu groß / falscher Typ, Token ungültig.
- Keine Registrierung, keine Captions.

## 11. Control-Seite (`/diashow/control`)

Maintainer+, mobile-tauglich (Staff moderiert am Event vom Handy). Guard:
`usePermission('manage_slideshow')` sonst „Kein Zugriff"-Card (wie `SdkControl`);
echte Durchsetzung serverseitig via `requirePermission`.

Sektionen:

1. **Status**: Switches `isVisible`/`uploadsOpen`/`moderationEnabled`/`showQr`,
   Event-Titel-Input, Slide-Dauer + Transition-Select, Upload-Rate-Limit-Input
   (default 80/10min), Speicher-/Anzahl-Anzeige,
   Links „Slideshow öffnen" / „Upload öffnen".
2. **QR & Link**: QR-Vorschau + Upload-URL + Copy-Button, „Token rotieren"
   (Confirm-Dialog → alter QR wird ungültig).
3. **Moderation** (Poll 2–3s, nur relevant wenn `moderationEnabled`): Grid pending
   Thumbnails, je „Freigeben" / „Ablehnen", „Alle freigeben", Pending-Count-Badge.
4. **Album**: Grid approved Thumbnails (virtualisiert für 500+), Lightbox,
   „Löschen" (Confirm).
5. **Danger Zone**: „Alle Fotos löschen" (Doppel-Confirm) = „archivieren & leeren"
   fürs nächste Event (löscht Files + Rows, bumpt `photoVersion`).

## 12. `App.tsx`-Integration

Overlay-Erkennung von Exact-Match (`OVERLAY_ROUTES.some(r => location === r)`) auf
einen Mode-Helper umbauen, der drei Zustände liefert:

- `'overlay-transparent'` — `/overlay/sdk` (unverändert, transparenter Wrapper).
- `'bare-black'` — `/diashow/:token` und `/diashow/:token/upload` (kein Nav/Footer;
  die Seite setzt ihren eigenen Hintergrund).
- `'normal'` — alles andere (inkl. `/diashow/control`).

Drei lazy-geladene Page-Komponenten + Routen im `<Switch>` (Reihenfolge s. §4).

## 13. Neue Dependencies

- Client: `browser-image-compression`, `qrcode.react`.
- `framer-motion` bereits vorhanden. Kein `archiver` (kein ZIP).

## 14. Sicherheit & Privacy

- Geheim-Token im Pfad gegen Drive-by/Scraper; im Control rotierbar.
- `express-rate-limit` auf der Upload-Route (echte Express-Route → nicht vom
  tRPC-Batch-Bypass betroffen), Limit DB-konfigurierbar (`uploadRateLimit`,
  default 80 / 10 min pro IP).
- `maxPhotos`-Cap schützt Disk vor Flooding.
- EXIF/GPS wird serverseitig gestrippt (sharp default) — keine Standortdaten
  der Gäste auf der Leinwand/Disk.
- Moderation default AN — nichts erscheint ungeprüft auf der öffentlichen Leinwand.

## 15. Tests

`server/slideshow.test.ts` im bestehenden `createCaller`-Pattern:

- Token-Validierung (falscher Token → keine Daten / definierte invalid-Antwort).
- Permission: maintainer erlaubt, editor + visitor verweigert.
- `approve` bumpt `photoVersion`; `clearAll` leert; `updateSettings` persistiert
  Toggles.
- DB **nicht** mocken (Projekt-Konvention; in CI ohne DB erwartetes Fail).

Kein Frontend-Test (Projekt-Konvention). Slideshow-Layout/Verhalten manuell bzw.
per Playwright verifizieren.
