CREATE TABLE bank_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  label VARCHAR(100) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_holder VARCHAR(150) NOT NULL,
  account_number VARCHAR(80) NOT NULL,
  iban VARCHAR(50) DEFAULT NULL,
  branch_name VARCHAR(100) DEFAULT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'AED',
  transfer_instructions TEXT DEFAULT NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_bank_accounts_active_order (is_active, display_order)
);