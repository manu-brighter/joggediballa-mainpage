---
name: Jogge di Balla
description: Vereinswebsite — frech, energisch, selbstbewusst.
colors:
  primary: "oklch(0.55 0.140 195)"
  primary-foreground: "oklch(1.00 0.000 0)"
  coral: "oklch(0.68 0.180 18)"
  coral-foreground: "oklch(1.00 0.000 0)"
  background: "oklch(0.99 0.002 250)"
  foreground: "oklch(0.18 0.012 260)"
  card: "oklch(1.00 0.000 0)"
  muted: "oklch(0.96 0.005 250)"
  muted-foreground: "oklch(0.50 0.020 260)"
  border: "oklch(0.90 0.010 250)"
  ring: "oklch(0.55 0.140 195)"
  destructive: "oklch(0.55 0.22 25)"
  warning: "oklch(0.80 0.15 85)"
  pending: "oklch(0.70 0.17 50)"
  success: "oklch(0.65 0.15 145)"
  gold: "oklch(0.78 0.16 86)"
  background-dark: "oklch(0.13 0.015 260)"
  foreground-dark: "oklch(0.99 0.002 250)"
  card-dark: "oklch(0.16 0.015 260)"
  primary-dark: "oklch(0.70 0.120 195)"
  coral-dark: "oklch(0.74 0.160 18)"
typography:
  display:
    fontFamily: "Inter Variable, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "'cv11', 'ss01', 'ss03'"
  headline:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.75rem"
  xl: "1rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
  button-coral:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.coral-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.125rem 0.5rem"
---

# Design System: Jogge di Balla

## 1. Overview

**Creative North Star: "Das Vereinslokal nach dem Spiel"**

Wärme, lautes Reden, Bier auf dem Tisch, alle kennen alle. Die Energie kommt
aus Gemeinschaft, nicht aus Profi-Sport-Pose. Das System balanciert zwei
Pole: **Teal** als ruhige, vertrauenswürdige Hausfarbe (die Wände der Beiz)
und **Coral** als laute, schreiende Akzentstimme (das Trikot des Goalies,
der eine Tor schreit). Neutrals sind leicht kühl gestimmt (Blue-Grey, Hue
250–260), damit das Coral nicht warm-warm im Vereinsfest-Klischee landet.

Was das System explizit zurückweist: glatte Sponsoren-SaaS-Ästhetik (kein
Stripe-Stil), generische Sportvereins-Templates (kein Stadion-Foto-Hero mit
drei "Aktuelles/Termine/Galerie"-Cards), trockenes Behörden-Layout (keine
Gemeinde-Mitteilungs-Optik). Wenn ein Bereich austauschbar wirkt, ist er
falsch — auch wenn die Form technisch sauber ist.

**Key Characteristics:**

- OKLCH durchgängig (Layer 1 Primitives), keine `#000`/`#fff`-Werte
- Drei-Layer-Token-Architektur (Primitives → Semantic → Tailwind Theme)
- shadcn/ui als Komponenten-Basis, eigene Brand-Accent-Tokens (`--coral`, `--brand`)
- Mobile-first auf Brand-Surfaces; desktop-first auf Product-Surfaces, mobile bedienbar
- Motion via Framer Motion + CSS-Keyframes mit `ease-out`; `prefers-reduced-motion` respektiert

## 2. Colors

Die Palette spielt **Teal vs. Coral** gegen kühle Neutrals — keine warmen Browns,
kein Schwarz, kein Weiß als Reinwert.

### Primary

- **Primary** (`oklch(0.55 0.140 195)`, `--teal-500`): Brand-Hausfarbe.
  Default-CTAs, Links, Focus-Ring, Glow-Pulse für `#1`-Team-Highlight,
  Recharts-Serie-1. Dark-Mode shifted auf `--teal-400` (`oklch(0.70 0.120 195)`).

### Secondary

- **Coral** (`oklch(0.68 0.180 18)`, `--coral-500`): Laute zweite Brand-Stimme.
  Brand-Akzent-Pills, Herzen, gradient-text in `from-primary to-coral`,
  hero-gradient-Hintergrund. NICHT für Standard-Buttons (das macht `Primary`) —
  Coral ist eine Akzent-Stimme, kein zweiter Default.

### Tertiary

- **Twitch** (`#9146ff` / `#a970ff` dark): Externer Brand-Pflicht-Wert für
  Twitch-Overlays. Nicht für UI-Akzente außer im Twitch-Kontext.

### Neutral

- **Background** (`oklch(0.99 0.002 250)`, `--neutral-50`): Page-Background.
- **Card** (`oklch(1.00 0.000 0)`, `--neutral-0`): Container-Surface (Light-Mode-Ausnahme:
  reines Weiß als Card auf cool-getöntem Background, um den Layer-Effekt zu setzen).
