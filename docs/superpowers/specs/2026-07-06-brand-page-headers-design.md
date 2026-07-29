# Brand Page Headers — Design Spec

**Datum:** 2026-07-06
**Branch:** `ui/brand-page-headers`
**Register:** brand (öffentliche Surfaces), plus zwei Ein-Zeilen-Fixes auf Product-Surfaces

## Problem

Audit der öffentlichen Seiten gegen PRODUCT.md / DESIGN.md ergab vier
konkurrierende Page-Header-Behandlungen, davon drei Template-Reflexe:

| Muster                            | Seiten                                                                | Problem                                                                                         |
| --------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Zentriertes Gross-Icon über Titel | Contact, Impressum, Datenschutz, Events, Sponsors                     | "Icon-über-Heading"-Template-Optik, Icon ist reine Deko                                         |
| Icon im `h1` inline               | Team                                                                  | Vermischt Deko und Typo, bricht die Display-Hierarchie                                          |
| Ganzer Titel als `gradient-text`  | Events, Sponsors, Dienstleistungen, Gönnermitglieder, Admin-Dashboard | Verstösst gegen DESIGN.md: gradient-text ist für Brand-Wörter reserviert, nicht für Seitentitel |
| Pill-Badge + gradient-Titel       | Dienstleistungen                                                      | Pill ist richtig (Brand-Vokabular), Gradient nicht                                              |

Zusätzlich: Impressum/Datenschutz wiederholen den Seitentitel als
`CardTitle` direkt unter dem `h1` (doppelte Überschrift) und verpacken
reinen Fliesstext in Card-Chrome.

## Entscheidung

Ein `PageHeader`-Brand-Pattern (`client/src/components/PageHeader.tsx`),
das das bestehende Brand-Vokabular wiederverwendet statt neues zu erfinden:

- **Kicker-Pill**: die bereits etablierte Pill (Home-Hero "Since 2022",
  Next-Event-Badge) wird zum konsistenten Kicker-Slot. Farbe folgt der
  Surface-Stimme (`primary` teal | `coral`), gemäss Two-Voice-Rule eine
  Stimme pro Surface. Optionales kleines Icon in der Pill.
- **Display-Titel**: `font-black tracking-tight`, `text-4xl md:text-5xl`,
  solider Foreground. Einzelne Akzentwörter als **solide** Akzentfarbe
  (`text-primary` / `text-coral`), kein Gradient. `gradient-text` bleibt
  reserviert für Brand-Wörter (Home-Hero "Jogge di Balla", Shotcounter-Jahr,
  Harassenlauf-Kampagnen-Hero).
- **Lead**: `text-lg text-muted-foreground max-w-2xl`.
- **Ausrichtung**: `text-center md:text-left` — folgt dem bestehenden
  responsiven Muster (Home-Hero, Shotcounter), statt Voll-Zentrierung.
- **Actions-Slot**: rechts unten ausgerichtet (Desktop) für Admin-Buttons
  (Team "Neues Mitglied", Sponsors "Sponsor hinzufügen").
- **Motion**: ein `MotionDiv` (opacity + y), über `useReducedMotion` gegated.

## Anwendung

| Seite            | Kicker (Stimme)                                        | Titel                | Weitere Änderungen                                                          |
| ---------------- | ------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------- |
| Team             | "Der Verein" (primary, Users-Icon)                     | Unser **Team**       | Admin-Dialog-Trigger in Actions-Slot                                        |
| Events           | "Rückblick" (primary, Calendar-Icon)                   | Events & **Fotos**   | Gross-Icon-Kreis entfernt, Gradient ersetzt                                 |
| Sponsors         | "Unsere Partner" (coral, Heart-Icon)                   | Unsere **Sponsoren** | Admin-Button in Actions-Slot, Gradient ersetzt                              |
| Contact          | "Kontakt" (primary, Mail-Icon)                         | Schreib uns          | Gross-Icon entfernt                                                         |
| Dienstleistungen | "Vermietung · DJ · Fotografie" (primary, Package-Icon) | Dienstleistungen     | Gradient ersetzt                                                            |
| Impressum        | "Rechtliches" (primary)                                | Impressum            | Doppelte CardTitle entfernt, Card-Chrome durch typografische Spalte ersetzt |
| Datenschutz      | "Rechtliches" (primary)                                | Datenschutzerklärung | dito                                                                        |

**Ein-Zeilen-Fixes (Product-Surfaces, keine PageHeader-Migration):**

- `Goennermitglieder.tsx`: gradient-text auf Titel → solider Foreground
- `admin/Dashboard.tsx`: gradient-text auf Titel → solider Foreground

**Explizit nicht angefasst:** Home, Harassenlauf, Shotcounter (bespoke
Heroes, committed identity), NotFound (bereits Brand-konform).

## Verifikation

- `pnpm check`, `pnpm lint`, `pnpm build`
- Playwright-Visual-Baselines für contact, impressum, datenschutz,
  dienstleistungen aktualisieren (`pnpm test:e2e:update-snapshots`)
