-- Add manage_attendance permission for admin and maintainer roles
-- Run this after creating the attendance tables

INSERT INTO role_permissions (permissionKey, role) 
VALUES 
  ('manage_attendance', 'admin'),
  ('manage_attendance', 'maintainer')
ON DUPLICATE KEY UPDATE permissionKey = permissionKey;
