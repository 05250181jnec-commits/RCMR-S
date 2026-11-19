CREATE DATABASE IF NOT EXISTS rcmrs_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE rcmrs_dev;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Citizen', 'Maintenance', 'Admin') NOT NULL DEFAULT 'Citizen',
  team VARCHAR(150) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  road_name VARCHAR(100) NOT NULL,
  location VARCHAR(150) NOT NULL,
  road_type VARCHAR(40) NOT NULL,
  condition_type VARCHAR(60) NOT NULL,
  priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  status ENUM('Pending', 'In Progress', 'Completed') NOT NULL DEFAULT 'Pending',
  description TEXT NOT NULL,
  image_path VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_reports_user_created (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id),
  INDEX sessions_expires_idx (expires)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contractors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  report_id INT UNSIGNED NOT NULL UNIQUE,
  contractor_id INT UNSIGNED NOT NULL,
  deadline DATE NOT NULL,
  status ENUM('Assigned', 'In Progress', 'Pending Approval', 'Completed')
    NOT NULL DEFAULT 'Assigned',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_report
    FOREIGN KEY (report_id) REFERENCES reports(id),
  CONSTRAINT fk_tasks_contractor
    FOREIGN KEY (contractor_id) REFERENCES contractors(id)
) ENGINE=InnoDB;

INSERT IGNORE INTO contractors (name) VALUES
  ('Highlight Ltd'),
  ('CDCL Ltd'),
  ('PWD'),
  ('Thromde');