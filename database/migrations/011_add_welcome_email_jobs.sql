ALTER TABLE email_notification_jobs
  MODIFY order_id BIGINT UNSIGNED NULL,
  ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER order_id;
