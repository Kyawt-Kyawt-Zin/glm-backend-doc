import pool from "../helper/db_helper.js";

export const createFeedback = async ({
  userId,
  feedbackType,
  subject,
  message,
}) => {
  const [result] = await pool.execute(
    `INSERT INTO customer_feedback (
      user_id,
      feedback_type,
      subject,
      message
    )
    VALUES (?, ?, ?, ?)`,
    [userId, feedbackType, subject, message],
  );

  return result.insertId;
};

export const findById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT
      id,
      user_id,
      feedback_type,
      subject,
      message,
      status,
      staff_note,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at
    FROM customer_feedback
    WHERE id = ?
    LIMIT 1`,
    [id],
  );

  return rows[0];
};

export const findAllByUserId = async (userId) => {
  const [feedback] = await pool.execute(
    `SELECT
      id,
      feedback_type,
      subject,
      message,
      status,
      staff_note,
      reviewed_at,
      created_at,
      updated_at
    FROM customer_feedback
    WHERE user_id = ?
    ORDER BY created_at DESC`,
    [userId],
  );

  return feedback;
};

export const findAllForManagement = async () => {
  const [feedback] = await pool.execute(
    `SELECT
      customer_feedback.id,
      customer_feedback.feedback_type,
      customer_feedback.subject,
      customer_feedback.message,
      customer_feedback.status,
      customer_feedback.staff_note,
      customer_feedback.reviewed_at,
      customer_feedback.created_at,
      customer_feedback.updated_at,
      customers.full_name AS customer_name,
      customers.email AS customer_email,
      reviewers.full_name AS reviewed_by_name
    FROM customer_feedback
    LEFT JOIN users AS customers
      ON customers.id = customer_feedback.user_id
    LEFT JOIN users AS reviewers
      ON reviewers.id = customer_feedback.reviewed_by
    ORDER BY customer_feedback.created_at DESC`,
  );

  return feedback;
};

export const reviewFeedback = async (id, { status, staffNote, reviewedBy }) => {
  await pool.execute(
    `UPDATE customer_feedback
     SET
       status = ?,
       staff_note = ?,
       reviewed_by = ?,
       reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, staffNote || null, reviewedBy, id],
  );
};
