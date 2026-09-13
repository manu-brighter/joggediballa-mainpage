# Kassensystem — Stations-Split & Nitpicks — Design Spec

**Datum:** 2026-09-12
**Branch:** `feat/kasse-station-split`
**Vorgänger:** [2026-08-27-kassensystem-requirements.md](./2026-08-27-kassensystem-requirements.md)

## Problem

Beim letzten Event liefen Küche und Bar auf iPads mit demselben
`KasseStation`-Screen, der Kategorienfilter ist reines Freitext-Gerätesetting
(`category: varchar`, localStorage-Filter, siehe `client/src/lib/kasse.ts` /
`KasseStation.tsx`). Eine Bestellung ist serverseitig **eine** Zeile mit
**einem** Status. Enthielt eine Bestellung Essen und Getränke zusammen, hat
z. B. die Bar auf „bereit" geklickt, sobald die Getränke fertig waren — obwohl
das Essen noch nicht so weit war. Die ganze Bestellung sprang auf „bereit",
das Servicepersonal wurde falsch informiert. Notlösung am Event: Bestellungen
manuell in getrennte Häppchen (Essen / Getränke) aufteilen.

Zusätzlich gewünscht: eigene Rollen für Getränke-/Essensbringer, durchgehend
sichtbarer Servicename, kein Scrollen für abholbereite Bestellungen,
alphabetische Sortierung der Positionen, feinere Zeit-Eskalation.

## Entscheidung: Kategorien als Entities mit fester Station

Kategorien werden von Freitext zu einer eigenen Tabelle. **Flaches Modell**,
keine Food/Drinks-Oberkategorie-Hierarchie — bei genau zwei Stationen bringt
eine zweite Ebene keinen funktionalen Vorteil, nur zusätzlichen Code:

```
kasse_categories
  id, name, station enum('kueche','bar') NOT NULL,
  displayOrder, isActive, createdAt, updatedAt, createdBy
```

`station` nutzt dieselben String-Werte wie `StationConfig['id']` in
`KasseStation.tsx` (`'kueche' | 'bar'`), keine separate Übersetzung.

`kasse_products.category` (varchar) wird zu `categoryId INT NOT NULL`
(FK → `kasse_categories.id`). Die Verwaltung bekommt ein Pflicht-Dropdown
statt Freitext-Feld (Control-Screen, `createProduct`/`updateProduct`).

`kasse_order_items.productCategory` bleibt als **Label-Snapshot** (String)
bestehen — gleiches Prinzip wie `productName`/`optionName`: die Anzeige einer
bereits abgeschickten Bestellung darf sich nicht rückwirkend ändern, wenn
jemand später eine Kategorie umbenennt oder ihre Station wechselt.

## Entscheidung: Split nach Station beim Senden

`kasse_orders` bekommt ein Pflichtfeld `station enum('kueche','bar') NOT NULL`.

`createOrder` gruppiert die eingereichten Positionen serverseitig nach
`category.station` und legt **eine Order pro betroffener Station** an (bei
reiner Food- oder reiner Drink-Bestellung weiterhin nur eine, wie heute).
Tisch, Servicename und Notiz werden auf jedes entstandene Ticket dupliziert.

Die entstandenen Tickets sind danach **vollständig unabhängig**: eigener
Status (`pending → ready → delivered`/`cancelled`), eigenes Storno, keine
Verknüpfung/Kaskade zwischen ihnen. Kein `groupId` in dieser Iteration — Tisch
+ nahezu identischer Zeitstempel reichen zur visuellen Zuordnung, eine
zusätzliche Kopplung wäre Komplexität ohne belegten Bedarf.

`createOrder` liefert `{ orders: [{ orderId, station, totalRappen }], totalRappen }`
zurück (Summe für den bisherigen Preis-Änderungs-Check in `KasseService.tsx`).

**Folge:** `listOpenOrders` / `listClosedOrders` bekommen einen optionalen
`station`-Parameter, gefiltert per SQL (`eq(kasseOrders.station, ...)`) statt
der jetzigen `categoryKeys`-EXISTS-Subquery. Küche/Bar rufen mit ihrer
Station auf, Service ruft **ohne** Filter (sieht beide Stationen gemischt —
Bestellaufnahme ist immer gemischt).

