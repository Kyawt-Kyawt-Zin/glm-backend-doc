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
