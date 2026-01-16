# Self-Hosted Email Setup für Kontaktformular

Diese Anleitung beschreibt, wie du das Kontaktformular auf deinem selbst gehosteten Server mit E-Mail-Benachrichtigungen einrichtest.

## Übersicht

Das Kontaktformular speichert alle Nachrichten in der Datenbank. Um zusätzlich E-Mail-Benachrichtigungen zu erhalten, musst du einen SMTP-Server konfigurieren.

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

## 2. Nodemailer installieren

```bash
pnpm add nodemailer
pnpm add -D @types/nodemailer
```

## 3. E-Mail Service erstellen

Erstelle die Datei `server/emailService.ts`:

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendContactEmail(data: {
  name: string;
  email: string;
  subject?: string;
  message: string;
}) {
  const mailOptions = {
    from: process.env.CONTACT_EMAIL_FROM,
    to: process.env.CONTACT_EMAIL_TO,
    replyTo: data.email,
    subject: `[Kontaktformular] ${data.subject || 'Neue Nachricht'} von ${data.name}`,
    text: `
Neue Nachricht über das Kontaktformular:

Name: ${data.name}
E-Mail: ${data.email}
Betreff: ${data.subject || 'Kein Betreff'}

Nachricht:
${data.message}

---
Diese E-Mail wurde automatisch vom Kontaktformular auf joggediballa.ch gesendet.
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0d9488, #14b8a6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .value { margin-top: 5px; }
    .message { background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #0d9488; }
    .footer { text-align: center; padding: 15px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Neue Kontaktanfrage</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Name</div>
        <div class="value">${data.name}</div>
      </div>
      <div class="field">
        <div class="label">E-Mail</div>
        <div class="value"><a href="mailto:${data.email}">${data.email}</a></div>
      </div>
      <div class="field">
        <div class="label">Betreff</div>
        <div class="value">${data.subject || 'Kein Betreff'}</div>
      </div>
      <div class="field">
        <div class="label">Nachricht</div>
        <div class="message">${data.message.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="footer">
      Diese E-Mail wurde automatisch vom Kontaktformular auf joggediballa.ch gesendet.
    </div>
  </div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[Email] Contact form email sent successfully');
    return true;
  } catch (error) {
    console.error('[Email] Failed to send contact form email:', error);
    return false;
  }
}
```

## 4. Router aktualisieren

In `server/routers.ts`, importiere den E-Mail Service und rufe ihn auf:

```typescript
import { sendContactEmail } from './emailService';

// Im contact.submit mutation:
.mutation(async ({ input, ctx }) => {
  // Honeypot check
  if (input.honeypot) {
    return { success: true };
  }
  
  const submissionId = await db.createContactSubmission({
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
    honeypot: input.honeypot,
    ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for'] as string || undefined
  });
  
  // E-Mail senden (async, blockiert nicht)
  sendContactEmail({
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
  }).catch(err => console.error('[Email] Error:', err));
  
  return { success: true, submissionId };
}),
```

## 5. SMTP-Anbieter Optionen

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

## 6. Testen

Nach der Konfiguration:

1. Starte den Server neu: `pm2 restart joggediballa`
2. Sende eine Testnachricht über das Kontaktformular
3. Prüfe die Logs: `pm2 logs joggediballa`
4. Überprüfe dein E-Mail-Postfach

## Troubleshooting

### E-Mails werden nicht gesendet
- Prüfe die SMTP-Zugangsdaten
- Überprüfe Firewall-Regeln (Port 587 oder 465)
- Schaue in die Server-Logs

### E-Mails landen im Spam
- Konfiguriere SPF, DKIM und DMARC für deine Domain
- Verwende eine verifizierte Absenderadresse
- Vermeide spam-typische Wörter im Betreff

### Verbindungsfehler
```bash
# Teste SMTP-Verbindung
telnet mail.deinserver.ch 587
```
