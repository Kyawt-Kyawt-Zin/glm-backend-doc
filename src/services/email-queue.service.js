import { randomUUID } from "node:crypto";
import pool from "../helper/db_helper.js";
import { findOrderNotificationContext } from "../repositories/order.repository.js";
import { sendEmail } from "./email.service.js";
import { createOrderStatusEmail, createPickupConfirmationEmail } from "./order-email.template.js";
import { createWelcomeEmail } from "./welcome-email.template.js";
import { waitUntil } from "@vercel/functions";

const supportedStatuses = new Set(["confirmed", "out_for_delivery", "ready_for_pickup", "delivered", "picked_up", "cancelled"]);

// The job and the order change are saved together on the same transaction.
export const enqueueOrderEmail = async (connection, orderId, kind, payload) => {
  if (process.env.ORDER_EMAIL_ENABLED !== "true") return null;
  if (kind === "status" && !supportedStatuses.has(payload.status)) return null;
  if (!["status", "pickup"].includes(kind)) throw new Error("Invalid email job kind");
  const id = randomUUID();
  await connection.execute("INSERT INTO email_notification_jobs (id, order_id, kind, payload, next_attempt_at, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())", [id, orderId, kind, JSON.stringify(payload)]);
  return id;
};

export const enqueueWelcomeEmail = async (connection, userId) => {
  if (process.env.WELCOME_EMAIL_ENABLED !== "true") return null;
  const id = randomUUID();
  await connection.execute("INSERT INTO email_notification_jobs (id, user_id, kind, payload, next_attempt_at, created_at) VALUES (?, ?, 'welcome', ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())", [id, userId, "{}"]);
  return id;
};

export const processEmailJob = async (id) => {
  const ordersEnabled = process.env.ORDER_EMAIL_ENABLED === "true";
  const welcomeEnabled = process.env.WELCOME_EMAIL_ENABLED === "true";
  if (!ordersEnabled && !welcomeEnabled) return "disabled";
  const token = randomUUID();
  const [claim] = await pool.execute(
    `UPDATE email_notification_jobs SET lease_token = ?, lease_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 MINUTE), attempts = attempts + 1
     WHERE id = ? AND status = 'pending' AND next_attempt_at <= UTC_TIMESTAMP()
       AND ((kind = 'welcome' AND ? = 1) OR (kind IN ('status', 'pickup') AND ? = 1))
       AND (lease_until IS NULL OR lease_until < UTC_TIMESTAMP())`, [token, id, welcomeEnabled ? 1 : 0, ordersEnabled ? 1 : 0],
  );
  if (!claim.affectedRows) return "unavailable";
  try {
    const [rows] = await pool.execute("SELECT order_id, user_id, kind, payload, attempts FROM email_notification_jobs WHERE id = ? AND lease_token = ?", [id, token]);
    const job = rows[0];
    if (!job) return "unavailable";
    const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
    const order = job.kind === "welcome" ? null : await findOrderNotificationContext(job.order_id);
    let message = null;
    let recipient = order?.customer_email;
    if (job.kind === "welcome") {
      const [users] = await pool.execute("SELECT full_name, email FROM users WHERE id = ? AND role = 'customer' AND is_active = TRUE LIMIT 1", [job.user_id]);
      if (users[0]?.email) { recipient = users[0].email; message = createWelcomeEmail(users[0].full_name); }
    }
    if (order && order.customer_email && job.kind === "status" && order.status === payload.status) {
      message = createOrderStatusEmail({ fullName: order.customer_name, orderNumber: order.order_number, orderId: order.id, status: payload.status, deliveryMethod: order.delivery_method, fulfillmentType: order.fulfillment_type, pickupTimeSlot: order.pickup_time_slot, isCorrection: payload.isCorrection });
    } else if (order && order.customer_email && job.kind === "pickup" && order.delivery_method === "pickup" && order.pickup_time_slot === payload.pickupTimeSlot && !["cancelled", "delivered", "picked_up"].includes(order.status)) {
      message = createPickupConfirmationEmail({ fullName: order.customer_name, orderNumber: order.order_number, orderId: order.id, pickupTimeSlot: payload.pickupTimeSlot, updated: payload.updated });
    }
    if (message) await sendEmail({ to: recipient, message });
    const outcome = message ? "sent" : "skipped";
    await pool.execute("UPDATE email_notification_jobs SET status = ?, sent_at = CASE WHEN ? = 'sent' THEN UTC_TIMESTAMP() ELSE NULL END, lease_token = NULL, lease_until = NULL, last_error_code = NULL WHERE id = ? AND lease_token = ?", [outcome, outcome, id, token]);
    return outcome;
  } catch (error) {
    const code = String(error.code || "UNKNOWN").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "UNKNOWN";
    await pool.execute(
      `UPDATE email_notification_jobs SET lease_token = NULL, lease_until = NULL, last_error_code = ?,
       next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL LEAST(1440, 5 * POW(2, LEAST(attempts - 1, 9))) MINUTE)
       WHERE id = ? AND lease_token = ?`, [code, id, token],
    );
    console.error("Email delivery failed; queued for retry. Code:", code);
    return "retry";
  }
};

export const getEmailQueueHealth = async () => {
  const [rows] = await pool.execute("SELECT COUNT(*) AS pending, COALESCE(SUM(last_error_code IS NOT NULL), 0) AS previously_failed, COALESCE(SUM(next_attempt_at <= UTC_TIMESTAMP() AND (lease_until IS NULL OR lease_until < UTC_TIMESTAMP())), 0) AS due FROM email_notification_jobs WHERE status = 'pending'");
  return rows[0];
};

export const processDueEmailJobs = async () => {
  const orderEnabled = process.env.ORDER_EMAIL_ENABLED === "true";
  const welcomeEnabled = process.env.WELCOME_EMAIL_ENABLED === "true";
  if (!orderEnabled && !welcomeEnabled) return { processed: 0, disabled: true };
  const [jobs] = await pool.execute(
    `SELECT id FROM email_notification_jobs WHERE status = 'pending' AND next_attempt_at <= UTC_TIMESTAMP()
     AND ((kind = 'welcome' AND ? = 1) OR (kind IN ('status', 'pickup') AND ? = 1))
     AND (lease_until IS NULL OR lease_until < UTC_TIMESTAMP()) ORDER BY next_attempt_at, created_at LIMIT 30`,
    [welcomeEnabled ? 1 : 0, orderEnabled ? 1 : 0],
  );
  let processed = 0;
  const started = Date.now();
  for (let i = 0; i < jobs.length && Date.now() - started < 10000; i += 3) {
    const batch = jobs.slice(i, i + 3);
    await Promise.all(batch.map(job => processEmailJob(job.id)));
    processed += batch.length;
  }
  const health = await getEmailQueueHealth();
  if (Number(health.previously_failed) > 0 || Number(health.due) > 0) console.warn("Email queue requires attention:", JSON.stringify(health));
  return { processed, ...health };
};

export const tryEmailJob = (id) => {
  if (!id) return;
  const task = processEmailJob(id).catch(error => console.error("Email queue processing failed. Code:", error.code || "UNKNOWN"));
  try { waitUntil(task); }
  catch (error) { console.error("Email background scheduling failed. Code:", error.code || "UNKNOWN"); }
};
