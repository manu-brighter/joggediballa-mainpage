# Self-Hosted File Upload Setup Guide

Diese Anleitung erklärt, wie du den Datei-Upload auf deinem selbst gehosteten Server einrichtest. Die Anwendung schreibt Uploads auf lokale Disk und liefert sie via nginx aus — kein externer Storage-Provider.

## Self-Hosted Setup

### 1. Umgebungsvariablen konfigurieren

Füge folgende Umgebungsvariablen zu deiner `.env` Datei hinzu (vollständige Liste in `.env.example`):

```bash
# Self-hosted file storage
UPLOAD_DIR=/var/www/joggediballa-mainpage/uploads
PUBLIC_UPLOAD_URL=https://joggediballa.ch/uploads
```

### 2. Upload-Verzeichnis erstellen

Das Basisverzeichnis muss existieren und für den Node-Prozess beschreibbar sein. Die Unterordner legt `server/storage.ts` beim ersten Upload selbst an (`fs.mkdir` mit `recursive: true`):

```bash
# Erstelle das Upload-Verzeichnis
sudo mkdir -p /var/www/joggediballa-mainpage/uploads

# Setze die richtigen Berechtigungen
sudo chown -R www-data:www-data /var/www/joggediballa-mainpage/uploads
sudo chmod -R 755 /var/www/joggediballa-mainpage/uploads
```

Folgende Unterordner entstehen dabei (Prefixes aus `server/uploadRoutes.ts`):

| Pfad                                                           | Inhalt                               |
| -------------------------------------------------------------- | ------------------------------------ |
| `profile-pictures/`                                            | Profilbilder                         |
| `sponsors/`                                                    | Sponsoren-Logos                      |
| `events/original/`, `events/compressed/`, `events/thumbnails/` | Event-Fotos in drei Grössen          |
| `team-members/original/`, `team-members/compressed/`           | Team-Mitglieder-Fotos                |
| `slideshow/display/`, `slideshow/thumb/`                       | Gäste-Uploads für die Live-Slideshow |

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
cd /var/www/joggediballa-mainpage
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
2. **Dateigrösse begrenzen:** `client_max_body_size` in Nginx muss mindestens so gross sein wie `UPLOAD_MAX_BYTES`, sonst kommt vorher ein 413
3. **Validierung:** Die Upload-Endpunkte vertrauen dem vom Client gemeldeten MIME-Type nicht. `sharp.metadata()` liest die echten Bytes; akzeptiert werden nur JPEG, PNG und WebP. Zusätzlich greift ein Pixel-Limit gegen Decompression-Bombs.
4. **Dateinamen:** werden serverseitig per `nanoid()` erzeugt — der Client-Dateiname landet nie auf der Disk
5. **Keine ausführbaren Dateien:** Nginx blockiert alle Nicht-Bild-Dateien

## Umgebungsvariablen Referenz

| Variable            | Beschreibung                          | Beispiel                                 |
| ------------------- | ------------------------------------- | ---------------------------------------- |
| `UPLOAD_DIR`        | Absoluter Pfad zum Upload-Verzeichnis | `/var/www/joggediballa-mainpage/uploads` |
| `PUBLIC_UPLOAD_URL` | Öffentliche URL für Uploads           | `https://joggediballa.ch/uploads`        |
| `UPLOAD_MAX_BYTES`  | Optional. Max Dateigrösse in Bytes    | `41943040` (40 MB, Default)              |
