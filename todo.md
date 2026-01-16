# Jogge di Balla - Projekt TODO

## Phase 1: Projektstruktur und Vorbereitung
- [x] Projekt initialisieren mit web-db-user Template
- [x] Logo-Dateien in public/ kopieren
- [x] TODO-Liste erstellen

## Phase 2: Datenbank-Schema
- [x] User-Tabelle um Rollen erweitern (admin, maintainer, editor, public)
- [x] Shotcounter-Tabelle erstellen (Teams, Scores, Jahr-Persistenz)
- [x] Shotcounter-Audit-Log-Tabelle erstellen
- [x] Sponsoren-Tabelle erstellen
- [x] Events-Tabelle erstellen
- [x] Fotos-Tabelle erstellen
- [x] Team-Mitglieder-Tabelle erstellen
- [x] Feature-Toggles-Tabelle erstellen
- [x] Kontaktformular-Submissions-Tabelle erstellen
- [x] Datenbank-Migration durchführen (pnpm db:push)

## Phase 3: Authentifizierung und Rollenverwaltung
- [x] Rollenverwaltung in Auth-System integrieren
- [x] adminProcedure für Admin-Only-Zugriff erstellen
- [x] maintainerProcedure für Maintainer-Zugriff erstellen
- [x] editorProcedure für Editor-Zugriff erstellen
- [x] Rollen-Middleware in tRPC implementieren

## Phase 4: Design-System und Layout
- [x] Farbschema aus Logo extrahieren (Coral-Rot #FF5A6B, Teal-Blau #1B9BA8)
- [x] Globale CSS-Variablen in index.css definieren
- [x] Dark/Light Mode Theme-System konfigurieren
- [x] Hauptnavigation mit Logo erstellen
- [x] Footer-Komponente erstellen
- [x] Responsive Layout-Wrapper erstellen

## Phase 5: Shotcounter-Feature
- [x] Shotcounter-Backend-Logik (CRUD für Teams)
- [x] Shotcounter-Tabelle mit Sortierung
- [x] Aktionen: +1, +5, freie Eingabe
- [x] Countdown bis Silvester
- [x] Gewinner-Popup bei Jahreswechsel
- [x] Manueller Reset (nur Admin)
- [x] Audit-Log für alle Änderungen
- [x] Beamer-Modus (Vollbild, große Schrift)
- [x] Shotcounter-Frontend-UI

## Phase 6: Admin-Dashboard
- [x] Admin-Dashboard-Layout
- [x] User-Verwaltung (Liste, Rollen ändern)
- [x] Feature-Toggles-Verwaltung
- [x] Shotcounter-Reset-Funktion
- [x] Audit-Log-Ansicht
- [x] Admin-Navigation

## Phase 7: Öffentliche Seiten - Teil 1
- [x] Homepage: Vereinsvorstellung
- [x] Homepage: Nächstes Event anzeigen
- [x] Homepage: Instagram-Feed-Integration
- [x] Team-Seite: Mitglieder-Grid
- [x] Team-Seite: Mitglieder-Vorstellung
- [x] Sponsoren-Seite: Grid-Layout
- [x] Sponsoren-Verwaltung (Maintainer: hinzufügen/löschen)

## Phase 8: Events und Fotos
- [x] Events-Liste (nach Datum sortiert)
- [x] Event-Detail-Seite
- [ ] Foto-Upload (Maintainer) - Backend vorhanden, Frontend TODO
- [x] Foto-Galerie mit Lightbox
- [x] Lazy Loading für Bilder
- [x] Copyright-Hinweis "Fotos © Manuel Heller"
- [x] Kontakt-Hinweis für Foto-Anfragen

## Phase 9: Kontakt und Rechtliches
- [x] Kontaktformular mit Validierung
- [x] Honeypot-Feld gegen Spam
- [ ] SMTP-Integration für E-Mail-Versand - Backend vorhanden, SMTP TODO
- [x] Erfolgs-/Fehler-Meldungen
- [x] Impressum-Seite
- [x] Datenschutzerklärung-Seite
- [ ] Cookie-Hinweis (optional) - Nicht benötigt

## Phase 10: SEO und Performance
- [x] Meta-Tags für alle Seiten
- [x] Semantisches HTML überprüfen
- [x] Alt-Texte für alle Bilder
- [x] Saubere URLs konfigurieren
- [x] Performance-Optimierung (Lazy Loading, Code Splitting)
- [ ] Lighthouse-Score überprüfen - Kann nach Deployment erfolge## Phase 11: Testing und Deployment
- [x] Vitest-Tests für kritische Backend-Funktionen schreiben
- [x] Shotcounter-Tests
- [x] Auth-Tests
- [x] Deployment-Dokumentation erstellen
- [x] README.md aktualisieren, Safari)
- [ ] Mobile-Testing (iOS, Android)
- [ ] Checkpoint erstellen
- [ ] Deployment-Dokumentation


