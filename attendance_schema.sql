-- Anwesenheitssystem für Jogge di Balla
-- Erstellt: 2026-02-16

-- Tabelle für Meetings und Events
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('meeting', 'event') NOT NULL DEFAULT 'meeting',
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_date (date),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Mitglieder (separate von team_members für Flexibilität)
CREATE TABLE IF NOT EXISTS attendance_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  isActive BOOLEAN DEFAULT TRUE NOT NULL,
  displayOrder INT DEFAULT 0 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_active (isActive),
  INDEX idx_order (displayOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Anwesenheitseinträge
CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sessionId INT NOT NULL,
  memberId INT NOT NULL,
  status ENUM('present', 'partial', 'absent') NOT NULL DEFAULT 'absent',
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (sessionId) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (memberId) REFERENCES attendance_members(id) ON DELETE CASCADE,
  UNIQUE KEY unique_session_member (sessionId, memberId),
  INDEX idx_session (sessionId),
  INDEX idx_member (memberId),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle für Event-Gewichtung (Settings)
CREATE TABLE IF NOT EXISTS attendance_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  settingKey VARCHAR(100) NOT NULL UNIQUE,
  settingValue TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Event-Gewichtung einfügen
INSERT INTO attendance_settings (settingKey, settingValue) 
VALUES ('event_weight_multiplier', '2.0')
ON DUPLICATE KEY UPDATE settingValue = settingValue;

-- Kommentare für Dokumentation
ALTER TABLE attendance_sessions 
  COMMENT = 'Speichert Meetings und Events für Anwesenheitsverfolgung';

ALTER TABLE attendance_members 
  COMMENT = 'Mitglieder für Anwesenheitsliste (separate von team_members für temporäre Helfer)';

ALTER TABLE attendance_records 
  COMMENT = 'Anwesenheitseinträge pro Session und Mitglied';

ALTER TABLE attendance_settings 
  COMMENT = 'Einstellungen für Anwesenheitssystem (z.B. Event-Gewichtung)';

-- Berechtigungen für Anwesenheitsverwaltung hinzufügen
INSERT INTO role_permissions (permissionKey, role) 
VALUES 
  ('manage_attendance', 'admin'),
  ('manage_attendance', 'maintainer')
ON DUPLICATE KEY UPDATE permissionKey = permissionKey;
