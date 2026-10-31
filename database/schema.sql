USE golden_loom_myanmar;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  role ENUM('customer', 'staff', 'admin') NOT NULL DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT,
  target_gender ENUM('men', 'women', 'unisex') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  color VARCHAR(50) NOT NULL,
  size VARCHAR(30) NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  fulfillment_type ENUM('in_stock', 'preorder') NOT NULL,
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  preorder_lead_days SMALLINT UNSIGNED,
  deposit_percentage DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_product_variants_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT uq_product_variant
    UNIQUE (product_id, color, size)
);

CREATE TABLE carts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'checked_out', 'abandoned') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_carts_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  INDEX idx_carts_user_status (user_id, status)
);

CREATE TABLE cart_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id BIGINT UNSIGNED NOT NULL,
  product_variant_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_cart_items_cart
    FOREIGN KEY (cart_id)
    REFERENCES carts(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_cart_items_product_variant
    FOREIGN KEY (product_variant_id)
    REFERENCES product_variants(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  UNIQUE KEY unique_cart_variant (cart_id, product_variant_id)
);

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,

  fulfillment_type ENUM('in_stock', 'preorder') NOT NULL,

  status ENUM(
    'pending',
    'confirmed',
    'processing',
    'ready_for_delivery',
    'out_for_delivery',
    'ready_for_pickup',
    'delivered',
    'cancelled'
  ) NOT NULL DEFAULT 'pending',

  payment_method ENUM(
    'cash_on_delivery',
    'bank_transfer'
  ) NOT NULL,

  payment_status ENUM(
  'unpaid',
  'deposit_pending',
  'deposit_submitted',
  'deposit_confirmed',
  'paid',
  'refund_pending',
  'refunded'
) NOT NULL DEFAULT 'unpaid',

  delivery_method ENUM(
    'standard',
    'quick',
    'pickup'
  ) DEFAULT NULL,

  recipient_name VARCHAR(100) NOT NULL,
  recipient_phone VARCHAR(30) NOT NULL,
  delivery_address TEXT DEFAULT NULL,
  pickup_time_slot VARCHAR(100) DEFAULT NULL,

  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10, 2) NOT NULL,

  deposit_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,

  estimated_ready_date DATE DEFAULT NULL,

  preorder_terms_accepted_at TIMESTAMP NULL,
  preorder_terms_version VARCHAR(20) NULL,
  confirmed_at TIMESTAMP NULL,
  cancellation_deadline TIMESTAMP NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  INDEX idx_orders_user_created (user_id, created_at),
  INDEX idx_orders_status (status)
);

CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  product_variant_id BIGINT UNSIGNED NOT NULL,

  product_name VARCHAR(150) NOT NULL,
  product_slug VARCHAR(180) NOT NULL,
  category_name VARCHAR(100) NOT NULL,

  color VARCHAR(50) NOT NULL,
  size VARCHAR(30) NOT NULL,
  sku VARCHAR(100) NOT NULL,

  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,

  preorder_lead_days SMALLINT UNSIGNED DEFAULT NULL,
  deposit_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_order_items_product_variant
    FOREIGN KEY (product_variant_id)
    REFERENCES product_variants(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  UNIQUE KEY unique_order_variant (order_id, product_variant_id)
);

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,

  payment_type ENUM(
    'deposit',
    'remaining_balance',
    'full_payment'
  ) NOT NULL,

  payment_method ENUM(
    'cash_on_delivery',
    'bank_transfer'
  ) NOT NULL,

  amount DECIMAL(10, 2) NOT NULL,

  status ENUM(
    'pending',
    'submitted',
    'confirmed',
    'rejected',
    'refunded'
  ) NOT NULL DEFAULT 'pending',

  payment_proof_path VARCHAR(255) DEFAULT NULL,
  transaction_reference VARCHAR(100) DEFAULT NULL,

  confirmed_by BIGINT UNSIGNED DEFAULT NULL,
  confirmed_at TIMESTAMP NULL DEFAULT NULL,
  refund_amount DECIMAL(10,2) NULL,
  refund_reference VARCHAR(150) NULL,
  refunded_by BIGINT UNSIGNED NULL,
  refunded_at TIMESTAMP NULL,
  refund_notes TEXT NULL,
  notes TEXT DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_payments_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_payments_confirmed_by
    FOREIGN KEY (confirmed_by)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT fk_payment_refunded_by
  FOREIGN KEY (refunded_by) REFERENCES users(id)
  ON UPDATE CASCADE
  ON DELETE SET NULL,

  INDEX idx_payments_order (order_id),
  INDEX idx_payments_status (status)
);

