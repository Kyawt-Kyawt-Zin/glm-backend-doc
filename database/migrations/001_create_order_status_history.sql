CREATE TABLE order_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,

  previous_status ENUM(
    'pending',
    'confirmed',
    'processing',
    'ready_for_delivery',
    'out_for_delivery',
    'ready_for_pickup',
    'delivered',
    'picked_up',
    'cancelled'
  ) NULL,

  new_status ENUM(
    'pending',
    'confirmed',
    'processing',
    'ready_for_delivery',
    'out_for_delivery',
    'ready_for_pickup',
    'delivered',
    'picked_up',
    'cancelled'
  ) NOT NULL,

  action_type ENUM(
    'created',
    'status_update',
    'correction'
  ) NOT NULL DEFAULT 'status_update',

  reason TEXT NULL,
  changed_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_order_status_history_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_order_status_history_changed_by
    FOREIGN KEY (changed_by)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  INDEX idx_order_status_history_order_created
    (order_id, created_at)
);