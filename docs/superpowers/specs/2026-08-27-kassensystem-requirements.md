# Kassensystem — Anforderungen (Diktat vom 27.08.2026)

Versteckte Seite nach dem Muster von Shotcounter, SDK-Overlay und Live-Diashow:
kein Link in der Navigation, Zugang nur über die direkte URL bzw. über die
Admin-Oberfläche.

## Zweck

Online-Kassen- und Bestellsystem für unsere Events. Es löst den Weg des
Servicepersonals zurück in die Küche ab: Bestellungen werden direkt am Tisch auf
dem Handy erfasst und landen sofort in der Küche.

## Rollen und Geräte

- **Servicepersonal — Handy.** Nimmt Bestellungen am Tisch auf, schickt sie in
  die Küche, sieht den Status der laufenden Bestellungen, holt fertige
  Bestellungen ab und schliesst sie nach dem Servieren ab.
- **Küche — Tablet (iPad, Landscape).** Sieht die eingehenden Bestellungen als
  Liste/Tabelle, arbeitet sie der Reihe nach ab und meldet sie als bereit.
- **Admin/Settings — Desktop.** Pflegt Produkte, Zusätze, Preise und Tische.

## Ablauf

1. Servicepersonal wählt den Tisch (Tischnummerierung durchgehend: A1, A2, B1,
   B2 …) und klickt die Produkte an — inkl. Menge und optionalem Zusatz.
2. Bestellung wird abgeschickt und erscheint sofort in der Küche.
3. Küche sieht die Bestellung, arbeitet sie ab und bestätigt mit **einem
   einzigen, genügend grossen Knopf**: „bereit".
4. Alle Servicemitarbeitenden sehen auf dem Handy, dass die Bestellung für
   diesen Tisch bereit ist, und holen sie ab.
5. Nach dem Ausliefern klickt das Servicepersonal „Bestellung abgeschlossen".

## Produkte und Zusätze

- Seite zum Anlegen von Produkten.
- Produkte haben optionale Unterkategorien/Zusätze. Beispiel: Produkt „Pommes
  Frites" mit den Zusätzen „Ketchup", „Mayo", „ohne".
- Ist alles voreingestellt, muss das Servicepersonal nur noch anklicken: welches
  Produkt, mit welchem Zusatz oder ohne Zusatz.
- Der Preis bleibt während des ganzen Events gleich und muss unterwegs nicht
  angepasst werden.
- Trotzdem braucht es eine Settings-Seite, auf der man adminmässig alle Produkte
  nachträglich anpassen kann.

## Küchenansicht (Tablet, Landscape)

- Bestellungen als Tabelle, **älteste zuoberst**, damit die Küche der Reihe nach
  abarbeitet.
- Farblich codiert nach Status (z. B. neu/pending gelb).
- Grosser Bestätigungsknopf „bereit" pro Bestellung.

## Serviceansicht (Handy)

- Bestellaufnahme: Tisch wählen, Produkte mit Menge und Zusatz anklicken,
  abschicken.
- Übersicht der aktuellen Bestellungen mit Status.
- Sichtbare Meldung, sobald eine Bestellung bereit ist.
- Knopf „Bestellung abgeschlossen" nach dem Ausliefern.

## History / Auswertung

Am Ende des Events wollen wir sehen:

- wie viel Geld eingenommen wurde,
- wie viel von welchem Produkt verkauft wurde,

damit wir einen guten Überblick über das Event bekommen: was wurde verbraucht,
was müssen wir beim nächsten Mal einkaufen.
