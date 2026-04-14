# Datenbank-Migration auf dem Server

## Wichtig: Nach jedem Git Pull

Wenn du Änderungen von GitHub pullst, die das Datenbank-Schema betreffen, **musst du die Migration auf dem Server ausführen**:

```bash
cd /pfad/zu/joggediballa-website
pnpm db:push
```

## Was macht `pnpm db:push`?

1. **Generiert Migrationen:** Vergleicht das Schema in `drizzle/schema.ts` mit der Datenbank
2. **Wendet Änderungen an:** Führt alle SQL-Migrationen aus (z.B. neue Spalten, Tabellen)

## Aktuelle Migration (Januar 2026)

Die neueste Migration fügt die Spalte `thumbnailPhotoId` zur `events`-Tabelle hinzu:

```sql
ALTER TABLE `events` ADD `thumbnailPhotoId` int;
```

**Ohne diese Migration:**

- Events-Seite wirft 500-Fehler
- Browser-Console zeigt SQL-Fehler

## Troubleshooting

### Fehler: "Failed query: select ... thumbnailPhotoId ..."

**Lösung:** Migration wurde nicht ausgeführt

```bash
pnpm db:push
pm2 restart all
```

### Fehler: "Database not available"

**Lösung:** Prüfe `DATABASE_URL` in `.env`

```bash
cat .env | grep DATABASE_URL
```

### Fehler: "Connection refused"

**Lösung:** MySQL/MariaDB läuft nicht

```bash
sudo systemctl status mysql
sudo systemctl start mysql
```

## Best Practice

**Nach jedem `git pull`:**

1. `pnpm install` (falls package.json geändert)
2. `pnpm db:push` (falls Schema geändert)
3. `pnpm build` (für Production)
4. `pm2 restart all` (Server neu starten)