## UI/UX Redesign Iteration

### Dark Mode
- [x] System-Erkennung für Dark/Light Mode
- [x] Manueller Toggle in Navigation
- [x] Konsistente Dark Mode Farben

### Homepage Redesign
- [x] Stärkere Hero-Section mit Animationen
- [x] Kreatives Layout, weniger textlastig
- [x] Logo-Skalierung auf Mobile korrigieren

### Shotcounter Redesign
- [x] Moderne Tabellen-UI mit hohem Kontrast
- [x] Animierter Rahmen/Glow für #1 Team
- [x] Buttons: -1, +1, +5 (kein "freier Wert")
- [x] Klickbarer Shot-Count mit Inline-Edit
- [x] Custom Modal für Team-Löschung

### Beamer-Modus
- [x] Echter Fullscreen-Modus
- [x] Alle UI-Elemente ausblenden
- [x] Subtiler Exit-Button
- [x] Auf Mobile: Beamer-Button verstecken
- [x] Bug Fix: Exit aus Beamer-Modus ermöglichen

### Mobile UX
- [x] Bessere Abstände und Skalierung
- [x] Kleineres Logo
- [x] Größere Tap-Targets für Buttons
- [x] Footer kompakt und zentriert

### Profilbild-Upload
- [x] User können Profilbild hochladen
- [x] Avatar-Anzeige in Navigation

### Gönnermitgliederverwaltung (Neue Seite)
- [x] Datenbank-Schema für Gönnermitglieder
- [x] Tabelle mit Vorname, Nachname, Adresse
- [x] Mitgliedschafts-Start und Ablaufdatum
- [x] Verlängerung um 1 Jahr (mit Modal)
- [x] Löschen mit Bestätigungs-Modal
- [x] Aktive/Abgelaufene Mitglieder trennen
- [x] Sortierung nach Name, Ablaufdatum, "läuft bald ab"
- [x] Visuelle Zustände: normal, <30 Tage (gelb), abgelaufen (grau/rot)

### Animationen & Styling
- [x] Hover-Animationen für alle interaktiven Elemente
- [x] Page Transitions
- [x] Counter-Animationen
- [x] Keine Browser-Standard-Dialoge

## Bug Fixes
- [x] Fix nested <a> tags error on Homepage
- [x] Fix /profile route 404 error - add route and profile page


## UI/UX Polishing Iteration (Jan 2026)

### Homepage & Navbar
- [x] Homepage Mobile: "Since 2022" Badge Spacing von Navbar korrigieren
- [x] Homepage Mobile: Scroll-Indicator darf Logo nicht überlappen
- [x] Navbar: Transparenz beibehalten, im Dark Mode etwas heller
- [x] Navbar: Optionaler subtiler Farbakzent

### Login-Sichtbarkeit
- [x] Login subtil/versteckt wenn ausgeloggt
- [x] Website sauber für öffentliche Benutzer
- [x] Nach Login: Profilbild und Admin/Maintainer-Aktionen prominent

### Shotcounter Beamer-Mode
- [x] Scaling-Slider für Team-Card-Höhe hinzufügen
- [x] Optimiert für viele Teams auf 16:9 Screen
- [x] Animierte Transitions bei Rangwechsel
- [x] Vereinslogo sichtbar (subtiles Wasserzeichen)n im Hintergrund)

