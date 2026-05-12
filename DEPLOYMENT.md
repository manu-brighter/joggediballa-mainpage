# Deployment-Anleitung für Root Server (mc-host24.de)

Diese Anleitung erklärt Schritt für Schritt, wie du die Jogge di Balla Website auf deinem Root Server von mc-host24.de deployest.

## Voraussetzungen

- Root Server mit Ubuntu 22.04 oder neuer
- SSH-Zugriff auf den Server
- Domain (z.B. `joggediballa.de`) mit DNS auf Server-IP zeigend

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

```bash
git clone https://github.com/manu-brighter/joggediballa-mainpage.git joggediballa
cd joggediballa
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
```

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
    server_name joggediballa.de www.joggediballa.de;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name joggediballa.de www.joggediballa.de;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/joggediballa.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/joggediballa.de/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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

## Schritt 5: SSL-Zertifikat mit Let's Encrypt

### 5.1 Certbot installieren

```bash
apt install -y certbot python3-certbot-nginx
```

### 5.2 SSL-Zertifikat erstellen

```bash
certbot --nginx -d joggediballa.de -d www.joggediballa.de
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
   - Autorisierte JavaScript-Ursprünge: `https://joggediballa.de`
   - Autorisierte Weiterleitungs-URIs: `https://joggediballa.de/api/auth/callback/google`
4. Trage Client-ID und Secret in `.env` ein

## Schritt 8: Erste Anmeldung als Admin

1. Öffne `https://joggediballa.de` im Browser
2. Klicke auf "Anmelden"
3. Melde dich mit dem Google-Account an, der in `ADMIN_EMAIL` angegeben ist
4. Du wirst automatisch als Admin eingeloggt

## Updates deployen

### Automatisches Update-Script erstellen

```bash
nano /root/update-joggediballa.sh
```

Füge ein:

```bash
#!/bin/bash
cd /var/www/joggediballa
git pull origin main
pnpm install
pnpm build
pm2 restart joggediballa
echo "Update abgeschlossen!"
```

Ausführbar machen:

```bash
chmod +x /root/update-joggediballa.sh
```

### Update ausführen

```bash
/root/update-joggediballa.sh
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

# Dateien-Backup
tar -czf /root/joggediballa-files-$(date +%Y%m%d).tar.gz /var/www/joggediballa
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

```bash
lsof -i :3000
# Prozess beenden oder anderen Port in .env verwenden
```

## Performance-Optimierung

### Node.js Memory Limit erhöhen

```bash
pm2 delete joggediballa
pm2 start dist/index.js --name joggediballa --max-memory-restart 500M
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