- **Foreground** (`oklch(0.18 0.012 260)`): Body-Text. Bewusst als expliziter Wert
  gesetzt, nicht als `--neutral-950` — letzteres wirkte gegen den hellen
  Background zu hart. Dark-Mode nutzt `--neutral-50`.
- **Muted-Foreground** (`oklch(0.50 0.020 260)`, `--neutral-500`): Captions, Helper-Text, Labels.
- **Border** (`oklch(0.90 0.010 250)`, `--neutral-200`): Divider, Card-Border, Input-Border.

`--neutral-200` und `--neutral-500` sind bewusst dunkler gehalten als eine
gleichmässige Skala ergäbe: hellere Werte liessen Borders und Helper-Text im
Light-Mode ausgewaschen wirken.

Die Hue-Verschiebung der Neutrals von 250 (sehr helle Werte) zu 260 (mittlere
und dunkle) ist Absicht: hellere Tones bleiben fast neutral, dunklere kippen
leicht ins Blau-Graue für mehr Kühle.

### Status

- **Destructive** (`oklch(0.55 0.22 25)`): Errors, Delete, fehlgeschlagene Aktionen.
- **Warning** (`oklch(0.80 0.15 85)`): Zukünftige Vorsicht (Mitgliedschaft läuft ab).
- **Pending** (`oklch(0.70 0.17 50)`): In Arbeit / wartet auf Aktion (z.B.
  provisorische Gönnermitglieder) ODER bewusste Aufmerksamkeit-Beachten-Optik
  auf einem nicht-kritischen Hinweis-Block.
- **Success** (`oklch(0.65 0.15 145)`): Bestätigungen.
- **Gold** (`oklch(0.78 0.16 86)`): Achievement- / Winner-Marker. Bewusst getrennt
  von `Warning`, obwohl beide Gelb-Familie — die Semantik ist feierlich, nicht
  vorsichtig. Verwendet für SDK-Overlay-Gewinner und den Gold-Akzent auf
  Dienstleistungen.

### Named Rules

**The Two-Voice Rule.** Teal und Coral werden gemeinsam nur in expliziten
Brand-Momenten verwendet (gradient-text, hero-gradient, Logo-Patterns).
Eine Seite mit beidem als "normale" UI-Akzente verliert sofort die Hierarchie.
Ein Surface hat einen Hauptakzent.

**The Cool-Neutral Rule.** Keine warmen Beige- oder Brown-Neutrals. Wenn ein
Grau warm wirkt, ist es falsch konfiguriert. Hue ≥ 250, Chroma ≤ 0.020.

**The Pending-As-Attention Rule.** Orange-Pending darf für bewusste
Aufmerksamkeitslenkung verwendet werden (nicht nur strikt "wartet auf Aktion").
Das ist Absicht; siehe die Status-Pills und Hinweis-Blöcke auf
`Goennermitglieder` als Referenz.

## 3. Typography

**Display Font:** Inter Variable (self-hosted via `@fontsource-variable/inter`)
**Body Font:** Inter Variable
**Fallbacks:** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

**Character:** Eine einzige Schriftart über alle Hierarchien — Inter mit
Variations-Achse für Gewicht-Kontrast statt Familien-Mix. Die OpenType-Features
`cv11`, `ss01`, `ss03` sind global aktiv (`font-feature-settings` in `body`):
zweistöckiges `a`, charaktervolle `g`-Form, verbesserte Ziffern. Inter
default-vibe wird damit subtil ins Charaktervolle geschoben — keine generische
SaaS-Schrift mehr.

### Hierarchy

- **Display** (800, `clamp(2.25rem, 5vw, 3.75rem)`, line-height 1.05, letter-spacing -0.02em):
  Hero-Headlines auf Brand-Surfaces (Home-Hero, Section-Opener).
- **Headline** (700, `clamp(1.5rem, 3vw, 2.25rem)`, line-height 1.15): Page-Titel,
  Section-Header zweiter Ordnung.
- **Title** (600, `1.125rem`, line-height 1.3): Card-Titel, List-Item-Header,
  Form-Group-Header.
- **Body** (400, `0.875rem`, line-height 1.55): Default-Text. Auf Touch-Devices
  rendert Tailwind `text-base` (1rem), erst ab `md:` rückt es auf `text-sm`.
- **Label** (500, `0.75rem`, line-height 1.4, letter-spacing 0.02em): Form-Labels,
  Badges, Status-Pills.

### Named Rules

**The Single-Family Rule.** Inter Variable trägt alle Hierarchien. Kein
Display-Serif, kein Mono-Akzent (außer wenn explizit für Code/Tabular-Numbers
gewünscht). Variations-Achse ersetzt Familien-Mix.

