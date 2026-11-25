SET @database_name = DATABASE();

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @database_name
        AND table_name = 'product_images'
        AND column_name = 'media_driver'
    ),
    'SELECT ''product_images.media_driver already exists'' AS status',
    'ALTER TABLE product_images
      ADD COLUMN media_driver VARCHAR(20) NOT NULL DEFAULT ''local''
      AFTER image_path'
  )
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @database_name
        AND table_name = 'product_images'
        AND column_name = 'storage_key'
    ),
    'SELECT ''product_images.storage_key already exists'' AS status',
    'ALTER TABLE product_images
      ADD COLUMN storage_key VARCHAR(1024) NULL
      AFTER media_driver'
  )
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @database_name
        AND table_name = 'payments'
        AND column_name = 'payment_proof_driver'
    ),
    'SELECT ''payments.payment_proof_driver already exists'' AS status',
    'ALTER TABLE payments
      ADD COLUMN payment_proof_driver VARCHAR(20) NOT NULL DEFAULT ''local''
      AFTER payment_proof_path'
  )
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @database_name
        AND table_name = 'payments'
        AND column_name = 'payment_proof_storage_key'
    ),
    'SELECT ''payments.payment_proof_storage_key already exists'' AS status',
    'ALTER TABLE payments
      ADD COLUMN payment_proof_storage_key VARCHAR(1024) NULL
      AFTER payment_proof_driver'
  )
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;