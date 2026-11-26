import pool from "../helper/db_helper.js";

export const createRefreshSession = async ({ id, userId, tokenHash }) => {
  await pool.execute(
    `INSERT INTO customer_refresh_sessions
       (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))`,
    [id, userId, tokenHash],
  );
};

export const findActiveRefreshSession = async (tokenHash) => {
  const [rows] = await pool.execute(
    `SELECT id, user_id
     FROM customer_refresh_sessions
     WHERE token_hash = ?
       AND revoked_at IS NULL
       AND expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [tokenHash],
  );

  return rows[0] || null;
};

export const rotateRefreshSession = async (id, oldTokenHash, newTokenHash) => {
  const [result] = await pool.execute(
    `UPDATE customer_refresh_sessions
     SET token_hash = ?,
         expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY)
     WHERE id = ?
       AND token_hash = ?
       AND revoked_at IS NULL
       AND expires_at > UTC_TIMESTAMP()`,
    [newTokenHash, id, oldTokenHash],
  );

  return result.affectedRows === 1;
};

export const revokeRefreshSession = async (tokenHash) => {
  const [result] = await pool.execute(
    `UPDATE customer_refresh_sessions
     SET revoked_at = UTC_TIMESTAMP()
     WHERE token_hash = ?
       AND revoked_at IS NULL`,
    [tokenHash],
  );

  return result.affectedRows === 1;
};
