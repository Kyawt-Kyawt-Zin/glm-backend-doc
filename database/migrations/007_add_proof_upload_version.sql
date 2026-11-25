SET @database_name = DATABASE();

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = @database_name
        AND table_name = 'payment_proof_uploads'
        AND column_name = 'staging_version_id'
    ),
    'SELECT ''payment_proof_uploads.staging_version_id already exists'' AS status',
    'ALTER TABLE payment_proof_uploads
      ADD COLUMN staging_version_id VARCHAR(1024) NULL
      AFTER staging_key'
  )
);

PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;