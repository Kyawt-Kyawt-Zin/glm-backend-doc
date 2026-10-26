import pool from "../helper/db_helper.js";

export const getCheckoutConnection = async () => {
  return pool.getConnection();
};

export const findActiveCartForCheckout = async (connection, userId) => {
  const [carts] = await connection.execute(
    `SELECT
      id,
      user_id,
      status
    FROM carts
    WHERE user_id = ?
      AND status = 'active'
    LIMIT 1
    FOR UPDATE`,
    [userId],
  );

  return carts[0] || null;
};

export const getCartItemsForCheckout = async (connection, cartId) => {
  const [items] = await connection.execute(
    `SELECT
      cart_items.id AS cart_item_id,
      cart_items.product_variant_id,
      cart_items.quantity,

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

      products.name AS product_name,
      products.slug AS product_slug,
      products.is_active AS product_is_active,

      categories.name AS category_name,
      categories.is_active AS category_is_active
    FROM cart_items
    INNER JOIN product_variants
      ON product_variants.id = cart_items.product_variant_id
    INNER JOIN products
      ON products.id = product_variants.product_id
    INNER JOIN categories
      ON categories.id = products.category_id
    WHERE cart_items.cart_id = ?
    FOR UPDATE`,
    [cartId],
  );

  return items;
};

export const createOrder = async (connection, order) => {
  const [result] = await connection.execute(
    `INSERT INTO orders (
      order_number,
      user_id,
      fulfillment_type,
      status,
      payment_method,
      payment_status,
      delivery_method,
      delivery_zone_id,
      delivery_zone_name,
      recipient_name,
      recipient_phone,
      delivery_address,
      pickup_time_slot,
      subtotal,
      delivery_fee,
      total_amount,
      deposit_percentage,
      deposit_amount,
      estimated_ready_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.orderNumber,
      order.userId,
      order.fulfillmentType,
      order.status,
      order.paymentMethod,
      order.paymentStatus,
      order.deliveryMethod,
      order.deliveryZoneId,
      order.deliveryZoneName,
      order.recipientName,
      order.recipientPhone,
      order.deliveryAddress,
      order.pickupTimeSlot,
      order.subtotal,
      order.deliveryFee,
      order.totalAmount,
      order.depositPercentage,
      order.depositAmount,
      order.estimatedReadyDate,
    ],
  );

  return result.insertId;
};

export const createOrderItem = async (connection, item) => {
  const [result] = await connection.execute(
    `INSERT INTO order_items (
      order_id,
      product_id,
      product_variant_id,
      product_name,
      product_slug,
      category_name,
      color,
      size,
      sku,
      unit_price,
      quantity,
      line_total,
      preorder_lead_days,
      deposit_percentage
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.orderId,
      item.productId,
      item.productVariantId,
      item.productName,
      item.productSlug,
      item.categoryName,
      item.color,
      item.size,
      item.sku,
      item.unitPrice,
      item.quantity,
      item.lineTotal,
      item.preorderLeadDays,
      item.depositPercentage,
    ],
  );

  return result.insertId;
};

export const createPayment = async (connection, payment) => {
  const [result] = await connection.execute(
    `INSERT INTO payments (
      order_id,
      payment_type,
      payment_method,
      amount,
      status
    )
    VALUES (?, ?, ?, ?, ?)`,
    [
      payment.orderId,
      payment.paymentType,
      payment.paymentMethod,
      payment.amount,
      payment.status,
    ],
  );

  return result.insertId;
};

export const decreaseVariantStock = async (
  connection,
  productVariantId,
  quantity,
) => {
  const [result] = await connection.execute(
    `UPDATE product_variants
    SET stock_quantity = stock_quantity - ?
    WHERE id = ?
      AND stock_quantity >= ?`,
    [quantity, productVariantId, quantity],
  );

  return result.affectedRows > 0;
};

export const deleteCartItemsByCartId = async (connection, cartId) => {
  await connection.execute(
    `DELETE FROM cart_items
    WHERE cart_id = ?`,
    [cartId],
  );
};

