# Deployment-Anleitung für Root Server (mc-host24.de)

Diese Anleitung erklärt Schritt für Schritt, wie du die Jogge di Balla Website auf deinem Root Server von mc-host24.de deployest.

## Voraussetzungen

- Root Server mit Ubuntu 22.04 oder neuer
- SSH-Zugriff auf den Server
- Domain (`joggediballa.ch`) mit DNS auf Server-IP zeigend

## Schritt 1: Server vorbereiten

### 1.1 Mit Server verbinden

```bash
ssh root@deine-server-ip
```

### 1.2 System aktualisieren

```bash
apt update && apt upgrade -y
```

### 1.3 Node.js 22 installieren

Das Projekt verlangt Node `>=22.11.0` (siehe `engines` in `package.json`).

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version  # Sollte v22.x.x anzeigen
```

### 1.4 pnpm installieren

```bash
npm install -g pnpm
pnpm --version
```

### 1.5 PM2 installieren (Process Manager)

```bash
npm install -g pm2
pm2 --version
```

## Schritt 2: MySQL/MariaDB einrichten

### 2.1 MariaDB installieren

```bash
apt install -y mariadb-server mariadb-client
systemctl start mariadb
systemctl enable mariadb
```

### 2.2 MariaDB sichern

```bash
mysql_secure_installation
```

Beantworte die Fragen:

- Set root password? **Y** (wähle ein sicheres Passwort)
- Remove anonymous users? **Y**
- Disallow root login remotely? **Y**
- Remove test database? **Y**
- Reload privilege tables? **Y**

### 2.3 Datenbank und Benutzer erstellen

```bash
mysql -u root -p
```

Im MySQL-Prompt:

```sql
CREATE DATABASE joggediballa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'joggediballa_user'@'localhost' IDENTIFIED BY 'dein_sicheres_passwort';
GRANT ALL PRIVILEGES ON joggediballa.* TO 'joggediballa_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Schritt 3: Projekt deployen

### 3.1 Projekt-Verzeichnis erstellen

```bash
mkdir -p /var/www
cd /var/www
```

### 3.2 Repository clonen

Das Verzeichnis muss `joggediballa-mainpage` heissen — `ecosystem.config.cjs` setzt `cwd: /var/www/joggediballa-mainpage` fest, und `UPLOAD_DIR` zeigt standardmässig dorthin.

```bash
git clone https://github.com/manu-brighter/joggediballa-mainpage.git joggediballa-mainpage
cd joggediballa-mainpage
```

### 3.3 Dependencies installieren

```bash
pnpm install
```

### 3.4 Environment-Variablen konfigurieren

```bash
cp .env.example .env
nano .env
```

Fülle die `.env` mit deinen echten Werten (siehe `.env.example` für die vollständige Liste mit Kommentaren und `GOOGLE_OAUTH_SETUP.md` für Google OAuth):

```env
DATABASE_URL=mysql://joggediballa_user:dein_sicheres_passwort@localhost:3306/joggediballa
JWT_SECRET=generiere-einen-zufaelligen-32-zeichen-string
SESSION_SECRET=generiere-einen-zweiten-32-zeichen-string
GOOGLE_CLIENT_ID=deine-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=dein-google-client-secret
GOOGLE_CALLBACK_URL=https://joggediballa.ch/api/auth/callback/google
ADMIN_EMAIL=deine@gmail.com
BASE_URL=https://joggediballa.ch
APP_ORIGIN=https://joggediballa.ch
NODE_ENV=production
PORT=3000
UPLOAD_DIR=/var/www/joggediballa-mainpage/uploads
PUBLIC_UPLOAD_URL=https://joggediballa.ch/uploads
UPLOAD_MAX_BYTES=41943040
SMTP_HOST=smtp.dein-provider.ch
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=dein-smtp-user
SMTP_PASS=dein-smtp-passwort
CONTACT_EMAIL_TO=empfaenger@joggediballa.ch
CONTACT_EMAIL_FROM=noreply@joggediballa.ch
```

Hinweise:

- **Uploads** liegen lokal auf der Platte (kein S3/AWS mehr). `UPLOAD_DIR` ist der Schreibpfad für Node, `PUBLIC_UPLOAD_URL` die öffentliche URL, unter der nginx dasselbe Verzeichnis ausliefert — beide müssen zusammenpassen (siehe Schritt 4.2).
- `UPLOAD_MAX_BYTES` ist optional (Default 40 MB) und muss zu `client_max_body_size` in nginx passen.
- Die `SMTP_*`- und `CONTACT_EMAIL_*`-Variablen werden nur vom Kontaktformular gebraucht. Ohne sie startet der Server, aber der Mailversand schlägt fehl.

**JWT & SESSION Secret generieren (je 32+ Zeichen, MÜSSEN unterschiedlich sein):**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Der Server startet nicht, wenn `JWT_SECRET` oder `SESSION_SECRET` fehlt oder kürzer als 32 Zeichen ist.

Speichern: `Ctrl+O`, `Enter`, `Ctrl+X`

### 3.5 Datenbank-Migrationen ausführen

```bash
pnpm db:push
```

### 3.6 Projekt builden

```bash
pnpm build
```

### 3.7 Mit PM2 starten

Das Repo enthält `ecosystem.config.cjs` als kanonische PM2-Konfiguration. Damit ist auf dem Server immer derselbe App-Name, Cwd und Restart-Verhalten gesetzt — keine Ad-hoc-Befehle nötig.

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Updates später entsprechend mit `pm2 reload ecosystem.config.cjs` (zero-downtime) oder `pm2 restart joggediballa`.

Kopiere den ausgegebenen Befehl und führe ihn aus (sieht aus wie):

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

### 3.8 Status prüfen

```bash
pm2 status
pm2 logs joggediballa
```

## Schritt 4: Nginx als Reverse Proxy

### 4.1 Nginx installieren

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 4.2 Nginx-Konfiguration erstellen

```bash
nano /etc/nginx/sites-available/joggediballa
```

Füge folgende Konfiguration ein:

```nginx
server {
    listen 80;
    server_name joggediballa.ch www.joggediballa.ch;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name joggediballa.ch www.joggediballa.ch;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/joggediballa.ch/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/joggediballa.ch/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Upload-Limit: muss mindestens so gross sein wie UPLOAD_MAX_BYTES
    # (Default 40 MB, siehe server/_core/env.ts) — sonst antwortet nginx mit
    # 413, bevor der Request überhaupt bei Node ankommt.
    client_max_body_size 40m;

    # User-Uploads direkt von der Platte ausliefern (kein S3 mehr).
    # Muss zu UPLOAD_DIR bzw. PUBLIC_UPLOAD_URL in der .env passen:
    # UPLOAD_DIR=/var/www/joggediballa-mainpage/uploads
    # PUBLIC_UPLOAD_URL=https://joggediballa.ch/uploads
    location /uploads/ {
        alias /var/www/joggediballa-mainpage/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Proxy to Node.js app
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

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Access and error logs
    access_log /var/log/nginx/joggediballa_access.log;
    error_log /var/log/nginx/joggediballa_error.log;
}
```

Speichern: `Ctrl+O`, `Enter`, `Ctrl+X`

### 4.3 Konfiguration aktivieren

```bash
ln -s /etc/nginx/sites-available/joggediballa /etc/nginx/sites-enabled/
nginx -t  # Konfiguration testen
systemctl reload nginx
```

### 4.4 Upload-Verzeichnis anlegen

Der Node-Prozess schreibt Uploads nach `UPLOAD_DIR`, nginx liest sie von dort wieder aus. Verzeichnis einmalig anlegen und `www-data` Leserechte geben:

```bash
mkdir -p /var/www/joggediballa-mainpage/uploads
chown -R root:www-data /var/www/joggediballa-mainpage/uploads
chmod -R 755 /var/www/joggediballa-mainpage/uploads
```

## Schritt 5: SSL-Zertifikat mit Let's Encrypt

### 5.1 Certbot installieren

```bash
apt install -y certbot python3-certbot-nginx
```

### 5.2 SSL-Zertifikat erstellen

```bash
certbot --nginx -d joggediballa.ch -d www.joggediballa.ch
```

Beantworte die Fragen:

- E-Mail-Adresse eingeben
- Terms of Service akzeptieren (Y)
- E-Mail-Benachrichtigungen (optional)

### 5.3 Auto-Renewal testen

```bash
certbot renew --dry-run
```

## Schritt 6: Firewall konfigurieren

### 6.1 UFW installieren und konfigurieren

