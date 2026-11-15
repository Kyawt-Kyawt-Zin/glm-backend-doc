ALTER TABLE categories
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER is_active,
  ADD COLUMN deleted_by BIGINT UNSIGNED NULL AFTER deleted_at,
  ADD COLUMN delete_reason VARCHAR(255) NULL AFTER deleted_by,
  ADD INDEX idx_categories_deleted_at (deleted_at),
  ADD CONSTRAINT fk_categories_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;