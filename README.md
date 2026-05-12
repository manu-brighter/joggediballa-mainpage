# Jogge di Balla - Vereinswebsite

Eine moderne, full-featured Website für den Verein "Jogge di Balla" mit umfassenden Features für Mitgliederverwaltung, Events, Shotcounter und mehr.

## 🎯 Projekt-Übersicht

Diese Website bietet:

- **Shotcounter** mit Jahrespersistenz, Beamer-Modus, Inline-Editing und animierten Rankings
- **Admin-Dashboard** mit Rollenverwaltung (Admin/Maintainer/Editor/User)
- **Gönnermitgliederverwaltung** mit Ablaufdatum-Tracking
- **Events & Fotos** mit Galerie und Lightbox
- **Team-Seite** mit Mitgliederverwaltung
- **Sponsoren-Verwaltung** mit Logo-Upload
- **Kontaktformular** mit Honeypot-Schutz
- **Dark/Light Mode** mit System-Erkennung
- **Google OAuth** für Self-Hosting
- **Mobile-First** responsive Design

## 🛠️ Tech Stack

- **Frontend:** React 19 + Vite + TailwindCSS 4 + Wouter (Routing)
- **Backend:** Node.js + Express + tRPC 11
- **Database:** MySQL mit Drizzle ORM
- **Auth:** Google OAuth 2.0 mit JWT
- **Deployment:** Self-Hosted auf Root Server mit Nginx + PM2

## 📋 Voraussetzungen

- Node.js 18+ (empfohlen: 22.x)
- pnpm 8+
- MySQL 8+
- Google Cloud Console Account (für OAuth)

## 🚀 Lokale Einrichtung

### 1. Repository klonen

```bash
git clone https://github.com/manu-brighter/joggediballa-mainpage.git
cd joggediballa-mainpage
```

### 1.5. SSH Tunnel einrichten (falls nötig)

```
ssh -L 3307:127.0.0.1:3306 root@[server-ip] -N
```

### 2. Dependencies installieren

```bash
pnpm install
```

### 3. Umgebungsvariablen einrichten

Erstelle eine `.env` Datei im Root-Verzeichnis:

```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/joggediballa"

# Google OAuth (siehe GOOGLE_OAUTH_SETUP.md)
GOOGLE_CLIENT_ID="deine-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="dein-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"

# JWT Secret (generiere einen zufälligen String)
JWT_SECRET="dein-sicherer-jwt-secret"

# Admin Email (wird automatisch als Admin gesetzt)
ADMIN_EMAIL="deine@email.com"

# Session Secret (generiere einen zufälligen String)
SESSION_SECRET="dein-sicherer-session-secret"

# Optional: SMTP für Kontaktformular
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="dein-smtp-user"
SMTP_PASS="dein-smtp-passwort"
SMTP_FROM="noreply@joggediballa.ch"
CONTACT_EMAIL="kontakt@joggediballa.ch"
```

### 4. Datenbank einrichten

```bash
# Datenbank erstellen
mysql -u root -p -e "CREATE DATABASE joggediballa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Schema pushen
pnpm db:push
```

### 5. Google OAuth einrichten

Folge der Anleitung in `GOOGLE_OAUTH_SETUP.md` um:

1. Google Cloud Projekt zu erstellen
2. OAuth 2.0 Credentials zu generieren
3. Authorized redirect URIs zu konfigurieren

### 6. Development Server starten

```bash
pnpm dev
```

Die Website ist nun unter `http://localhost:3000` erreichbar.

## 📦 Deployment auf Root Server

Detaillierte Anleitung siehe `DEPLOYMENT.md`. Kurzfassung:

### 1. Server vorbereiten

```bash
# Node.js, pnpm, MySQL, Nginx, PM2 installieren
# SSL-Zertifikat mit Let's Encrypt einrichten
```

### 2. Code deployen

```bash
cd /var/www/joggediballa-mainpage
git pull origin main
pnpm install --prod
pnpm build
```

### 3. PM2 starten

```bash
pm2 start ecosystem.config.js
pm2 save
```

### 4. Nginx konfigurieren

