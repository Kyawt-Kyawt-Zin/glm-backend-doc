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
