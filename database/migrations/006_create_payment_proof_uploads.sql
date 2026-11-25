CREATE TABLE IF NOT EXISTS payment_proof_uploads (
  id CHAR(36) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,

  staging_key VARCHAR(512) NOT NULL,
  final_key VARCHAR(512) DEFAULT NULL,

  content_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_proof_uploads_staging_key (staging_key),
  KEY idx_payment_proof_uploads_payment (payment_id, customer_id),
  KEY idx_payment_proof_uploads_expiry (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;