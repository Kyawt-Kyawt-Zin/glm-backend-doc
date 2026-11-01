import pool from "../helper/db_helper.js";

export const getOverviewStats = async () => {
  const [rows] = await pool.execute(`
    SELECT
      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'customer'
          AND is_active = 1
      ) AS active_customers,

      (
        SELECT COUNT(*)
        FROM products
        WHERE is_active = 1
      ) AS active_products,

      (
        SELECT COUNT(*)
        FROM product_variants
        INNER JOIN products
          ON products.id = product_variants.product_id
        WHERE product_variants.fulfillment_type = 'in_stock'
          AND product_variants.is_active = 1
          AND products.is_active = 1
          AND product_variants.stock_quantity <= 3
      ) AS low_stock_variants,

      (
        SELECT COUNT(*)
        FROM orders
      ) AS total_orders,

      (
        SELECT COUNT(*)
        FROM orders
        WHERE status = 'pending'
      ) AS pending_orders,

      (
        SELECT COUNT(*)
        FROM orders
        WHERE status IN (
          'pending',
          'confirmed',
          'processing',
          'ready_for_delivery',
          'out_for_delivery',
          'ready_for_pickup'
        )
      ) AS active_orders,

      (
        SELECT COUNT(*)
        FROM payments
        INNER JOIN orders
          ON orders.id = payments.order_id
        WHERE payments.payment_type = 'deposit'
          AND payments.status = 'pending'
          AND orders.status <> 'cancelled'
      ) AS pending_deposits,

      (
        SELECT COUNT(*)
        FROM orders
        WHERE payment_status = 'refund_pending'
      ) AS refund_pending_orders,

      (
        SELECT COUNT(*)
        FROM customer_feedback
        WHERE status = 'new'
      ) AS new_feedback,

      (
        SELECT COUNT(*)
        FROM customer_feedback
        WHERE status = 'in_review'
      ) AS feedback_in_review
  `);

  return rows[0];
};

export const getRecentOrders = async (limit) => {
  const [orders] = await pool.execute(
    `SELECT
      orders.id,
      orders.order_number,
      orders.fulfillment_type,
      orders.status,
      orders.payment_status,
      orders.delivery_method,
      orders.delivery_zone_name,
      orders.total_amount,
      orders.deposit_amount,
      orders.created_at,

      users.full_name AS customer_name
    FROM orders
    INNER JOIN users
      ON users.id = orders.user_id
    ORDER BY orders.created_at DESC
    LIMIT ?`,
    [limit],
  );

  return orders;
};

export const getLowStockVariants = async (threshold) => {
  const [variants] = await pool.execute(
    `SELECT
      product_variants.id AS variant_id,
      product_variants.color,
      product_variants.size,
      product_variants.sku,
      product_variants.stock_quantity,

      products.id AS product_id,
      products.name AS product_name,
      products.slug AS product_slug,

      categories.name AS category_name
    FROM product_variants
    INNER JOIN products
      ON products.id = product_variants.product_id
    INNER JOIN categories
      ON categories.id = products.category_id
    WHERE product_variants.fulfillment_type = 'in_stock'
      AND product_variants.is_active = 1
      AND products.is_active = 1
      AND categories.is_active = 1
      AND product_variants.stock_quantity <= ?
    ORDER BY
      product_variants.stock_quantity ASC,
      products.name ASC,
      product_variants.color ASC,
      product_variants.size ASC`,
    [threshold],
  );

  return variants;
};
