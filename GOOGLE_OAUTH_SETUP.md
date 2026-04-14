# Google OAuth Setup für Self-Hosting

Diese Anleitung erklärt, wie du Google OAuth für deine Jogge di Balla Website auf deinem Root Server einrichtest.

## Schritt 1: Google Cloud Console einrichten

### 1.1 Projekt erstellen

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Klicke auf "Projekt auswählen" → "Neues Projekt"
3. Name: `Jogge di Balla Website`
4. Klicke auf "Erstellen"

### 1.2 OAuth-Zustimmungsbildschirm konfigurieren

1. Navigiere zu **APIs & Services** → **OAuth-Zustimmungsbildschirm**
2. Wähle **Extern** (für öffentliche Nutzer)
3. Fülle die erforderlichen Felder aus:
   - **App-Name:** Jogge di Balla
   - **E-Mail-Adresse für Nutzer-Support:** deine@email.de
   - **App-Logo:** (optional) Lade dein Vereinslogo hoch
   - **Autorisierte Domains:** `deine-domain.de`
   - **E-Mail-Adresse des Entwicklers:** deine@email.de
4. Klicke auf "Speichern und fortfahren"
5. **Scopes:** Füge folgende Scopes hinzu:
   - `userinfo.email`
   - `userinfo.profile`
6. Klicke auf "Speichern und fortfahren"
7. **Testnutzer:** (optional) Füge Test-E-Mail-Adressen hinzu während der Entwicklung
8. Klicke auf "Zurück zum Dashboard"

### 1.3 OAuth 2.0 Client-ID erstellen

1. Navigiere zu **APIs & Services** → **Anmeldedaten**
2. Klicke auf **+ Anmeldedaten erstellen** → **OAuth-Client-ID**
3. Anwendungstyp: **Webanwendung**
4. Name: `Jogge di Balla Web Client`
5. **Autorisierte JavaScript-Ursprünge:**
   ```
   https://deine-domain.de
   http://localhost:3000
   ```
6. **Autorisierte Weiterleitungs-URIs:**
   ```
   https://deine-domain.de/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
7. Klicke auf "Erstellen"
8. **WICHTIG:** Notiere dir:
   - **Client-ID** (sieht aus wie: `123456789-abc123.apps.googleusercontent.com`)
   - **Client-Secret** (sieht aus wie: `GOCSPX-abc123xyz`)

## Schritt 2: Environment-Variablen konfigurieren

Erstelle eine `.env`-Datei im Root-Verzeichnis deines Projekts:

```env
# Database
DATABASE_URL=mysql://username:password@localhost:3306/joggediballa

# JWT Secret (generiere einen zufälligen String)
JWT_SECRET=dein-super-geheimer-jwt-secret-mindestens-32-zeichen-lang

# Google OAuth
GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz
GOOGLE_CALLBACK_URL=https://deine-domain.de/api/auth/callback/google

# App Configuration
VITE_APP_TITLE=Jogge di Balla
VITE_APP_LOGO=/Jogge_Di_Balla_Final_Transparent.png
BASE_URL=https://deine-domain.de

# Admin User (deine Google E-Mail)
ADMIN_EMAIL=deine@gmail.com
```

### JWT Secret generieren

Führe folgenden Befehl aus, um einen sicheren JWT Secret zu generieren:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Schritt 3: Domain in Google OAuth eintragen

**WICHTIG:** Ersetze in den Google Cloud Console Einstellungen:

- `deine-domain.de` mit deiner echten Domain (z.B. `joggediballa.de`)
- Stelle sicher, dass deine Domain mit HTTPS läuft (SSL-Zertifikat erforderlich)

### Für Entwicklung (localhost)

Während der Entwicklung kannst du `http://localhost:3000` verwenden.

### Für Produktion (Root Server)

Verwende deine echte Domain mit HTTPS: `https://joggediballa.de`

## Schritt 4: Deployment auf Root Server

### 4.1 Voraussetzungen

- Node.js 18+ installiert
- MySQL/MariaDB installiert
- Nginx als Reverse Proxy
- SSL-Zertifikat (Let's Encrypt empfohlen)

### 4.2 Projekt auf Server deployen

```bash
# Auf deinem Server
cd /var/www
git clone https://github.com/manu-brighter/joggediballa-mainpage.git joggediballa
cd joggediballa

# Dependencies installieren
npm install -g pnpm
pnpm install

# Environment-Variablen konfigurieren
cp .env.example .env
nano .env  # Füge deine echten Werte ein

# Datenbank-Migrationen ausführen
pnpm db:push

# Build für Produktion
pnpm build

# Mit PM2 starten (empfohlen)
npm install -g pm2
pm2 start dist/index.js --name joggediballa
pm2 save
pm2 startup
```

### 4.3 Nginx Konfiguration

Erstelle `/etc/nginx/sites-available/joggediballa`:

```nginx
server {
    listen 80;
    server_name deine-domain.de www.deine-domain.de;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name deine-domain.de www.deine-domain.de;

    ssl_certificate /etc/letsencrypt/live/deine-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deine-domain.de/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktiviere die Konfiguration:

```bash
sudo ln -s /etc/nginx/sites-available/joggediballa /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4.4 SSL-Zertifikat mit Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.de -d www.deine-domain.de
```

## Schritt 5: Admin-Zugriff einrichten

Der erste Benutzer, der sich mit der in `ADMIN_EMAIL` angegebenen E-Mail-Adresse anmeldet, wird automatisch als Admin eingerichtet.

1. Öffne deine Website: `https://deine-domain.de`
2. Klicke auf "Anmelden"
3. Melde dich mit deinem Google-Account an (mit der E-Mail aus `ADMIN_EMAIL`)
4. Du wirst automatisch als Admin eingeloggt

## Troubleshooting

### "redirect_uri_mismatch" Fehler

- Überprüfe, ob die Callback-URL in Google Cloud Console **exakt** mit der URL in deiner `.env` übereinstimmt
- Achte auf `http` vs `https` und trailing slashes

### "Access blocked: This app's request is invalid"

- Stelle sicher, dass du die Scopes `userinfo.email` und `userinfo.profile` im OAuth-Zustimmungsbildschirm hinzugefügt hast

### Datenbank-Verbindungsfehler

- Überprüfe die `DATABASE_URL` in der `.env`
- Stelle sicher, dass MySQL läuft: `sudo systemctl status mysql`
- Teste die Verbindung: `mysql -u username -p`

### Port 3000 bereits belegt

- Ändere den Port in `server/_core/index.ts` oder verwende eine andere Port-Nummer
- Passe die Nginx-Konfiguration entsprechend an

## Weitere Hilfe

Bei Fragen oder Problemen:

1. Überprüfe die [Google OAuth Dokumentation](https://developers.google.com/identity/protocols/oauth2)
2. Schaue in die Logs: `pm2 logs joggediballa`
3. Prüfe Nginx-Logs: `sudo tail -f /var/log/nginx/error.log`