export const markCartCheckedOut = async (connection, cartId) => {
  await connection.execute(
    `UPDATE carts
    SET status = 'checked_out'
    WHERE id = ?`,
    [cartId],
  );
};

export const findAllByUserId = async (userId) => {
  const [orders] = await pool.execute(
    `SELECT
      id,
      order_number,
      fulfillment_type,
      status,
      payment_method,
      payment_status,
      delivery_method,
      delivery_zone_name,
      total_amount,
      deposit_amount,
      estimated_ready_date,
      created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC`,
    [userId],
  );

  return orders;
};

export const findByIdAndUserId = async (orderId, userId) => {
  const [orders] = await pool.execute(
    `SELECT
      id,
      order_number,
      user_id,
      fulfillment_type,
      status,
      payment_method,
      payment_status,
      delivery_method,
      delivery_zone_name,
      recipient_name,
      recipient_phone,
      delivery_address,
      pickup_time_slot,
      subtotal,
      delivery_fee,
      total_amount,
      deposit_percentage,
      deposit_amount,
      estimated_ready_date,
      created_at,
      updated_at
    FROM orders
    WHERE id = ?
      AND user_id = ?
    LIMIT 1`,
    [orderId, userId],
  );

  return orders[0] || null;
};

export const findItemsByOrderId = async (orderId) => {
  const [items] = await pool.execute(
    `SELECT
      id,
      product_name,
      product_slug,
      category_name,
      color,
      size,
      sku,
      unit_price,
      quantity,
      line_total,
      preorder_lead_days,
      deposit_percentage,
      created_at
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC`,
    [orderId],
  );

  return items;
};

export const findPaymentsByOrderId = async (orderId) => {
  const [payments] = await pool.execute(
    `SELECT
      id,
      payment_type,
      payment_method,
      amount,
      status,
      transaction_reference,
      confirmed_at,
      created_at,
      updated_at
    FROM payments
    WHERE order_id = ?
    ORDER BY id ASC`,
    [orderId],
  );

  return payments;
};

export const findAllForManagement = async () => {
  const [orders] = await pool.execute(
    `SELECT
      orders.id,
      orders.order_number,
      orders.user_id,
      orders.fulfillment_type,
      orders.status,
      orders.payment_method,
      orders.payment_status,
      orders.delivery_method,
      orders.delivery_zone_name,
      orders.total_amount,
      orders.deposit_amount,
      orders.estimated_ready_date,
      orders.created_at,

      users.full_name AS customer_name,
      users.email AS customer_email,
      users.phone AS customer_phone
    FROM orders
    INNER JOIN users
      ON users.id = orders.user_id
    ORDER BY orders.created_at DESC`,
  );

  return orders;
};

export const findByIdForManagement = async (orderId) => {
  const [orders] = await pool.execute(
    `SELECT
      orders.id,
      orders.order_number,
      orders.user_id,
      orders.fulfillment_type,
      orders.status,
      orders.payment_method,
      orders.payment_status,
      orders.delivery_method,
      orders.delivery_zone_name,
      orders.recipient_name,
      orders.recipient_phone,
      orders.delivery_address,
      orders.pickup_time_slot,
      orders.subtotal,
      orders.delivery_fee,
      orders.total_amount,
      orders.deposit_percentage,
      orders.deposit_amount,
      orders.estimated_ready_date,
      orders.created_at,
      orders.updated_at,

      users.full_name AS customer_name,
      users.email AS customer_email,
      users.phone AS customer_phone
    FROM orders
    INNER JOIN users
      ON users.id = orders.user_id
    WHERE orders.id = ?
    LIMIT 1`,
    [orderId],
  );

  return orders[0] || null;
};

export const updateOrderStatus = async (orderId, status) => {
  await pool.execute(
    `UPDATE orders
    SET status = ?
    WHERE id = ?`,
    [status, orderId],
  );
};