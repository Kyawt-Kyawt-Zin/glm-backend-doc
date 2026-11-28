import pool from "../helper/db_helper.js";

export const getConnection = async () => {
  return pool.getConnection();
};

export const findPendingDeposits = async () => {
  const [rows] = await pool.execute(
    `
      SELECT
        payments.id,
        payments.order_id,
        payments.amount,
        payments.payment_method,
        payments.status,
        payments.created_at,

        orders.order_number,
        orders.status AS order_status,
        orders.payment_status,

        users.full_name AS customer_name,
        users.email AS customer_email,
        users.phone AS customer_phone
      FROM payments
      INNER JOIN orders ON orders.id = payments.order_id
      INNER JOIN users ON users.id = orders.user_id
      WHERE payments.payment_type = 'deposit'
        AND payments.status = 'submitted'
        AND orders.status <> 'cancelled'
      ORDER BY payments.created_at ASC
    `,
  );

  return rows;
};

export const findPaymentByIdForManagement = async (paymentId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        payments.id,
        payments.order_id,
        payments.payment_type,
        payments.payment_method,
        payments.amount,
        payments.status AS payment_record_status,
        payments.payment_proof_path,
        payments.payment_proof_driver,
        payments.payment_proof_storage_key,
        payments.transaction_reference,
        payments.notes,
        payments.confirmed_at,
        payments.refund_amount,
        payments.refund_reference,
        payments.refund_notes,
        payments.refunded_at,
        payments.created_at,
        payments.updated_at,

        CASE
        WHEN payments.payment_proof_path IS NOT NULL
        OR payments.payment_proof_storage_key IS NOT NULL
        THEN TRUE
        ELSE FALSE
        END AS has_payment_proof,

        orders.order_number,
        orders.fulfillment_type,
        orders.status AS order_status,
        orders.payment_status,
        orders.delivery_method,
        orders.delivery_zone_name,
        orders.total_amount,

        users.full_name AS customer_name,
        users.email AS customer_email,
        users.phone AS customer_phone,

        confirming_staff.full_name AS confirmed_by_name,
        refund_staff.full_name AS refunded_by_name

      FROM payments
      INNER JOIN orders ON orders.id = payments.order_id
      INNER JOIN users ON users.id = orders.user_id
      LEFT JOIN users AS confirming_staff
        ON confirming_staff.id = payments.confirmed_by
      LEFT JOIN users AS refund_staff
        ON refund_staff.id = payments.refunded_by
      WHERE payments.id = ?
      LIMIT 1
    `,
    [paymentId],
  );

  return rows[0] || null;
};

export const findDepositByIdForUpdate = async (connection, paymentId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        payments.id,
        payments.order_id,
        payments.payment_type,
        payments.payment_method,
        payments.amount,
        payments.status AS payment_record_status,
        payments.payment_proof_path,
        payments.payment_proof_driver,
        payments.payment_proof_storage_key,

        orders.fulfillment_type,
        orders.status AS order_status,
        orders.payment_status
      FROM payments
      INNER JOIN orders ON orders.id = payments.order_id
      WHERE payments.id = ?
      FOR UPDATE
    `,
    [paymentId],
  );

  return rows[0] || null;
};

export const findCustomerDepositByIdForUpdate = async (
  connection,
  paymentId,
  userId,
) => {
  const [rows] = await connection.execute(
    `
      SELECT
        payments.id,
        payments.order_id,
        payments.payment_type,
        payments.payment_method,
        payments.amount,
        payments.status AS payment_record_status,
        payments.payment_proof_path,
        payments.payment_proof_driver,
        payments.payment_proof_storage_key,

        orders.order_number,
        orders.fulfillment_type,
        orders.status AS order_status,
        orders.payment_status
      FROM payments
      INNER JOIN orders
        ON orders.id = payments.order_id
      WHERE payments.id = ?
        AND orders.user_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [paymentId, userId],
  );

  return rows[0] || null;
};

export const submitDepositProof = async ({
  connection,
  paymentId,
  transactionReference,
  paymentProofPath,
  paymentProofDriver = "local",
  paymentProofStorageKey = null,
}) => {
  await connection.execute(
    `
      UPDATE payments
      SET
        status = 'submitted',
        transaction_reference = ?,
        payment_proof_path = ?,
        payment_proof_driver = ?,
        payment_proof_storage_key = ?
      WHERE id = ?
    `,
    [
      transactionReference,
      paymentProofPath,
      paymentProofDriver,
      paymentProofStorageKey,
      paymentId,
    ],
  );
  // Keep the order-level summary aligned with the submitted payment. Do not
  // overwrite a later state such as confirmed or refunded.
  await connection.execute(
    `UPDATE orders AS o
     INNER JOIN payments AS p ON p.order_id = o.id
     SET o.payment_status = 'deposit_submitted'
     WHERE p.id = ? AND p.payment_type = 'deposit'
       AND o.fulfillment_type = 'preorder'
       AND o.payment_status = 'deposit_pending'`,
    [paymentId],
  );
};

export const confirmDeposit = async ({
  connection,
  paymentId,
  transactionReference,
  notes,
  confirmedBy,
}) => {
  await connection.execute(
    `
      UPDATE payments
      SET
        status = 'confirmed',
        transaction_reference = ?,
        notes = ?,
        confirmed_by = ?,
        confirmed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [transactionReference, notes, confirmedBy, paymentId],
  );
};

