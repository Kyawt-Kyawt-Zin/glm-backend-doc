CREATE TABLE preorder_checkout_drafts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  active_user_id BIGINT UNSIGNED DEFAULT NULL,
  active_cart_id BIGINT UNSIGNED DEFAULT NULL,
  checkout_data JSON NOT NULL,
  items_snapshot JSON NOT NULL,
  deposit_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  staging_key VARCHAR(512) DEFAULT NULL,
  content_type VARCHAR(50) DEFAULT NULL,
  order_id BIGINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_preorder_draft_active_cart (active_cart_id),
  UNIQUE KEY uq_preorder_draft_active_user (active_user_id),
  KEY idx_preorder_draft_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