### Profil-Bearbeitung
- [x] Separaten Button entfernen
- [x] Hover über Profilbild: Bild abdunkeln + "Bild ändern" Overlay

### Gönnermitgliederverwaltung
- [x] Sortier-Button Breite korrigieren (voller Text sichtbar)
- [x] Stats-Cards vertikal zentrieren mit gleichem Padding
- [x] Abgelaufene Mitglieder visuell unterscheiden (grau/rot)
- [x] Aktive Mitglieder <30 Tage gelb hervorheben
- [x] Standard-Sortierung: Aktive nach Ablaufdatum, Abgelaufene separat

### Sponsoren
- [x] Logo-Upload implementieren (PNG mit transparentem Hintergrund)
- [x] Preview und Validierung

### E### Events & Fotos
- [x] Events und Foto-Galerie zusammenführen
- [x] Event-Cards mit Titel, Beschreibung, Foto-Galerie
- [x] Eingeloggte User: Events hinzufügen/bearbeiten/löschenn

### Team-Seite
- [x] Eingeloggte User können Mitglieder hinzufügen/entfernen
- [x] Mitglieder-Cards: Name, Spitzname, Rolle, Bild, Beschreibung

### Admin-Dashboard
- [x] Rollen: Admin, Maintainer, Member
- [x] Permissions-Management-Card mit Feature-Tabelle
- [x] Feature Toggles mit echten Toggles:
  - [x] Beamer-Modus Button anzeigen/verstecken
  - [x] Wartungsmodus Toggle

## Google OAuth Migration für Self-Hosting
- [x] Google Cloud Console OAuth Client erstellen
- [x] Backend OAuth-System von Manus auf Google umstellen
- [x] Frontend Login-Flow für Google OAuth anpassen
- [x] Environment-Variablen für Google OAuth dokumentieren
- [x] Session-Management für Self-Hosting optimieren
- [x] Deployment-Anleitung für Root Server erstellen
- [x] README mit Google OAuth Setup-Anleitung aktualisieren


## Bug Fixes - Self-Hosting
- [x] Analytics-Platzhalter entfernen (your-analytics-endpoint.com/umami)
- [x] Login-Redirect für Google OAuth korrigieren (leitet noch zu Manus OAuth)

- [x] Fix Google OAuth redirect_uri_mismatch error - überprüfen ob GOOGLE_CALLBACK_URL korrekt verwendet wird

- [x] Fix Google OAuth session cookie not being set after login - trust proxy hinzugefügt

- [x] Fix "Session payload missing required fields" error after Google OAuth login - appId zum JWT hinzugefügt

- [x] Erstelle README.md mit Projektbeschreibung und Setup-Anleitung


## UI/UX Polish & Functional Fixes (Jan 2026)

### Global Fixes
- [x] Fix nested anchor tag error (<a> cannot contain nested <a>)
- [x] Profile image cropping: non-square images should be cropped, not stretched
- [x] Profile image: add manual crop area selection after upload

### Admin Dashboard - Feature Toggles
- [x] Feature Toggles: instant apply without save button
- [x] Beamer Mode Toggle: hide beamer button in Shotcounter when disabled
- [x] Maintenance Mode Toggle: show maintenance page for non-logged-in users

### Shotcounter
- [x] Slow down rank transition animation slightly
- [x] Reset dialog: choice between "reset shots only" vs "reset everything"

### Navigation & Visibility
- [x] Desktop navbar: add Gönnermitgliederverwaltung with divider
- [x] Divider and menu item hidden for logged-out users

### Mobile Layout Fixes
- [x] Admin Dashboard: fix card overflow causing horizontal scroll
- [x] Cards must fit cleanly within viewport

### File Upload
- [x] Implement self-hosted file upload for photos
- [x] Create setup guide for root server file upload


## Major Update - January 2026

### GitHub & Login
- [x] 1. Pull GitHub changes and integrate them
- [x] 2. After login on local dev, stay on localhost:3000 instead of redirecting to live URL

