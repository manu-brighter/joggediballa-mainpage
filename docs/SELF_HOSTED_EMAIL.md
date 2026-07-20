# Self-Hosted Email Setup für Kontaktformular

Diese Anleitung beschreibt, wie du das Kontaktformular auf deinem selbst gehosteten Server mit E-Mail-Benachrichtigungen einrichtest.

## Übersicht

Das Kontaktformular speichert alle Nachrichten in der Datenbank. Um zusätzlich E-Mail-Benachrichtigungen zu erhalten, musst du einen SMTP-Server konfigurieren.

Der Versand ist bereits implementiert (`server/_core/email.ts`, nodemailer). Es muss **kein Code geschrieben werden** — es reicht, die Umgebungsvariablen zu setzen.

## 1. Umgebungsvariablen einrichten

Füge folgende Variablen zu deiner `.env` Datei hinzu:

```bash
# SMTP Konfiguration
SMTP_HOST=mail.deinserver.ch
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=kontakt@joggediballa.ch
SMTP_PASS=dein-smtp-passwort

# E-Mail Einstellungen
CONTACT_EMAIL_TO=kontakt@joggediballa.ch
CONTACT_EMAIL_FROM=noreply@joggediballa.ch
```

Alle Variablen werden in `server/_core/env.ts` eingelesen und über das `ENV`-Objekt verwendet:

| Variable             | Bedeutung                                                     |
| -------------------- | ------------------------------------------------------------- |
| `SMTP_HOST`          | SMTP-Server                                                   |
| `SMTP_PORT`          | Port, Default `587`                                           |
| `SMTP_SECURE`        | `true` für implizites TLS (Port 465), sonst `false`           |
| `SMTP_USER`          | SMTP-Benutzer                                                 |
| `SMTP_PASS`          | SMTP-Passwort                                                 |
| `CONTACT_EMAIL_TO`   | Empfänger aller Benachrichtigungen                            |
| `CONTACT_EMAIL_FROM` | Absender. Wenn leer, wird `SMTP_USER` als Absender verwendet. |

## 2. Was der Server damit macht

Der E-Mail-Code liegt in `server/_core/email.ts` und exportiert drei Funktionen:

| Funktion                  | Verwendet von                                           |
| ------------------------- | ------------------------------------------------------- |
| `sendEmail()`             | Basis-Funktion, baut den nodemailer-Transport aus `ENV` |
| `sendContactFormEmail()`  | `contact.send` in `server/routers.ts`                   |
| `sendHarassenlaufEmail()` | `harassenlauf.register` in `server/routers.ts`          |

Zusätzlich verschickt `server/_core/googleAuth.ts` über `sendEmail()` eine Benachrichtigung, wenn sich ein neuer Benutzer registriert.

Ablauf beim Kontaktformular (`contact.send`):

1. Nachricht wird in die Tabelle `contact_submissions` geschrieben (nur wenn eine DB verfügbar ist)
2. `sendContactFormEmail()` verschickt die Mail an `CONTACT_EMAIL_TO`
3. Schlägt der Versand fehl, wirft die Prozedur einen `INTERNAL_SERVER_ERROR` — der Benutzer sieht also einen Fehler, obwohl die Nachricht bereits gespeichert ist

Beim Harassenlauf-Formular ist es umgekehrt: ein fehlgeschlagener Mailversand wird nur geloggt und bricht die Anmeldung nicht ab.

**Sicherheit:** Alle Werte aus dem Formular werden vor dem Einsetzen ins HTML mit `escapeHtml()` maskiert, und `replyTo` wird gegen eine strikte E-Mail-Regex geprüft, damit keine CR/LF-Zeichen in SMTP-Header gelangen.

## 3. SMTP-Anbieter Optionen

### Option A: Eigener Mailserver

Wenn du bereits einen Mailserver hast (z.B. Postfix, Dovecot):

- Verwende die Zugangsdaten deines Mailservers
- Stelle sicher, dass SPF, DKIM und DMARC korrekt konfiguriert sind

### Option B: Externe SMTP-Dienste

- **Mailgun**: Kostenlos bis 5.000 E-Mails/Monat
- **SendGrid**: Kostenlos bis 100 E-Mails/Tag
- **Amazon SES**: Sehr günstig für hohe Volumen
- **Brevo (ex Sendinblue)**: Kostenlos bis 300 E-Mails/Tag

### Option C: Gmail SMTP (für Tests)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=deine.email@gmail.com
SMTP_PASS=app-spezifisches-passwort
```

⚠️ Für Gmail musst du ein App-spezifisches Passwort erstellen.

## 4. Testen

Nach der Konfiguration:

1. Starte den Server neu: `pm2 restart joggediballa`
2. Sende eine Testnachricht über das Kontaktformular
3. Prüfe die Logs: `pm2 logs joggediballa`
4. Überprüfe dein E-Mail-Postfach

## Troubleshooting

### E-Mails werden nicht gesendet

- Prüfe die SMTP-Zugangsdaten
- Überprüfe Firewall-Regeln (Port 587 oder 465)
- Schaue in die Server-Logs (`Email sending failed:` kommt aus `sendEmail()`)

### E-Mails landen im Spam

- Konfiguriere SPF, DKIM und DMARC für deine Domain
- Verwende eine verifizierte Absenderadresse
- Vermeide spam-typische Wörter im Betreff

### Verbindungsfehler

```bash
# Teste SMTP-Verbindung
telnet mail.deinserver.ch 587
```