INSERT INTO delivery_zones (
  name,
  area_description,
  standard_fee,
  quick_fee
)
VALUES
  (
    'Rigga and Union',
    'Al Rigga, Union, and BurJuman — Dubai only',
    10.00,
    20.00
  ),
  (
    'ADCB to Dubai Mall',
    'Areas from ADCB to Dubai Mall — Dubai only',
    15.00,
    25.00
  ),
  (
    'Other Dubai Areas',
    'All Green Line areas and areas after Dubai Mall — Dubai only',
    20.00,
    30.00
  );

  ALTER TABLE orders
  MODIFY COLUMN payment_method ENUM(
    'cash_on_delivery',
    'cash_on_pickup',
    'bank_transfer',
    'split_payment'
  ) NOT NULL;

  ALTER TABLE payments
  MODIFY COLUMN payment_method ENUM(
    'cash_on_delivery',
    'cash_on_pickup',
    'bank_transfer'
  ) NOT NULL;

  ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'pending',
    'confirmed',
    'processing',
    'ready_for_delivery',
    'out_for_delivery',
    'ready_for_pickup',
    'delivered',
    'picked_up',
    'cancelled'
  ) NOT NULL DEFAULT 'pending';

  CREATE TABLE order_change_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL,

  request_type ENUM('change_variant', 'cancel_order') NOT NULL,
  requested_variant_id BIGINT UNSIGNED NULL,
  customer_note TEXT NULL,
  deposit_forfeit_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  deposit_forfeit_acknowledged_at TIMESTAMP NULL,

  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  staff_note TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_change_request_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_change_request_customer
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_change_request_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_change_request_variant
    FOREIGN KEY (requested_variant_id) REFERENCES product_variants(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_change_request_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  INDEX idx_change_request_order (order_id),
  INDEX idx_change_request_customer_status (user_id, status),
  INDEX idx_change_request_status (status)
);

-- Migration: add refund-pending payment state for cancelled paid orders
ALTER TABLE orders
  MODIFY payment_status ENUM(
    'unpaid',
    'deposit_pending',
    'deposit_submitted',
    'deposit_confirmed',
    'paid',
    'refund_pending',
    'refunded'
  ) NOT NULL DEFAULT 'unpaid';

  payment_status ENUM(
  'unpaid',
  'deposit_pending',
  'deposit_submitted',
  'deposit_confirmed',
  'deposit_forfeited',
  'paid',
  'refund_pending',
  'refunded'
) NOT NULL DEFAULT 'unpaid',

-- Migration: preorder cancellation and refund policy
ALTER TABLE orders
  MODIFY payment_status ENUM(
    'unpaid',
    'deposit_pending',
    'deposit_submitted',
    'deposit_confirmed',
    'deposit_forfeited',
    'paid',
    'refund_pending',
    'refunded'
  ) NOT NULL DEFAULT 'unpaid';

  ALTER TABLE orders
  ADD COLUMN preorder_terms_accepted_at TIMESTAMP NULL
    AFTER estimated_ready_date,
  ADD COLUMN preorder_terms_version VARCHAR(20) NULL
    AFTER preorder_terms_accepted_at,
  ADD COLUMN confirmed_at TIMESTAMP NULL
    AFTER preorder_terms_version,
  ADD COLUMN cancellation_deadline TIMESTAMP NULL
    AFTER confirmed_at;

    ALTER TABLE order_change_requests
  ADD COLUMN deposit_forfeit_acknowledged BOOLEAN NOT NULL DEFAULT FALSE
    AFTER customer_note,
  ADD COLUMN deposit_forfeit_acknowledged_at TIMESTAMP NULL
    AFTER deposit_forfeit_acknowledged;

    -- Migration: record completed manual refunds
ALTER TABLE payments
  ADD COLUMN refund_amount DECIMAL(10,2) NULL
    AFTER confirmed_at,
  ADD COLUMN refund_reference VARCHAR(150) NULL
    AFTER refund_amount,
  ADD COLUMN refunded_by BIGINT UNSIGNED NULL
    AFTER refund_reference,
  ADD COLUMN refunded_at TIMESTAMP NULL
    AFTER refunded_by,
  ADD COLUMN refund_notes TEXT NULL
    AFTER refunded_at,
  ADD CONSTRAINT fk_payment_refunded_by
    FOREIGN KEY (refunded_by) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  alt_text VARCHAR(180) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE RESTRICT
);