import pool from "../helper/db_helper.js";

export const findAll = async ({
  limit,
  offset,
  fulfillmentType = null,
  lowStock = false,
  search = "",
}) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const conditions = [];
    const filterValues = [];

    if (fulfillmentType) {
      conditions.push("product_variants.fulfillment_type = ?");
      filterValues.push(fulfillmentType);
    }

    if (lowStock) {
      conditions.push(`
        (
          product_variants.fulfillment_type = 'in_stock'
          AND product_variants.stock_quantity <= 3
        )
      `);
    }

    if (search) {
      const searchValue = `%${search}%`;

      conditions.push(`
        (
          products.name LIKE ?
          OR product_variants.color LIKE ?
          OR product_variants.size LIKE ?
          OR product_variants.sku LIKE ?
        )
      `);

      filterValues.push(searchValue, searchValue, searchValue, searchValue);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [[countResult]] = await connection.query(
      `
        SELECT COUNT(*) AS total
        FROM product_variants
        INNER JOIN products
          ON product_variants.product_id = products.id
        ${whereClause}
      `,
      filterValues,
    );

    const [variants] = await connection.query(
      `
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
        ${whereClause}
        ORDER BY
          products.name ASC,
          product_variants.color ASC,
          product_variants.size ASC
        LIMIT ? OFFSET ?
      `,
      [...filterValues, limit, offset],
    );

    return {
      variants,
      total: countResult.total,
    };
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

export const findById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT
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
    WHERE product_variants.id = ?
    LIMIT 1`,
    [id],
  );

  return rows[0];
};

export const findAllByProductId = async (productId) => {
  const [variants] = await pool.execute(
    `SELECT
      id,
      product_id,
      color,
      size,
      sku,
      price,
      fulfillment_type,
      stock_quantity,
      preorder_lead_days,
      deposit_percentage,
      is_active,
      created_at,
      updated_at
    FROM product_variants
    WHERE product_id = ?
    ORDER BY color ASC, size ASC`,
    [productId],
  );

  return variants;
};

export const updateProductVariant = async (
  id,
  {
    productId,
    color,
    size,
    sku,
    price,
    fulfillmentType,
    stockQuantity,
    preorderLeadDays,
    isActive,
  },
) => {
  const [result] = await pool.execute(
    `UPDATE product_variants
    SET
      product_id = ?,
      color = ?,
      size = ?,
      sku = ?,
      price = ?,
      fulfillment_type = ?,
      stock_quantity = ?,
      preorder_lead_days = ?,
      is_active = ?
    WHERE id = ?`,
    [
      productId,
      color,
      size,
      sku,
      price,
      fulfillmentType,
      stockQuantity,
      preorderLeadDays,
      isActive,
      id,
    ],
  );

  return result.affectedRows;
};

export const deactivateProductVariant = async (id) => {
  const [result] = await pool.execute(
    "UPDATE product_variants SET is_active = FALSE WHERE id = ?",
    [id],
  );

  return result.affectedRows;
};

export const setActiveStatus = async (id, isActive) => {
  const [result] = await pool.execute(
    "UPDATE product_variants SET is_active = ? WHERE id = ?",
    [isActive, id],
  );

  return result.affectedRows;
};
