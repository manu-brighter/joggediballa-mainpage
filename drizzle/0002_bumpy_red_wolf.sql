CREATE TABLE `goennermitglieder` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`street` varchar(255) NOT NULL,
	`houseNumber` varchar(20) NOT NULL,
	`zipCode` varchar(10) NOT NULL,
	`city` varchar(100) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`membershipStartDate` timestamp NOT NULL,
	`membershipEndDate` timestamp NOT NULL,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdBy` int,
	CONSTRAINT `goennermitglieder_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `profilePictureUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profilePictureKey` text;--> statement-breakpoint
ALTER TABLE `goennermitglieder` ADD CONSTRAINT `goennermitglieder_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;