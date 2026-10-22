import pool from "../helper/db_helper.js";

export const findAll = async () => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [products] = await connection.query(`
      SELECT
        products.id,
        products.category_id,
        categories.name AS category_name,
        products.name,
        products.slug,
        products.description,
        products.target_gender,
        products.is_active,
        products.created_at,
        products.updated_at
      FROM products
      INNER JOIN categories
        ON products.category_id = categories.id
      ORDER BY products.name ASC
    `);

    return products;
  } catch (error) {
    console.error("findAll products error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const findBySlug = async (slug) => {
  const [rows] = await pool.execute(
    "SELECT id FROM products WHERE slug = ? LIMIT 1",
    [slug],
  );

  return rows[0];
};

export const createProduct = async ({
  categoryId,
  name,
  slug,
  description,
  targetGender,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO products (
      category_id,
      name,
      slug,
      description,
      target_gender
    )
    VALUES (?, ?, ?, ?, ?)`,
    [categoryId, name, slug, description || null, targetGender],
  );

  return result.insertId;
};

export const findById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT
      products.id,
      products.category_id,
      categories.name AS category_name,
      products.name,
      products.slug,
      products.description,
      products.target_gender,
      products.is_active,
      products.created_at,
      products.updated_at
    FROM products
    INNER JOIN categories
      ON products.category_id = categories.id
    WHERE products.id = ?
    LIMIT 1`,
    [id],
  );

  return rows[0];
};

export const updateProduct = async (
  id,
  { categoryId, name, slug, description, targetGender, isActive },
) => {
  const [result] = await pool.execute(
    `UPDATE products
    SET
      category_id = ?,
      name = ?,
      slug = ?,
      description = ?,
      target_gender = ?,
      is_active = ?
    WHERE id = ?`,
    [categoryId, name, slug, description, targetGender, isActive, id],
  );

  return result.affectedRows;
};

export const deactivateProduct = async (id) => {
  const [result] = await pool.execute(
    "UPDATE products SET is_active = FALSE WHERE id = ?",
    [id],
  );

  return result.affectedRows;
};

export const setActiveStatus = async (id, isActive) => {
  const [result] = await pool.execute(
    "UPDATE products SET is_active = ? WHERE id = ?",
    [isActive, id],
  );

  return result.affectedRows;
};
