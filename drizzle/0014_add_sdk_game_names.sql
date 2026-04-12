-- Migration: Add gameNames column to sdk_session
-- Stores pre-defined game names as a JSON array, e.g. ["Dart","Quiz","Torwandschießen"]
-- Run manually on the production database

ALTER TABLE `sdk_session`
  ADD COLUMN `gameNames` text DEFAULT NULL
  AFTER `currentGameName`;
