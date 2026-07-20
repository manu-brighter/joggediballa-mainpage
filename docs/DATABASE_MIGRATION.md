# Datenbank-Migration auf dem Server

## Wichtig: Nach jedem Git Pull

Wenn du Änderungen von GitHub pullst, die das Datenbank-Schema betreffen, **musst du die Schema-Änderung auf dem Server anwenden**:

```bash
cd /pfad/zu/joggediballa-website
pnpm db:push
```

## Was macht `pnpm db:push`?

`pnpm db:push` ruft `drizzle-kit push` auf (Konfiguration: `drizzle.config.ts`, Verbindung über `DATABASE_URL`):

1. **Vergleicht:** Schema in `drizzle/schema.ts` gegen die tatsächliche Datenbank
2. **Wendet den Diff direkt an:** z.B. neue Spalten, neue Tabellen

Es werden dabei **keine** SQL-Migrationsdateien erzeugt oder abgespielt — im Repo gibt es kein Migrations-Verzeichnis, `drizzle/` enthält nur `schema.ts`.

## Alternative: manuell per SQL

In diesem Projekt werden Schema-Änderungen häufig direkt auf der MySQL-Datenbank ausgeführt statt über `db:push`. Beide Wege sind gültig — wichtig ist nur, dass `drizzle/schema.ts` und die echte DB am Ende übereinstimmen. Neue Spalten werden in `schema.ts` als SQL-Kommentar hinterlegt, damit man sie manuell ausführen kann:

```sql
ALTER TABLE `events` ADD `thumbnailPhotoId` int;
```

**Wenn die Änderung weder gepusht noch manuell ausgeführt wurde:**

- Betroffene Seite wirft 500-Fehler
- Server-Logs zeigen einen SQL-Fehler auf die fehlende Spalte

## Troubleshooting

### Fehler: "Failed query: select ... <spaltenname> ..."

**Lösung:** Schema-Änderung wurde nicht angewendet

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
2. `pnpm db:push` oder manuelles SQL (falls Schema geändert)
3. `pnpm build` (für Production)
4. `pm2 restart all` (Server neu starten)
