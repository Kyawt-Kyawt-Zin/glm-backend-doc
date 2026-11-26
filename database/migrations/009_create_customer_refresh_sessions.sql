CREATE TABLE IF NOT EXISTS customer_refresh_sessions (
  id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_refresh_sessions_token_hash (token_hash),
  KEY idx_customer_refresh_sessions_user (user_id),
  KEY idx_customer_refresh_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;