Damit entfällt der komplette „unassigned"-Zweig in `KasseStation.tsx`
(`forStation`, `unassigned`-Sektion, Sicherheitsnetz-Kommentar): eine
Bestellung kann strukturell nur noch Positionen der eigenen Station enthalten,
weil der Split schon beim Anlegen passiert ist. Der bestehende
Geräte-Kategorienfilter (Sheet, „nur Shots zeigen") bleibt als Sub-Filter
**innerhalb** der eigenen Station bestehen.

## Rollen — kein neuer Screen nötig

- **Service (Bestellaufnahme):** `KasseService.tsx`, Tab „Bestellen" — immer
  volle Speisekarte, unverändert.
- **Getränke-/Essensbringer (reine Lauf-Rollen):** dieselbe `KasseService.tsx`,
  Tab „Offen" — bekommt eine **zweite, orthogonale Filterachse** neben dem
  bestehenden „Meine/Alle" (`ORDER_SCOPE_KEY`): „Alle Stationen" / „Nur Küche"
  / „Nur Bar", Geräte-Setting wie die anderen Filter (localStorage). Ein
  Essensbringer stellt sein Handy einmal auf „Nur Küche" und sieht dort nur
  Food-Tickets zum Abholen/Servieren.
- **Küche/Bar:** `KasseStation.tsx`, wie gehabt, jetzt serverseitig gefiltert.

## Migration

Da es kein `drizzle/migrations`-Verzeichnis gibt (siehe `drizzle/CLAUDE.md`),
als Kommentar im Schema, manuell auf der laufenden DB auszuführen:

```sql
CREATE TABLE kasse_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  station ENUM('kueche','bar') NOT NULL,
  displayOrder INT NOT NULL DEFAULT 0,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP NOT NULL DEFAULT (now()),
  updatedAt TIMESTAMP NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  createdBy INT NULL REFERENCES users(id)
);

-- Je bisherigem distinktem `category`-String eine Zeile anlegen
-- (Station vorerst 'kueche' als Default, im Control-Screen pro Kategorie
-- vor dem nächsten Event korrigieren — inkl. Produkte ohne Kategorie, die
-- automatisch in eine Kategorie "Weiteres" wandern).
-- Danach:
ALTER TABLE kasse_products ADD COLUMN categoryId INT NULL AFTER category;
-- UPDATE ... categoryId anhand des Namens setzen ...
ALTER TABLE kasse_products MODIFY COLUMN categoryId INT NOT NULL;
ALTER TABLE kasse_products DROP COLUMN category;

ALTER TABLE kasse_orders ADD COLUMN station ENUM('kueche','bar') NULL AFTER tableName;
-- UPDATE bestehender offener/historischer Orders anhand ihrer Positionen
-- (falls gemischt: der Session-Historie halber der Kategorie der ersten
-- Position zuordnen, wirkt sich nur auf Alt-Daten vor dem Rollout aus) ...
ALTER TABLE kasse_orders MODIFY COLUMN station ENUM('kueche','bar') NOT NULL;
```

**Wichtig:** Bevor die nächste Kasse geöffnet wird, muss im Control-Screen
jede migrierte Kategorie einmal auf die richtige Station geprüft werden
(Default „Küche" ist nur ein Platzhalter).

## Weitere Anpassungen (Nitpicks, im selben Zug)

- **Servicename überall sichtbar:** fehlt aktuell auf den „Bereit"- und
  „Abgeschlossen"-Karten in `KasseStation.tsx` (nur bei „Zu erledigen"
  vorhanden) — ergänzen.
- **Kein Scrollen für Abholbereites:** „Zu erledigen" und „Bereit" nebeneinander
  in zwei Spalten ab `xl`-Breakpoint statt untereinander.
- **Alphabetische Sortierung** der Positionen innerhalb einer Bestellkarte
  (Küche/Bar/Service), rein für die Anzeige, nicht die Speicherreihenfolge.
- **Zeit-Eskalation** (`urgency()` in `client/src/lib/kasse.ts`): bisher
  `<5′` normal, `5–10′` gelb, `≥10′` rot. Neu vier Stufen: `<5′` normal,
  `5–10′` gelb (wie heute), `10–30′` rot (wie heute), `30–60′` intensiver
  (dunkleres Rot), `≥60′` am intensivsten (z. B. zusätzlich pulsierend).

## Nicht Teil dieser Spec

- Android-Icon-Rendering-Problem in `KasseService.tsx`-Buttons (nur auf
  Android beobachtet, iPhone unauffällig) — eigener kleiner Bugfix, sobald
  genauer beschrieben/reproduziert, unabhängig von obigem Umbau.
