-- Kassensystem: Kategorien als Entitäten mit fixer Station, Bestellungen
-- werden pro Station gesplittet
--
-- Nachtrag zu docs/sql/2026-08-28-kassensystem.sql und
-- docs/sql/2026-08-28-kassensystem-mehrfachzusaetze.sql.
--
-- Bisher war `category` ein Freitextfeld auf `kasse_products`, und Küche/Bar
-- filterten rein client-seitig über einen Geräte-lokalen Kategorienfilter.
-- Eine Bestellung mit Essen und Getränken zusammen hatte dadurch einen
-- einzigen Status: die Bar konnte die ganze Bestellung auf "bereit" setzen,
-- obwohl das Essen in der Küche noch nicht fertig war. Jede Kategorie gehört
-- jetzt fix zu einer Station, und eine Bestellung mit Positionen mehrerer
-- Stationen wird beim Senden serverseitig in ein Ticket pro Station
-- aufgeteilt (siehe createOrder in server/kasse_router.ts).
--
--   mysql -u <user> -p <database> < docs/sql/2026-09-12-kassensystem-stationen.sql
--
-- Reihenfolge ist wichtig: erst die Kategorien-Tabelle samt Seed-Daten, dann
-- kasse_products.categoryId befüllen, zuletzt kasse_orders.station. DDL
-- committet in MySQL implizit, das Skript läuft nicht als eine Transaktion.
--
-- WICHTIG: Schritt 2 (Seed) ist auf die Kategorien dieses konkreten Events
-- zugeschnitten (Food/Drinks/Shots). Vor dem Lauf gegen eine andere DB erst
-- `SELECT DISTINCT category FROM kasse_products;` prüfen und die INSERT-Zeile
-- entsprechend anpassen — jeder dort gefundene Wert braucht eine Zeile,
-- sonst bleibt das zugehörige Produkt nach Schritt 3 ohne Kategorie.

-- ============================================
-- 1. Neue Tabelle
-- ============================================

CREATE TABLE `kasse_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`station` enum('kueche','bar') NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `kasse_categories_id` PRIMARY KEY(`id`)
);

ALTER TABLE `kasse_categories` ADD CONSTRAINT `kasse_categories_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;

CREATE INDEX `idx_kasse_categories_active_sort` ON `kasse_categories` (`isActive`,`displayOrder`);

-- ============================================
-- 2. Kategorien seeden (siehe Hinweis oben)
-- ============================================

INSERT INTO `kasse_categories` (`name`, `station`, `displayOrder`) VALUES
	('Food', 'kueche', 0),
	('Drinks', 'bar', 1),
	('Shots', 'bar', 2),
	('Weiteres', 'kueche', 999);
-- 'Weiteres' fängt Produkte ohne (oder mit leerem) category-Wert auf.

-- ============================================
-- 3. kasse_products: categoryId ergänzen und befüllen
-- ============================================

ALTER TABLE `kasse_products` ADD COLUMN `categoryId` int AFTER `name`;

UPDATE `kasse_products` p JOIN `kasse_categories` c
	ON c.`name` = COALESCE(NULLIF(TRIM(p.`category`), ''), 'Weiteres')
	SET p.`categoryId` = c.`id`;

-- Muss 0 sein, sonst gibt es einen category-Wert, der in Schritt 2 nicht
-- abgedeckt wurde -- dann fehlende Kategorie ergänzen und die UPDATE-Zeile
-- oben für die betroffenen Produkte erneut laufen lassen.
SELECT COUNT(*) FROM `kasse_products` WHERE `categoryId` IS NULL;

ALTER TABLE `kasse_products` MODIFY COLUMN `categoryId` int NOT NULL;
ALTER TABLE `kasse_products` ADD CONSTRAINT `kasse_products_categoryId_kasse_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `kasse_categories`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `kasse_products` DROP COLUMN `category`;

-- ============================================
-- 4. kasse_orders: station ergänzen und befüllen
-- ============================================

ALTER TABLE `kasse_orders` ADD COLUMN `station` enum('kueche','bar') AFTER `tableName`;

UPDATE `kasse_orders` o
	JOIN `kasse_order_items` i ON i.`orderId` = o.`id`
	JOIN `kasse_categories` c ON c.`name` = i.`productCategory`
	SET o.`station` = c.`station`
	WHERE o.`station` IS NULL;

-- Kann > 0 bleiben bei Bestellungen ganz ohne Positionen (Randfall, betrifft
-- nur die Alt-Historie vor dieser Migration) -- dann von Hand setzen, z. B.:
--   SELECT o.id, o.tableName, o.status, o.createdAt, i.productName, i.productCategory
--     FROM kasse_orders o LEFT JOIN kasse_order_items i ON i.orderId = o.id
--     WHERE o.station IS NULL;
--   UPDATE kasse_orders SET station = 'kueche' WHERE id = <id>;
SELECT COUNT(*) FROM `kasse_orders` WHERE `station` IS NULL;

ALTER TABLE `kasse_orders` MODIFY COLUMN `station` enum('kueche','bar') NOT NULL;

CREATE INDEX `idx_kasse_orders_station_status` ON `kasse_orders` (`sessionId`,`station`,`status`);

-- ============================================
-- 5. Kein weiterer Seed nötig
-- ============================================
-- Kategorien-Stationen im Kassen-Admin unter "Kategorien" einmal
-- gegenprüfen, insbesondere 'Weiteres' (Default 'kueche' ist nur ein
-- Platzhalter).
