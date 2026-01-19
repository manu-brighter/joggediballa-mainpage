CREATE TABLE `user_activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userName` varchar(255),
	`action` varchar(100) NOT NULL,
	`details` text,
	`ipAddress` varchar(45),
	`userAgent` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user_activity_log` ADD CONSTRAINT `user_activity_log_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;