**The Mobile-Body-Bump Rule.** Body-Inputs und -Text starten auf Mobile bei
`1rem` (16px), um iOS-Zoom-on-Focus zu unterdrücken. Ab `md:` Breakpoint
runter auf `0.875rem`. Nicht umkehrbar.

## 4. Elevation

Das System ist **flach-by-default mit punktueller Schatten-Reaktion**. Karten
sitzen auf der Fläche (`shadow-sm` als Ruhezustand), Hover hebt sie an
(`shadow-lg` + `-translate-y-1` via `.card-hover`). Echte z-Schichten gibt es
nur bei Overlay-Komponenten (Popover, Dialog, Dropdown, Tooltip) — und einem
Brand-Sondereffekt: dem `glow-primary` (Box-Shadow-Pulse in Primary-Color,
Animation für `#1`-Team auf dem Shotcounter).

### Shadow Vocabulary

- **shadow-xs** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): Inputs,
  Outline-Buttons. Andeutung von Tiefe ohne sichtbaren Schatten.
- **shadow-sm** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`):
  Default-Card-Ruhezustand.
- **shadow-lg** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`):
  Card-Hover, gehobene Surfaces, Dropdown-Open.
- **glow-primary** (animated, `0 0 20–60px var(--glow-base) ... var(--glow-spread)`):
  Pulsierender Brand-Glow. Reserviert für Tabellen-Top-Rang im Shotcounter.

### Named Rules

**The State-Response-Only Rule.** Schatten erscheinen als Antwort auf State
(Hover, Open, Focus), nicht als Ruhe-Dekoration. Eine Card im Ruhezustand
hat `shadow-sm` (Andeutung), aber nichts Größeres.

