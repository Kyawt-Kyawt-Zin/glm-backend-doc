import pool from "../helper/db_helper.js";

export const findAll = async () => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [variants] = await connection.query(`
      SELECT
        product_variants.id,
        product_variants.product_id,
        products.name AS product_name,
        product_variants.color,
        product_variants.size,
        product_variants.sku,
        product_variants.price,
        product_variants.fulfillment_type,
        product_variants.stock_quantity,
        product_variants.preorder_lead_days,
        product_variants.deposit_percentage,
        product_variants.is_active,
        product_variants.created_at,
        product_variants.updated_at
      FROM product_variants
      INNER JOIN products
        ON product_variants.product_id = products.id
      ORDER BY
        products.name ASC,
        product_variants.color ASC,
        product_variants.size ASC
    `);

    return variants;
  } catch (error) {
    console.error("findAll product variants error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const findBySku = async (sku) => {
  const [rows] = await pool.execute(
    "SELECT id FROM product_variants WHERE sku = ? LIMIT 1",
    [sku],
  );

  return rows[0];
};

export const findByProductColorSize = async (productId, color, size) => {
  const [rows] = await pool.execute(
    `SELECT id
    FROM product_variants
    WHERE product_id = ? AND color = ? AND size = ?
    LIMIT 1`,
    [productId, color, size],
  );

  return rows[0];
};

export const createProductVariant = async ({
  productId,
  color,
  size,
  sku,
  price,
  fulfillmentType,
  stockQuantity,
  preorderLeadDays,
  depositPercentage,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO product_variants (
      product_id,
      color,
      size,
      sku,
      price,
      fulfillment_type,
      stock_quantity,
      preorder_lead_days,
      deposit_percentage
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      color,
      size,
      sku,
      price,
      fulfillmentType,
      stockQuantity,
      preorderLeadDays,
      depositPercentage,
    ],
  );

  return result.insertId;
};
