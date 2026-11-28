ALTER TABLE order_items
  ADD COLUMN preorder_received_quantity INT UNSIGNED NOT NULL DEFAULT 0;
