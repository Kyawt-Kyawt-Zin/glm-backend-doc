CREATE TABLE IF NOT EXISTS email_notification_jobs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(20) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_token CHAR(36) DEFAULT NULL,
  lease_until DATETIME DEFAULT NULL,
  last_error_code VARCHAR(80) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME DEFAULT NULL,
  INDEX idx_email_jobs_due (status, next_attempt_at, lease_until)
);
