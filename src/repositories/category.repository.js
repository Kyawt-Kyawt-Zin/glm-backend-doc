import pool from "../helper/db_helper.js";

export const findAll = async () => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [categories] = await connection.query(`
      SELECT
        id,
        name,
        slug,
        description,
        is_active,
        created_at,
        updated_at
      FROM categories
      ORDER BY name ASC
    `);

    return categories;
  } catch (error) {
    console.error("findAll categories error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const findBySlug = async (slug) => {
  const [rows] = await pool.execute(
    "SELECT id FROM categories WHERE slug = ? LIMIT 1",
    [slug],
  );

  return rows[0];
};

export const createCategory = async ({ name, slug, description }) => {
  const [result] = await pool.execute(
    "INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)",
    [name, slug, description || null],
  );

  return result.insertId;
};

export const findById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT
      id,
      name,
      slug,
      description,
      is_active,
      created_at,
      updated_at
    FROM categories
    WHERE id = ?
    LIMIT 1`,
    [id],
  );

  return rows[0];
};

export const updateCategory = async (
  id,
  { name, slug, description, isActive },
) => {
  const [result] = await pool.execute(
    `UPDATE categories
    SET
      name = ?,
      slug = ?,
      description = ?,
      is_active = ?
    WHERE id = ?`,
    [name, slug, description, isActive, id],
  );

  return result.affectedRows;
};

export const deactivateCategory = async (id) => {
  const [result] = await pool.execute(
    "UPDATE categories SET is_active = FALSE WHERE id = ?",
    [id],
  );

  return result.affectedRows;
};

export const setActiveStatus = async (id, isActive) => {
  const [result] = await pool.execute(
    "UPDATE categories SET is_active = ? WHERE id = ?",
    [isActive, id],
  );

  return result.affectedRows;
};
