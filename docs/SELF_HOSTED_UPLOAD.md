# Self-Hosted File Upload Setup Guide

Diese Anleitung erklärt, wie du den Datei-Upload auf deinem selbst gehosteten Server einrichtest.

## Übersicht

Die Website unterstützt zwei Upload-Modi:

1. **Manus S3 Storage** (Standard) - Verwendet den integrierten Manus Storage-Proxy
2. **Self-Hosted Storage** - Speichert Dateien lokal auf deinem Server

## Self-Hosted Setup

### 1. Umgebungsvariablen konfigurieren

Füge folgende Umgebungsvariablen zu deiner `.env` Datei hinzu:

```bash
# Self-hosted file storage
SELF_HOSTED_STORAGE=true
UPLOAD_DIR=/var/www/joggediballa-mainpage/uploads
PUBLIC_UPLOAD_URL=https://joggediballa.ch/uploads
```

### 2. Upload-Verzeichnis erstellen

```bash
# Erstelle das Upload-Verzeichnis
sudo mkdir -p /var/www/joggediballa-mainpage/uploads
sudo mkdir -p /var/www/joggediballa-mainpage/uploads/profile-pictures
sudo mkdir -p /var/www/joggediballa-mainpage/uploads/sponsors
sudo mkdir -p /var/www/joggediballa-mainpage/uploads/events
sudo mkdir -p /var/www/joggediballa-mainpage/uploads/team-members
sudo mkdir -p /var/www/joggediballa-mainpage/uploads/photos

# Setze die richtigen Berechtigungen
sudo chown -R www-data:www-data /var/www/joggediballa-mainpage/uploads
sudo chmod -R 755 /var/www/joggediballa-mainpage/uploads
```

### 3. Nginx Konfiguration

Füge folgende Location zu deiner Nginx-Konfiguration hinzu:

```nginx
server {
    listen 443 ssl http2;
    server_name joggediballa.ch;

    # ... SSL und andere Konfigurationen ...

    # Statische Uploads
    location /uploads/ {
        alias /var/www/joggediballa-mainpage/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";

        # Sicherheitsheader
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;

        # Nur Bilder erlauben
        location ~* \.(jpg|jpeg|png|gif|webp|svg)$ {
            try_files $uri =404;
        }

        # Andere Dateitypen blockieren
        location ~ \. {
            deny all;
        }
    }

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Grössere Uploads erlauben
        client_max_body_size 50M;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        # ... proxy settings ...
    }
}
```

### 4. Nginx neu laden

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Server neu starten

```bash
cd /var/www/joggediballa
pm2 restart joggediballa
```

## Fehlerbehebung

### Upload funktioniert nicht

1. **Berechtigungen prüfen:**

   ```bash
   ls -la /var/www/joggediballa-mainpage/uploads/
   ```

   Der Node.js-Prozess muss Schreibrechte haben.

2. **Logs prüfen:**

   ```bash
   pm2 logs joggediballa --lines 50
   ```

3. **Nginx-Logs prüfen:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

### Bilder werden nicht angezeigt

1. **URL prüfen:** Stelle sicher, dass `PUBLIC_UPLOAD_URL` korrekt ist
2. **Nginx-Konfiguration prüfen:** Die `/uploads/` Location muss richtig konfiguriert sein
3. **CORS prüfen:** Bei Bedarf CORS-Header in Nginx hinzufügen

### Speicherplatz

Überwache den Speicherplatz regelmässig:

```bash
du -sh /var/www/joggediballa-mainpage/uploads/
df -h
```

## Backup

Sichere das Upload-Verzeichnis regelmässig:

```bash
# Beispiel: Tägliches Backup
tar -czf /backup/uploads-$(date +%Y%m%d).tar.gz /var/www/joggediballa-mainpage/uploads/
```

## Sicherheitshinweise

1. **Dateitypen einschränken:** Nur Bilder erlauben (bereits in Nginx konfiguriert)
2. **Dateigrösse begrenzen:** `client_max_body_size` in Nginx
3. **Validierung:** Die Upload-Endpunkte validieren den MIME-Type
4. **Keine ausführbaren Dateien:** Nginx blockiert alle Nicht-Bild-Dateien

## Umgebungsvariablen Referenz

| Variable              | Beschreibung                          | Beispiel                                 |
| --------------------- | ------------------------------------- | ---------------------------------------- |
| `SELF_HOSTED_STORAGE` | Aktiviert lokalen Speicher            | `true`                                   |
| `UPLOAD_DIR`          | Absoluter Pfad zum Upload-Verzeichnis | `/var/www/joggediballa-mainpage/uploads` |
| `PUBLIC_UPLOAD_URL`   | Öffentliche URL für Uploads           | `https://joggediballa.ch/uploads`        |