```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

## Schritt 7: Google OAuth konfigurieren

Folge der Anleitung in `GOOGLE_OAUTH_SETUP.md`:

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle OAuth-Credentials
3. Füge deine Domain hinzu:
   - Autorisierte JavaScript-Ursprünge: `https://joggediballa.ch`
   - Autorisierte Weiterleitungs-URIs: `https://joggediballa.ch/api/auth/callback/google`
4. Trage Client-ID und Secret in `.env` ein

## Schritt 8: Erste Anmeldung als Admin

1. Öffne `https://joggediballa.ch` im Browser
2. Klicke auf "Anmelden"
3. Melde dich mit dem Google-Account an, der in `ADMIN_EMAIL` angegeben ist
4. Du wirst automatisch als Admin eingeloggt

## Updates deployen

Der normale Weg ist **nicht mehr manuell** — ein Push auf `main` deployt automatisch.

### Automatischer Deploy (GitHub Actions)

Drei Workflows liegen unter `.github/workflows/`:

| Workflow               | Trigger                                         | Was er macht                                                             |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `ci.yml`               | Pull Request + Push auf `main`                  | `pnpm check`, `pnpm test`, `pnpm build` (Node 22, pnpm, frozen lockfile) |
| `deploy.yml`           | Push auf `main` + manuell (`workflow_dispatch`) | SSHt als `deploy@<server-ip>` und stösst den serverseitigen Deploy an    |
| `playwright-smoke.yml` | PR + Push auf `main` + nightly 04:00 UTC        | Smoke-Tests gegen die Live-Seite `https://joggediballa.ch`               |

`deploy.yml` führt bewusst **kein** Kommando über SSH aus — es verbindet sich nur. Der eigentliche Deploy hängt als _forced command_ am `deploy`-User auf dem Server (`~/.ssh/authorized_keys`), d.h. das Deploy-Script lebt auf der Maschine, nicht im Repo. Der private Schlüssel dazu liegt als GitHub-Secret `DEPLOY_KEY`.

Da das Script nicht im Repo liegt, ist sein genauer Inhalt hier nicht dokumentiert — nachsehen mit `cat ~/.ssh/authorized_keys` beim `deploy`-User bzw. im dort referenzierten Script. Bekannt ist, dass es den Prozess mit `pm2 reload` neu startet (nicht `pm2 start`). Wichtig dabei: `pm2 reload` liest `ecosystem.config.cjs` **nicht** neu ein. Nach Änderungen an dieser Datei einmalig auf dem Server:

```bash
pm2 delete joggediballa && pm2 start ecosystem.config.cjs && pm2 save
```

Deploy-Status prüfen: GitHub → Actions → "Deploy". Bei Bedarf über "Run workflow" manuell nachtriggern.

### Manueller Deploy (Fallback)

Wenn GitHub Actions nicht verfügbar ist oder du direkt auf dem Server arbeitest:

```bash
cd /var/www/joggediballa-mainpage
git pull origin main
pnpm install
pnpm build
pm2 reload joggediballa   # zero-downtime; alternativ: pm2 restart joggediballa
```

Nur nötig, wenn sich das Drizzle-Schema geändert hat:

```bash
pnpm db:push
```

### Deploy verifizieren

Die Playwright-Smoke-Tests prüfen die Live-Seite (Seitenaufrufe, Titel, Routing, Security-Header). `playwright-smoke.yml` läuft bei jedem Push auf `main` und zusätzlich jede Nacht um 04:00 UTC.

**Achtung:** `playwright-smoke.yml` und `deploy.yml` starten beim selben Push parallel — es gibt keine Abhängigkeit zwischen den beiden. Der Smoke-Run kann also noch den alten Stand treffen. Für eine echte Post-Deploy-Verifikation den Deploy-Workflow abwarten und danach manuell laufen lassen:

```bash
pnpm test:e2e:smoke:live
```

Das setzt `SMOKE_URL=https://joggediballa.ch` und `PLAYWRIGHT_NO_SERVER=1`, startet also keinen lokalen Dev-Server. Schlägt der Nightly-Run fehl, liegt der Playwright-Report als Artifact `playwright-smoke-report` am Workflow-Run (7 Tage Aufbewahrung).

Schneller Handcheck auf dem Server:

```bash
pm2 status
curl -sI https://joggediballa.ch | head -1   # erwartet: HTTP/2 200
```

