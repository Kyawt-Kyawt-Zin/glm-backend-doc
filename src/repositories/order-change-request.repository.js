import pool from "../helper/db_helper.js";

export const findOrderByIdAndUserId = async (orderId, userId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, status, fulfillment_type, payment_status
      FROM orders
      WHERE id = ? AND user_id = ?
    `,
    [orderId, userId],
  );

  return rows[0] || null;
};

export const findOrderItemByIdAndOrderId = async (orderItemId, orderId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, product_id, product_variant_id
      FROM order_items
      WHERE id = ? AND order_id = ?
    `,
    [orderItemId, orderId],
  );

  return rows[0] || null;
};

export const findActiveVariantById = async (variantId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        product_variants.id,
        product_variants.product_id,
        product_variants.color,
        product_variants.size,
        product_variants.is_active,
        products.is_active AS product_is_active
      FROM product_variants
      INNER JOIN products ON products.id = product_variants.product_id
      WHERE product_variants.id = ?
    `,
    [variantId],
  );

  return rows[0] || null;
};

export const findPendingRequest = async (
  orderId,
  userId,
  requestType,
  orderItemId,
) => {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM order_change_requests
      WHERE order_id = ?
        AND user_id = ?
        AND request_type = ?
        AND order_item_id <=> ?
        AND status = 'pending'
    `,
    [orderId, userId, requestType, orderItemId],
  );

  return rows[0] || null;
};

export const create = async ({
  orderId,
  userId,
  orderItemId,
  requestType,
  requestedVariantId,
  customerNote,
}) => {
  const [result] = await pool.execute(
    `
      INSERT INTO order_change_requests (
        order_id,
        user_id,
        order_item_id,
        request_type,
        requested_variant_id,
        customer_note
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      orderId,
      userId,
      orderItemId,
      requestType,
      requestedVariantId,
      customerNote,
    ],
  );

  return result.insertId;
};

export const findAllByUserId = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        order_change_requests.id,
        order_change_requests.request_type,
        order_change_requests.customer_note,
        order_change_requests.status,
        order_change_requests.staff_note,
        order_change_requests.reviewed_at,
        order_change_requests.created_at,

        orders.order_number,
        orders.fulfillment_type,
        orders.status AS order_status,

        order_items.product_name,
        order_items.color AS current_color,
        order_items.size AS current_size,

        product_variants.color AS requested_color,
        product_variants.size AS requested_size
      FROM order_change_requests
      INNER JOIN orders ON orders.id = order_change_requests.order_id
      LEFT JOIN order_items ON order_items.id = order_change_requests.order_item_id
      LEFT JOIN product_variants
        ON product_variants.id = order_change_requests.requested_variant_id
      WHERE order_change_requests.user_id = ?
      AND orders.status <> 'cancelled'
      ORDER BY order_change_requests.created_at DESC
    `,
    [userId],
  );

  return rows;
};

export const findAllForManagement = async () => {
  const [rows] = await pool.execute(
    `
      SELECT
        order_change_requests.id,
        order_change_requests.request_type,
        order_change_requests.customer_note,
        order_change_requests.status,
        order_change_requests.staff_note,
        order_change_requests.reviewed_at,
        order_change_requests.created_at,

        orders.order_number,
        orders.fulfillment_type,
        orders.status AS order_status,

        users.full_name AS customer_name,
        users.email AS customer_email,
        users.phone AS customer_phone,

        order_items.product_name,
        order_items.color AS current_color,
        order_items.size AS current_size,

        product_variants.color AS requested_color,
        product_variants.size AS requested_size
      FROM order_change_requests
      INNER JOIN orders ON orders.id = order_change_requests.order_id
      INNER JOIN users ON users.id = order_change_requests.user_id
      LEFT JOIN order_items ON order_items.id = order_change_requests.order_item_id
      LEFT JOIN product_variants
        ON product_variants.id = order_change_requests.requested_variant_id
        WHERE orders.status <> 'cancelled'
      ORDER BY
        CASE order_change_requests.status
          WHEN 'pending' THEN 0
          ELSE 1
        END,
        order_change_requests.created_at DESC
    `,
  );

  return rows;
};

