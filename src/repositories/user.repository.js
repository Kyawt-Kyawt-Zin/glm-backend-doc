import pool from "../helper/db_helper.js";

const buildCustomerFilters = ({ search = "", status = "all" }) => {
  const conditions = ["role = 'customer'"];
  const values = [];

  if (search) {
    const searchValue = `%${search}%`;

    conditions.push("(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)");

    values.push(searchValue, searchValue, searchValue);
  }

  if (status === "active") {
    conditions.push("is_active = TRUE");
  }

  if (status === "inactive") {
    conditions.push("is_active = FALSE");
  }

  return {
    whereClause: conditions.join(" AND "),
    values,
  };
};

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

export const findCustomers = async ({ limit, offset, search, status }) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const { whereClause, values } = buildCustomerFilters({
      search,
      status,
    });

    const [customers] = await connection.execute(
      `SELECT
        id,
        full_name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );

    return customers;
  } catch (error) {
    console.error("findCustomers error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const countCustomers = async ({ search, status }) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const { whereClause, values } = buildCustomerFilters({
      search,
      status,
    });

    const [rows] = await connection.execute(
      `SELECT COUNT(*) AS total
      FROM users
      WHERE ${whereClause}`,
      values,
    );

    return rows[0].total;
  } catch (error) {
    console.error("countCustomers error:", error.message);
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

export const findForLogin = async (email) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [users] = await connection.query(
      `SELECT
        id,
        full_name,
        email,
        password_hash,
        phone,
        role,
        is_active
      FROM users
      WHERE email = ?
      LIMIT 1`,
      [email],
    );

    return users[0] || null;
  } catch (error) {
    console.error("findForLogin error:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
