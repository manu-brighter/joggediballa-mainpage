-- Migration: Add showTitle column to sdk_session
-- Run manually on the production database

ALTER TABLE `sdk_session`
  ADD COLUMN `showTitle` varchar(150) NOT NULL DEFAULT 'Schlag den Kassier'
  AFTER `id`;
