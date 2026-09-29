import pool from "../helper/db_helper.js";

export const findAll = async () => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [users] = await connection.query(`
      SELECT
        id,
        full_name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      ORDER BY id DESC
    `);

    return users;
  } catch (error) {
    console.error("findAll users error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const findByEmail = async (email) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [users] = await connection.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    return users[0] || null;
  } catch (error) {
    console.error("findByEmail error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const create = async ({
  fullName,
  email,
  passwordHash,
  phone,
  role,
}) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      `
        INSERT INTO users (
          full_name,
          email,
          password_hash,
          phone,
          role
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [fullName, email, passwordHash, phone || null, role],
    );

    return result.insertId;
  } catch (error) {
    console.error("create user error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const findById = async (id) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [users] = await connection.query(
      `
        SELECT
          id,
          full_name,
          email,
          phone,
          role,
          is_active,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    return users[0] || null;
  } catch (error) {
    console.error("findById error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const update = async (
  id,
  { fullName, email, phone, role, isActive },
) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      `
        UPDATE users
        SET
          full_name = ?,
          email = ?,
          phone = ?,
          role = ?,
          is_active = ?
        WHERE id = ?
      `,
      [fullName, email, phone, role, isActive, id],
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error("update user error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const deactivate = async (id) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "UPDATE users SET is_active = FALSE WHERE id = ?",
      [id],
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error("deactivate user error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