export const setOrderDepositConfirmed = async (connection, orderId) => {
  await connection.execute(
    `
      UPDATE orders
      SET payment_status = 'deposit_confirmed'
      WHERE id = ?
    `,
    [orderId],
  );
};

export const findRefundPendingPayments = async () => {
  const [rows] = await pool.execute(
    `
      SELECT
        payments.id,
        payments.order_id,
        payments.amount,
        payments.payment_method,
        payments.transaction_reference,
        payments.status AS payment_record_status,

        orders.order_number,
        orders.status AS order_status,
        orders.payment_status,

        users.full_name AS customer_name,
        users.email AS customer_email,
        users.phone AS customer_phone
      FROM payments
      INNER JOIN orders ON orders.id = payments.order_id
      INNER JOIN users ON users.id = orders.user_id
      WHERE payments.payment_type = 'deposit'
        AND payments.status = 'confirmed'
        AND orders.status = 'cancelled'
        AND orders.payment_status = 'refund_pending'
      ORDER BY orders.updated_at ASC
    `,
  );

  return rows;
};

export const findRefundablePaymentByIdForUpdate = async (
  connection,
  paymentId,
) => {
  const [rows] = await connection.execute(
    `
      SELECT
        payments.id,
        payments.order_id,
        payments.payment_type,
        payments.amount,
        payments.status AS payment_record_status,

        orders.status AS order_status,
        orders.payment_status
      FROM payments
      INNER JOIN orders ON orders.id = payments.order_id
      WHERE payments.id = ?
      FOR UPDATE
    `,
    [paymentId],
  );

  return rows[0] || null;
};

export const completeRefund = async ({
  connection,
  paymentId,
  refundAmount,
  refundReference,
  refundNotes,
  refundedBy,
}) => {
  await connection.execute(
    `
      UPDATE payments
      SET
        status = 'refunded',
        refund_amount = ?,
        refund_reference = ?,
        refunded_by = ?,
        refunded_at = CURRENT_TIMESTAMP,
        refund_notes = ?
      WHERE id = ?
    `,
    [refundAmount, refundReference, refundedBy, refundNotes, paymentId],
  );
};

export const setOrderRefunded = async (connection, orderId) => {
  await connection.execute(
    `
      UPDATE orders
      SET payment_status = 'refunded'
      WHERE id = ?
    `,
    [orderId],
  );
};

export const createPaymentProofUpload = async ({
  connection,
  id,
  customerId,
  paymentId,
  stagingKey,
  finalKey,
  contentType,
  expiresInSeconds,
}) => {
  await connection.execute(
    `
      INSERT INTO payment_proof_uploads (
        id,
        customer_id,
        payment_id,
        staging_key,
        final_key,
        content_type,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))
    `,
    [
      id,
      customerId,
      paymentId,
      stagingKey,
      finalKey,
      contentType,
      expiresInSeconds,
    ],
  );
};

export const findPaymentProofUploadForUpdate = async ({
  connection,
  id,
  customerId,
  paymentId,
}) => {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        customer_id,
        payment_id,
        staging_key,
        staging_version_id,
        final_key,
        content_type,
        status,
        expires_at,
        expires_at > UTC_TIMESTAMP() AS is_unexpired
      FROM payment_proof_uploads
      WHERE id = ?
        AND customer_id = ?
        AND payment_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [id, customerId, paymentId],
  );

  return rows[0] || null;
};

export const markPaymentProofUploadCompleted = async ({
  connection,
  id,
  customerId,
  paymentId,
  stagingVersionId,
  finalKey,
}) => {
  const [result] = await connection.execute(
    `
      UPDATE payment_proof_uploads
      SET
        status = 'completed',
        staging_version_id = ?,
        final_key = ?
      WHERE id = ?
        AND customer_id = ?
        AND payment_id = ?
        AND status = 'pending'
    `,
    [stagingVersionId, finalKey, id, customerId, paymentId],
  );

  return result.affectedRows;
};

export const listExpiredPaymentProofUploads = async (limit = 50) => {
  const batchSize = Math.min(
    100,
    Math.max(1, Number.isInteger(limit) ? limit : 50),
  );

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        customer_id,
        payment_id,
        staging_key,
        final_key,
        expires_at
      FROM payment_proof_uploads
      WHERE status = 'pending'
        AND expires_at <= UTC_TIMESTAMP()
      ORDER BY expires_at ASC
      LIMIT ?
    `,
    [batchSize],
  );

  return rows;
};

export const markPaymentProofUploadCleaned = async ({
  connection,
  id,
  customerId,
  paymentId,
}) => {
  const [result] = await connection.execute(
    `
      UPDATE payment_proof_uploads
      SET status = 'cleaned'
      WHERE id = ?
        AND customer_id = ?
        AND payment_id = ?
        AND status = 'pending'
        AND expires_at <= UTC_TIMESTAMP()
    `,
    [id, customerId, paymentId],
  );

  return result.affectedRows;
};

export const findPaymentUsingProofStorageKeyForUpdate = async (
  connection,
  storageKey,
) => {
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM payments
      WHERE payment_proof_storage_key = ?
      LIMIT 1
      FOR UPDATE
    `,
    [storageKey],
  );

  return rows[0] || null;
};