### Homepage & Events
- [x] 3. "Mehr erfahren" on "Kommendes Event" scrolls to Event card, not "Alle Fotos"
- [x] 4. Events visible for all users (logged out); photos in "Alle Fotos" remain visible
- [x] 5. Increase max upload size for Team and Events images
- [x] 6. Clicking photo in "Alle Fotos" opens bigger almost full-screen preview with modern loader
- [ ] 7. Event cards: allow selecting thumbnail; loader for card thumbnail prioritized

### Team Tab
- [ ] 8. Edit button shows icon instead of empty field
- [x] 9. Mobile: fix cannot remove/edit members
- [x] 10. Add horizontal padding on member cards images to match top padding
- [ ] 11. Uploading new member image uses final card format with manual cropping
- [x] 12. "Neues Mitglied" form always empty, not prefilled with existing member
- [x] 21. Allow manual reordering of members (logged-in only)

### Events Form
- [x] 13. Event time optional; Date field uses datepicker
- [x] 14. Photo view arrows more visible on bright images
- [x] 15. Photo view respects light/dark mode
- [ ] 28. Add/remove padding for images in events
- [ ] 32. Photo upload fix (not always added to the right card)
- [x] 33. Delete Photos in card edit

### Logos & Theming
- [x] 16. Small logos default to "JoggediBalla-Logo.PNG"
- [ ] 17. Homepage large logo default to "Jogge_Di_Balla_Final_Transparent.png"
- [ ] 18. Default site theme follows system

### Contact Form
- [x] 19. Adjust email for self-hosted setup; provide setup instructions

### Gönnermitglieder
- [x] 20. Make counter cards slimmer or redesign; reduce empty space
- [x] 31. Click to show details

### Sponsors
- [x] 22. Add card at bottom: "Werde Sponsor von Jogge di Balla" with Standard & Premium packages

### New Page: Dienstleistungen
- [x] 23. Create "Dienstleistungen" page with:
  - Vermietung (Equipment, Beerpong, etc.)
  - DJ (Kassier - Jan, DJ, image)
  - Fotografie (Vize-Präsi - Manu, link to events and portfolio)
  - Contact link for requests

### Startpage
- [x] 24. Add Gönnermitgliedschaft info: CHF 20.- p.a., giveaways, reduced prices, contact link
- [x] 25. Add Twitch link next to Instagram; code easy extendable for other platforms

### Shotcounter
- [x] 29. Fix "Kartengroesse" slider- [x] 30. Fix teams slightly cut off at the bottom in beamer mode

### Navbar & Admin
- [x] 26. All navbar links toggleable via admin dashboard except Home, Team, Kontakt
- [x] 27. Admin mobile: permissions card padding improved similar to Audit Log card


## Missing Adjustments - January 2026 (Part 2)

### Events & Fotos
- [x] All Events visible for all users, even logged out
- [x] Allow selecting thumbnail for event cards
- [x] Loader for card thumbnail prioritized over others
- [x] Add horizontal padding/margin on event cards thumbnail images
- [x] Photo upload bugfix - not added to correct event
- [x] Photoview: remove filename, display eventname instead
- [x] Photoview: bigger/fullscreen after clicking

### Team Tab
- [x] Edit icon should not be black on black box (visibility fix)
- [x] Add horizontal padding/margin on member cards thumbnail images
- [x] Member image upload button should not be circle like profile
- [x] After uploading member image, show full size with manual cropping option
- [x] Allow reordering of members (logged-in only)

### Events Form
- [x] Date field uses datepicker
- [x] Photo view arrows smaller, less dominant and cleaner

### Gönnermitglieder
- [x] Edit button in table to edit/view all data of a Gönnermitglied

### Shotcounter
- [x] Bugfix "Kartengroesse" slider not working- [x] Fix teamnames slightly cut off at bottom in beamer mode (low letters like 'g')

### Navbar & Admin
- [x] New card in admin dashboard for navbar link toggles
- [x] Home, Team, Kontakt cannot be turned off
- [x] Off/Hidden links move behind separator and require login

### UI/UX
- [x] After clicking links, start at top of new page (scroll-to-top)
- [x] Smooth scrolling and animated transitions
