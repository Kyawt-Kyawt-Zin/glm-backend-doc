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
        AND payments.status = 'pending'
        AND orders.status <> 'cancelled'
      ORDER BY payments.created_at ASC
    `,
  );

  return rows;
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
    [
      refundAmount,
      refundReference,
      refundedBy,
      refundNotes,
      paymentId,
    ],
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