**The Glow-Is-Earned Rule.** `glow-primary` ist kein UI-Akzent — er markiert
echte Spitzenleistung (Rang #1). Nicht für Hover-Highlights, nicht für
Active-States. Inflationary Glow tötet seine Bedeutung.

## 5. Components

Komponenten basieren auf **shadcn/ui** (Radix-Primitives + CVA-Varianten).
Eigene Brand-Tokens werden in die shadcn-Vocabulary eingebettet (`--coral`,
`--brand`, `--twitch`), nicht als Parallelsystem geführt.

### Buttons

- **Shape:** `rounded-md` (0.625rem) für default/destructive/outline/secondary/ghost.
  Größere Buttons (size=lg) bleiben auf `rounded-md` — Radien skalieren nicht
  mit Größe.
- **Default:** `bg-primary text-primary-foreground`, Hover `bg-primary/90`,
  Press `active:scale-95` (via `.btn-animate`-Util, optional).
- **Destructive:** `bg-destructive text-white`, Hover `bg-destructive/90`.
- **Outline:** transparenter Background, `border`, Hover füllt mit `bg-accent`.
- **Secondary:** `bg-secondary text-secondary-foreground` — bewusst neutral,
  KEIN Coral als "zweite Default-Variante".
- **Ghost:** Nur Hover-Background (`bg-accent`), kein Border, kein Default-Fill.
- **Link:** Underline-Offset-4 auf Hover, `text-primary`.
- **Focus:** `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`
  durchgängig auf allen Buttons + Inputs. Kein Custom-Focus-Style pro Komponente.
- **Sizes:** `default` (h-9), `sm` (h-8), `lg` (h-10), plus icon-Sizes (size-8/9/10).

### Cards / Containers

- **Corner Style:** `rounded-xl` (1rem). Größerer Radius als Buttons —
  Container weicher als Action-Elemente.
- **Background:** `bg-card` (Light: reines Weiß; Dark: `--neutral-900`).
- **Shadow Strategy:** `shadow-sm` im Ruhezustand. `card-hover`-Klasse fügt
  `transition-all duration-300 ease-out` + Hover `-translate-y-1 shadow-lg`.
- **Border:** `border` (1px, `--neutral-200` light / `--neutral-700` dark).
- **Internal Padding:** `py-6` (Card-Wrapper) + `px-6` (Header/Content/Footer),
  Slots durch `gap-6` getrennt.

### Inputs / Fields

- **Style:** `h-9`, `rounded-md`, `border`, `bg-transparent` (Light) /
  `bg-input/30` (Dark), `shadow-xs`, `px-3 py-1`.
- **Default Font-Size:** `text-base` (1rem) auf Mobile, `md:text-sm` ab Breakpoint.
- **Focus:** `border-ring` + `ring-ring/50 ring-[3px]` (gleicher Style wie Button).
- **Error:** `aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40
  aria-invalid:border-destructive`.

### Navigation

- Wouter-basiert. Aktive Links via `text-primary`, hover via `text-foreground`.
- Mobile: Burger-Menu (separat von Profile-Menu, mutex). Desktop: Inline-Nav.
- Footer: persistent auf allen Routen außer Beamer-Mode.

### Brand-Patterns

- **gradient-text** (`bg-clip-text linear-gradient(135deg, primary, coral)`):
  TROTZ des allgemeinen "Gradient-Text"-Vorbehalts hier ein bewusstes
  Brand-Pattern. Nur sparsam einsetzen — nicht für regulären Body, nicht
  in Cards-Reihen, nicht für CTAs. Reserviert für Brand-Wort-Highlights
  ("Jogge di Balla" im Hero, einzelne Akzent-Wörter in großen Headlines).
- **hero-gradient** (10–15%-Transparenz-Gradient `from-primary to-coral`):
  Hintergrund-Wash für Hero-Sections. Light-Mode 92% transparent, Dark-Mode
  85% — sichtbar warm, aber nie konkurrierend mit dem Foreground.
- **glow-primary** (animierter Box-Shadow-Pulse): Siehe Elevation, nur für
  Top-Rang im Shotcounter.

### Beamer-Mode

Fullscreen-Overlay auf dem Shotcounter (`.beamer-mode`). Versteckt Navigation
+ Footer. Hintergrund: `var(--background)`. Auto-Exit auf Route-Change oder
Escape. Scrollbar visuell entfernt (Inhalt bleibt scrollbar). Distinct vom
regulären Shotcounter-Layout — größere Typo, mehr Whitespace.

## 6. Do's and Don'ts

### Do:

- **Do** OKLCH durchgängig verwenden. Wenn du eine Farbe brauchst, die nicht
  als Token existiert: erst Layer-2-Token erweitern, nicht Hex inlinen.
- **Do** Brand-Surfaces (Home, Team, Events, Dienstleistungen, Sponsoren, Kontakt)
  **mobile-first** entwerfen und nach oben skalieren.
- **Do** Product-Surfaces (Admin-Dashboard, Gönnermitgliederverwaltung,
  Anwesenheits-Tracking) **desktop-first** entwerfen — Tabellen, Bulk-Aktionen,
  Filter brauchen Platz. Mobile-Variante priorisiert den Funktionsumfang
  (nicht Read-only).
- **Do** Wortwitz im Copy als Designentscheidung behandeln. Button-Label,
  Empty-State, 404, Error-Toast — überall Vereinston, nirgends generisch.
- **Do** Coral und Teal als zwei separate Stimmen einsetzen. Wenn beide
  gleichzeitig auf einem Surface laut werden, geht die Hierarchie verloren.
- **Do** `prefers-reduced-motion` respektieren — sowohl CSS-Animations
  (bereits in `index.css`) als auch Framer-Motion via `useReducedMotion()`.

### Don't:

- **Don't** raw Tailwind-Paletten-Farben verwenden (`text-red-500`, `bg-orange-500`,
  `text-[#0B93A7]`). Jede Farbe muss durch Layer 2, sonst kippt Dark-Mode +
  zukünftige Theme-Swaps.
- **Don't** `#000` oder `#fff` direkt schreiben. Neutrals sind cool-getönt
  (`--neutral-0` ist Pflicht-Weiß für Cards, nicht `#fff`).
- **Don't** die Seite wie eine **generische Sportverein-Site** aussehen lassen:
  kein riesiges Stadion-Foto-Hero, keine "Aktuelles / Termine / Galerie"-
  Card-Reihen, kein 08/15-Template-Layout.
- **Don't** in eine zweite, glattere Brand-Stimme rutschen, sobald Sponsoren
  oder Förderer ins Bild kommen. **Kein Corporate / Sponsor-SaaS-Look.**
- **Don't** ein **trockenes Behörden-Layout** bauen. Wenn ein Bereich "wie
  eine Gemeinde-Website" wirkt, ist er falsch — auch wenn die Information
  korrekt ist.
- **Don't** `gradient-text` inflationär einsetzen. Reserviert für Brand-Worte
  in großen Headlines; nicht für Body, nicht für CTAs, nicht in Card-Reihen.
- **Don't** `glow-primary` als Hover-Akzent missbrauchen. Glow markiert Rang
  #1, sonst nichts.
- **Don't** Secondary-Button mit Coral umfärben, "weil das mehr Brand wäre".
  Secondary ist bewusst neutral; Coral lebt in Akzenten, nicht in Default-Aktionen.
- **Don't** auf Product-Surfaces Read-only-Mobile-Views ausliefern. Funktioniert
  reduziert > funktioniert nicht.
- **Don't** Side-Stripe-Borders (`border-left` > 1px als gefärbter Akzent) auf
  Cards, Alerts oder List-Items verwenden. Volle Borders oder Background-Tints.
