CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`permissionKey` varchar(100) NOT NULL,
	`role` enum('admin','maintainer','editor','user') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_permissions_permissionKey_role_unique` UNIQUE(`permissionKey`,`role`)
);
--> statement-breakpoint
ALTER TABLE `goennermitglieder` ADD `paymentStatus` enum('paid','pending') DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE `goennermitglieder` ADD `paymentPendingSince` timestamp;--> statement-breakpoint
ALTER TABLE `goennermitglieder` ADD `contributionAmount` int DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `compressedUrl` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `compressedKey` text;--> statement-breakpoint
ALTER TABLE `shotcounter_teams` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `team_members` ADD `compressedPhotoUrl` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `compressedPhotoKey` text;