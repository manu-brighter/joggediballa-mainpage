-- Kassensystem: Mehrfach-Zusätze pro Bestellposition
--
-- Nachtrag zu docs/sql/2026-08-28-kassensystem.sql. Eine Position konnte bisher
-- genau einen Zusatz tragen (`optionId`/`optionName` direkt auf der Position);
-- Senf *und* Mayo ging damit nicht. Die gewählten Zusätze ziehen darum in eine
-- eigene Tabelle um.
--
-- Generiert mit drizzle-kit aus drizzle/schema.ts, um den Datenumzug ergänzt.
--
--   mysql -u <user> -p <database> < docs/sql/2026-08-28-kassensystem-mehrfachzusaetze.sql
--
-- Reihenfolge ist wichtig: erst die neue Tabelle samt Daten, dann die alten
-- Spalten. DDL committet in MySQL implizit, das läuft nicht als eine
-- Transaktion.

-- ============================================
-- 1. Neue Tabelle
-- ============================================

CREATE TABLE `kasse_order_item_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderItemId` int NOT NULL,
	`optionId` int,
	`optionName` varchar(100) NOT NULL,
	`priceDeltaRappen` int NOT NULL DEFAULT 0,
	CONSTRAINT `kasse_order_item_options_id` PRIMARY KEY(`id`)
);

ALTER TABLE `kasse_order_item_options` ADD CONSTRAINT `kasse_order_item_options_orderItemId_kasse_order_items_id_fk` FOREIGN KEY (`orderItemId`) REFERENCES `kasse_order_items`(`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `kasse_order_item_options` ADD CONSTRAINT `kasse_order_item_options_optionId_kasse_product_options_id_fk` FOREIGN KEY (`optionId`) REFERENCES `kasse_product_options`(`id`) ON DELETE no action ON UPDATE no action;

CREATE INDEX `idx_kasse_order_item_options_item` ON `kasse_order_item_options` (`orderItemId`);

-- ============================================
-- 2. Bestehende Einzel-Zusätze übernehmen
-- ============================================
-- Läuft ins Leere, wenn noch keine Bestellung mit Zusatz existiert.
--
-- `priceDeltaRappen` wird auf 0 gesetzt: der damalige Aufpreis steckt bereits
-- in `unitPriceRappen` der Position und lässt sich nachträglich nicht sauber
-- herausrechnen. Umsatz und Mengen der Auswertung stimmen dadurch weiterhin;
-- nur der Aufpreis-Anteil alter Positionen ist nicht einzeln ausgewiesen.

INSERT INTO `kasse_order_item_options`
	(`orderItemId`, `optionId`, `optionName`, `priceDeltaRappen`)
SELECT `id`, `optionId`, `optionName`, 0
	FROM `kasse_order_items`
	WHERE `optionName` IS NOT NULL;

-- ============================================
-- 3. Alte Spalten entfernen
-- ============================================
-- Der Fremdschlüssel muss vor der Spalte weg, sonst lehnt MySQL das DROP ab.

ALTER TABLE `kasse_order_items` DROP FOREIGN KEY `kasse_order_items_optionId_kasse_product_options_id_fk`;

ALTER TABLE `kasse_order_items` DROP COLUMN `optionId`;

ALTER TABLE `kasse_order_items` DROP COLUMN `optionName`;
