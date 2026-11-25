CREATE TABLE IF NOT EXISTS product_image_uploads (
  id CHAR(36) NOT NULL,
  staff_user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_variant_id BIGINT UNSIGNED DEFAULT NULL,

  staging_key VARCHAR(512) NOT NULL,
  staging_version_id VARCHAR(1024) DEFAULT NULL,
  final_key VARCHAR(512) NOT NULL,
  content_type VARCHAR(50) NOT NULL,

  alt_text VARCHAR(180) DEFAULT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,

  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  product_image_id BIGINT UNSIGNED DEFAULT NULL,
  expires_at DATETIME NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_product_image_uploads_staging_key (staging_key),
  KEY idx_product_image_uploads_product (product_id, staff_user_id),
  KEY idx_product_image_uploads_expiry (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;