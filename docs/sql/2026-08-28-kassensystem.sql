-- Kassensystem (POS) — Schema für PR #37 (feat/kassensystem)
--
-- Generiert mit drizzle-kit aus `drizzle/schema.ts` (Diff main → feat/kassensystem),
-- danach von Hand um den `manage_kasse`-Permission-Eintrag ergänzt.
-- Gedacht für den manuellen Lauf gegen MySQL 8, als Alternative zu `pnpm db:push`.
--
--   mysql -u <user> -p <database> < docs/sql/2026-08-28-kassensystem.sql
--
-- Hinweis: DDL in MySQL committet implizit — das Skript läuft nicht als eine
-- Transaktion. Bei einem Abbruch mittendrin sind die bereits angelegten Tabellen da.

-- ============================================
-- 1. Tabellen
-- ============================================

CREATE TABLE `kasse_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`productName` varchar(100) NOT NULL,
	`optionId` int,
	`optionName` varchar(100),
	`quantity` int NOT NULL,
	`unitPriceRappen` int NOT NULL,
	`lineTotalRappen` int NOT NULL,
	CONSTRAINT `kasse_order_items_id` PRIMARY KEY(`id`)
);

CREATE TABLE `kasse_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`tableId` int,
	`tableName` varchar(20) NOT NULL,
	`status` enum('pending','ready','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`totalRappen` int NOT NULL,
	`note` varchar(255),
	`waiterName` varchar(60),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readyAt` timestamp,
	`deliveredAt` timestamp,
	`cancelledAt` timestamp,
	CONSTRAINT `kasse_orders_id` PRIMARY KEY(`id`)
);

CREATE TABLE `kasse_product_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`priceDeltaRappen` int NOT NULL DEFAULT 0,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kasse_product_options_id` PRIMARY KEY(`id`)
);

CREATE TABLE `kasse_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`category` varchar(50),
	`priceRappen` int NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `kasse_products_id` PRIMARY KEY(`id`)
);

CREATE TABLE `kasse_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kasse_sessions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `kasse_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accessToken` varchar(64) NOT NULL,
	`ordersOpen` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `kasse_settings_id` PRIMARY KEY(`id`)
);

CREATE TABLE `kasse_tables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(20) NOT NULL,
	`area` varchar(10),
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kasse_tables_id` PRIMARY KEY(`id`),
	CONSTRAINT `kasse_tables_name_unique` UNIQUE(`name`)
);

-- ============================================
-- 2. Foreign Keys
-- ============================================

ALTER TABLE `kasse_order_items` ADD CONSTRAINT `kasse_order_items_orderId_kasse_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `kasse_orders`(`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `kasse_order_items` ADD CONSTRAINT `kasse_order_items_productId_kasse_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `kasse_products`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `kasse_order_items` ADD CONSTRAINT `kasse_order_items_optionId_kasse_product_options_id_fk` FOREIGN KEY (`optionId`) REFERENCES `kasse_product_options`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `kasse_orders` ADD CONSTRAINT `kasse_orders_sessionId_kasse_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `kasse_sessions`(`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `kasse_orders` ADD CONSTRAINT `kasse_orders_tableId_kasse_tables_id_fk` FOREIGN KEY (`tableId`) REFERENCES `kasse_tables`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `kasse_product_options` ADD CONSTRAINT `kasse_product_options_productId_kasse_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `kasse_products`(`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `kasse_products` ADD CONSTRAINT `kasse_products_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `kasse_sessions` ADD CONSTRAINT `kasse_sessions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;

ALTER TABLE `kasse_settings` ADD CONSTRAINT `kasse_settings_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;

-- ============================================
-- 3. Indizes
-- ============================================

CREATE INDEX `idx_kasse_order_items_order` ON `kasse_order_items` (`orderId`);

CREATE INDEX `idx_kasse_orders_session_status` ON `kasse_orders` (`sessionId`,`status`,`createdAt`);

CREATE INDEX `idx_kasse_product_options_product` ON `kasse_product_options` (`productId`);

CREATE INDEX `idx_kasse_products_active_sort` ON `kasse_products` (`isActive`,`displayOrder`);

CREATE INDEX `idx_kasse_sessions_status` ON `kasse_sessions` (`status`);

CREATE INDEX `idx_kasse_tables_active_sort` ON `kasse_tables` (`isActive`,`displayOrder`);

-- ============================================
-- 4. Permission `manage_kasse`
-- ============================================
-- `initializeDefaultPermissions()` in server/db.ts seedet nur, solange
-- `role_permissions` komplett leer ist — auf einer bestehenden DB passiert
-- also nichts. Darum hier von Hand (INSERT IGNORE wegen dem Unique-Index
-- `uniquePermissionRole`, damit ein zweiter Lauf nicht knallt).

INSERT IGNORE INTO `role_permissions` (`permissionKey`, `role`) VALUES
	('manage_kasse', 'admin'),
	('manage_kasse', 'maintainer');

-- ============================================
-- 5. Kein Seed nötig
-- ============================================
-- Die Single-Row `kasse_settings` (id=1, frischer accessToken) legt
-- `getKasseSettings()` beim ersten Zugriff selbst an — nichts zu tun.
-- Produkte, Zusätze und Tische werden über /kasse/control gepflegt.
