-- Migration: Add Schlag den Kassier (SDK) overlay tables
-- Run manually on the production database

CREATE TABLE `sdk_session` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `player1Name` varchar(100) NOT NULL DEFAULT 'Kassier',
  `player2Name` varchar(100) NOT NULL DEFAULT 'Kandidat',
  `totalGames` int NOT NULL DEFAULT 10,
  `currentGame` int NOT NULL DEFAULT 1,
  `currentGameName` varchar(255) DEFAULT '',
  `player1Score` int NOT NULL DEFAULT 0,
  `player2Score` int NOT NULL DEFAULT 0,
  `isActive` boolean NOT NULL DEFAULT true,
  `winnerId` int,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `createdBy` int,
  CONSTRAINT `sdk_session_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`)
);

CREATE TABLE `sdk_game_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `sessionId` int NOT NULL,
  `gameNumber` int NOT NULL,
  `gameName` varchar(255) DEFAULT '',
  `pointsAwarded` int NOT NULL,
  `winnerId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT `sdk_game_log_sessionId_sdk_session_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sdk_session`(`id`) ON DELETE CASCADE
);