```nginx
server {
    listen 443 ssl http2;
    server_name joggediballa.ch;

    ssl_certificate /etc/letsencrypt/live/joggediballa.ch/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/joggediballa.ch/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🗂️ Projekt-Struktur

```
joggediballa-mainpage/
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/    # Wiederverwendbare UI-Komponenten
│   │   ├── contexts/      # React Contexts (Auth, Theme)
│   │   ├── hooks/         # Custom Hooks
│   │   ├── lib/           # Utilities (tRPC, SDK)
│   │   ├── pages/         # Seiten-Komponenten
│   │   ├── App.tsx        # Haupt-App mit Routing
│   │   └── main.tsx       # Entry Point
│   └── public/            # Statische Assets
├── server/                # Backend (Node.js + Express)
│   ├── auth/              # OAuth-Implementierung
│   ├── _core/             # Framework-Code (nicht editieren)
│   ├── db.ts              # Datenbank-Queries
│   └── routers.ts         # tRPC-Procedures
├── drizzle/               # Datenbank-Schema
│   └── schema.ts          # Tabellen-Definitionen
├── shared/                # Geteilte Types & Constants
├── .env                   # Umgebungsvariablen (nicht committen!)
├── DEPLOYMENT.md          # Deployment-Anleitung
├── GOOGLE_OAUTH_SETUP.md  # Google OAuth Setup
└── todo.md                # Feature-Tracking
```

## 👥 Rollen & Berechtigungen

- **Admin:** Voller Zugriff auf alle Features
- **Maintainer:** Kann Inhalte verwalten (Events, Team, Sponsoren)
- **Editor:** Kann Inhalte bearbeiten, aber nicht löschen
- **User:** Kann Shotcounter nutzen und eigenes Profil bearbeiten
- **Public:** Kann öffentliche Seiten sehen

## 🔑 Wichtige Hinweise

### Trust Proxy

Der Server muss hinter einem Reverse Proxy (Nginx) laufen. Die `trust proxy` Einstellung in `server/index.ts` ist bereits konfiguriert.

### Cookie-Einstellungen

Für HTTPS (Production):

- `secure: true`
- `sameSite: 'none'`

Für HTTP (Development):

- `secure: false`
- `sameSite: 'lax'`

### Admin-Zugriff

Der erste User, der sich mit der in `ADMIN_EMAIL` angegebenen E-Mail anmeldet, wird automatisch als Admin gesetzt.

### Datenbank-Migrationen

Nach Schema-Änderungen in `drizzle/schema.ts`:

```bash
pnpm db:push
```

### Tests

```bash
pnpm test
```

## 🎨 Design-System

- **Primärfarben:** Coral Red (#FF5A6B), Teal Blue (#1B9BA8)
- **Dark Mode:** Automatische System-Erkennung + manueller Toggle
- **Schriftart:** Inter Variable (self-hosted via `@fontsource-variable/inter`)
- **Animationen:** Framer Motion für smooth Transitions

## 📝 Entwicklungs-Workflow

1. **Feature hinzufügen:** Task in `todo.md` als `[ ]` eintragen
2. **Schema aktualisieren:** `drizzle/schema.ts` editieren, `pnpm db:push`
3. **Backend:** Procedure in `server/routers.ts` hinzufügen
4. **Frontend:** UI in `client/src/pages/` implementieren
5. **Testen:** Vitest-Tests in `server/*.test.ts` schreiben
6. **Fertigstellen:** Task in `todo.md` als `[x]` markieren
7. **Committen:** Code zu GitHub pushen

## 🐛 Troubleshooting

### Login funktioniert nicht

1. Cookies im Browser löschen
2. `.env` Variablen überprüfen
3. Google OAuth Redirect URI überprüfen
4. Server-Logs checken: `pm2 logs joggediballa`

### Datenbank-Verbindung fehlgeschlagen

1. MySQL-Service läuft: `systemctl status mysql`
2. `DATABASE_URL` in `.env` korrekt
3. User hat Zugriffsrechte auf Datenbank

### Build-Fehler

```bash
# Cache löschen und neu bauen
rm -rf node_modules .next dist
pnpm install
pnpm build
```

## 📚 Weitere Dokumentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Vollständige Deployment-Anleitung
- [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md) - Google OAuth Setup
- [todo.md](./todo.md) - Feature-Tracking & Roadmap

## 🤝 Contributing

1. Branch erstellen: `git checkout -b feature/neue-funktion`
2. Änderungen committen: `git commit -m "feat: neue Funktion"`
3. Pushen: `git push origin feature/neue-funktion`
4. Pull Request erstellen

## 📄 Lizenz

Dieses Projekt ist privat und nur für den Verein "Jogge di Balla" bestimmt.

## 📧 Kontakt

Bei Fragen oder Problemen: kontakt@joggediballa.ch