## Monitoring und Wartung

### Logs anzeigen

```bash
# PM2 Logs
pm2 logs joggediballa

# Nginx Logs
tail -f /var/log/nginx/joggediballa_access.log
tail -f /var/log/nginx/joggediballa_error.log

# System Logs
journalctl -u nginx -f
```

### App neu starten

```bash
pm2 restart joggediballa
```

### Server neu starten

```bash
reboot
# Nach Neustart: PM2 startet automatisch
```

### Backup erstellen

```bash
# Datenbank-Backup
mysqldump -u joggediballa_user -p joggediballa > /root/backup-$(date +%Y%m%d).sql

# Dateien-Backup (inkl. .env und User-Uploads)
tar -czf /root/joggediballa-files-$(date +%Y%m%d).tar.gz /var/www/joggediballa-mainpage

# Nur die User-Uploads (liegen lokal auf der Platte, nicht in der DB)
tar -czf /root/joggediballa-uploads-$(date +%Y%m%d).tar.gz /var/www/joggediballa-mainpage/uploads
```

## Troubleshooting

### App läuft nicht

```bash
pm2 status
pm2 logs joggediballa --lines 100
```

### Nginx-Fehler

```bash
nginx -t
systemctl status nginx
tail -f /var/log/nginx/error.log
```

### Datenbank-Verbindung fehlgeschlagen

```bash
mysql -u joggediballa_user -p joggediballa
# Teste die Verbindung
```

### SSL-Zertifikat erneuern

```bash
certbot renew
systemctl reload nginx
```

### Port 3000 bereits belegt

Achtung: Der Server bricht **nicht** ab, wenn Port 3000 belegt ist — er sucht sich den nächsten freien Port (3000–3019) und loggt `Port 3000 is busy, using port 3001 instead`. nginx proxied aber fest auf 3000, d.h. die Seite läuft dann ins Leere. Immer zuerst die PM2-Logs auf diese Zeile prüfen.

```bash
lsof -i :3000
pm2 logs joggediballa --lines 50 | grep -i "using port"
# Fremdprozess beenden, dann: pm2 restart joggediballa
```

### Uploads werden nicht angezeigt (404)

```bash
# Liegt die Datei überhaupt auf der Platte?
ls -la /var/www/joggediballa-mainpage/uploads

# Darf nginx (www-data) lesen?
sudo -u www-data ls /var/www/joggediballa-mainpage/uploads
```

Häufigste Ursachen: `location /uploads/` fehlt in der nginx-Config (Schritt 4.2), `UPLOAD_DIR` und der `alias`-Pfad zeigen auseinander, oder `PUBLIC_UPLOAD_URL` passt nicht zur Domain. Bei 413 beim Hochladen ist `client_max_body_size` zu klein.

## Performance-Optimierung

### Node.js Memory Limit anpassen

Die Limits stehen in `ecosystem.config.cjs` und sind bereits gesetzt: `NODE_OPTIONS: --max-old-space-size=512` und `max_memory_restart: 600M`. Keine Ad-hoc-`pm2 start`-Befehle verwenden — die überschreiben die kanonische Konfiguration.

Zum Ändern die Werte in `ecosystem.config.cjs` anpassen, committen, deployen und den Prozess einmalig neu registrieren (`pm2 reload` liest die Datei nicht neu ein):

```bash
cd /var/www/joggediballa-mainpage
pm2 delete joggediballa
pm2 start ecosystem.config.cjs
pm2 save
```

### Nginx Caching aktivieren

Füge in Nginx-Config hinzu:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

location / {
    proxy_cache my_cache;
    proxy_cache_valid 200 10m;
    # ... rest der config
}
```

## Sicherheit

### Automatische Updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

### Fail2Ban installieren

```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### SSH absichern

```bash
nano /etc/ssh/sshd_config
```

Ändere:

```
PermitRootLogin no
PasswordAuthentication no
```

Erstelle einen neuen Benutzer:

```bash
adduser admin
usermod -aG sudo admin
```

## Support

Bei Problemen:

1. Prüfe die Logs: `pm2 logs joggediballa`
2. Prüfe Nginx: `nginx -t && tail -f /var/log/nginx/error.log`
3. Prüfe Datenbank: `systemctl status mariadb`
4. Siehe `GOOGLE_OAUTH_SETUP.md` für OAuth-Probleme