export const findByIdForManagement = async (requestId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        order_id,
        user_id,
        order_item_id,
        request_type,
        requested_variant_id,
        status
      FROM order_change_requests
      WHERE id = ?
    `,
    [requestId],
  );

  return rows[0] || null;
};

export const review = async ({ requestId, status, staffNote, reviewedBy }) => {
  const [result] = await pool.execute(
    `
      UPDATE order_change_requests
      SET
        status = ?,
        staff_note = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [status, staffNote, reviewedBy, requestId],
  );

  return result.affectedRows > 0;
};

export const getConnection = async () => {
  return pool.getConnection();
};

export const findByIdForReview = async (connection, requestId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        order_change_requests.id,
        order_change_requests.order_id,
        order_change_requests.order_item_id,
        order_change_requests.request_type,
        order_change_requests.requested_variant_id,
        order_change_requests.status,

        orders.fulfillment_type,
        orders.status AS order_status,
        orders.payment_status
      FROM order_change_requests
      INNER JOIN orders ON orders.id = order_change_requests.order_id
      WHERE order_change_requests.id = ?
      FOR UPDATE
    `,
    [requestId],
  );

  return rows[0] || null;
};

export const findOrderItemsForReview = async (connection, orderId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        product_variant_id,
        quantity
      FROM order_items
      WHERE order_id = ?
      FOR UPDATE
    `,
    [orderId],
  );

  return rows;
};

export const findOrderItemByIdForReview = async (
  connection,
  orderItemId,
  orderId,
) => {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        product_id,
        product_variant_id,
        unit_price,
        quantity
      FROM order_items
      WHERE id = ?
        AND order_id = ?
      FOR UPDATE
    `,
    [orderItemId, orderId],
  );

  return rows[0] || null;
};

export const findVariantByIdForReview = async (connection, variantId) => {
  const [rows] = await connection.execute(
    `
      SELECT
        product_variants.id,
        product_variants.product_id,
        product_variants.color,
        product_variants.size,
        product_variants.sku,
        product_variants.price,
        product_variants.fulfillment_type,
        product_variants.stock_quantity,
        product_variants.preorder_lead_days,
        product_variants.deposit_percentage,
        product_variants.is_active AS variant_is_active,
        products.is_active AS product_is_active
      FROM product_variants
      INNER JOIN products ON products.id = product_variants.product_id
      WHERE product_variants.id = ?
      FOR UPDATE
    `,
    [variantId],
  );

  return rows[0] || null;
};

export const decreaseVariantStock = async (connection, variantId, quantity) => {
  const [result] = await connection.execute(
    `
      UPDATE product_variants
      SET stock_quantity = stock_quantity - ?
      WHERE id = ?
        AND stock_quantity >= ?
    `,
    [quantity, variantId, quantity],
  );

  return result.affectedRows > 0;
};

export const increaseVariantStock = async (connection, variantId, quantity) => {
  await connection.execute(
    `
      UPDATE product_variants
      SET stock_quantity = stock_quantity + ?
      WHERE id = ?
    `,
    [quantity, variantId],
  );
};

export const updateOrderItemVariant = async ({
  connection,
  orderItemId,
  variant,
}) => {
  await connection.execute(
    `
      UPDATE order_items
      SET
        product_variant_id = ?,
        color = ?,
        size = ?,
        sku = ?,
        unit_price = ?,
        preorder_lead_days = ?,
        deposit_percentage = ?
      WHERE id = ?
    `,
    [
      variant.id,
      variant.color,
      variant.size,
      variant.sku,
      variant.price,
      variant.preorder_lead_days,
      variant.deposit_percentage,
      orderItemId,
    ],
  );
};

export const cancelOrder = async (connection, orderId, paymentStatus) => {
  await connection.execute(
    `
      UPDATE orders
      SET
        status = 'cancelled',
        payment_status = ?
      WHERE id = ?
    `,
    [paymentStatus, orderId],
  );
};

export const reviewWithinTransaction = async ({
  connection,
  requestId,
  status,
  staffNote,
  reviewedBy,
}) => {
  await connection.execute(
    `
      UPDATE order_change_requests
      SET
        status = ?,
        staff_note = ?,
        reviewed_by = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [status, staffNote, reviewedBy, requestId],
  );
};
