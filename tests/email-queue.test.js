import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

process.env.VERCEL = "1";
process.env.ORDER_EMAIL_ENABLED = "true";
process.env.MAILER_GMAIL_USER = "sender@example.invalid";
process.env.MAILER_GMAIL_APP_PASSWORD = "fictional-test-password";
const pool = (await import("../src/helper/db_helper.js")).default;
const { enqueueOrderEmail, processEmailJob } =
  await import("../src/services/email-queue.service.js");

test("queue retries failed email, sends later, and skips stale or claimed jobs", async () => {
  let claimed = true;
  let failDelivery = true;
  let status = "confirmed";
  const calls = [];
  const originalExecute = pool.execute;
  const originalTransport = nodemailer.createTransport;
  const originalError = console.error;
  pool.execute = async (sql, args) => {
    calls.push({ sql, args });
    if (sql.includes("attempts = attempts + 1"))
      return [{ affectedRows: claimed ? 1 : 0 }];
    if (sql.startsWith("SELECT order_id"))
      return [
        [
          {
            order_id: 42,
            kind: "status",
            payload: { status: "confirmed" },
            attempts: 1,
          },
        ],
      ];
    if (sql.includes("FROM orders") && sql.includes("customer_email"))
      return [
        [
          {
            id: 42,
            order_number: "TEST-42",
            status,
            customer_email: "test@example.invalid",
            customer_name: "Test",
            delivery_method: "pickup",
            fulfillment_type: "in_stock",
          },
        ],
      ];
    return [{ affectedRows: 1 }];
  };
  nodemailer.createTransport = () => ({
    sendMail: async () => {
      if (failDelivery) {
        const error = new Error("simulated outage");
        error.code = "ETIMEDOUT";
        throw error;
      }
    },
  });
  console.error = () => {};
  try {
    const inserts = [];
    const jobId = await enqueueOrderEmail(
      { execute: async (...args) => inserts.push(args) },
      42,
      "status",
      { status: "confirmed" },
    );
    assert.ok(jobId);
    assert.equal(inserts.length, 1);
    assert.equal(await processEmailJob(jobId), "retry");
    assert.ok(
      calls.some(({ sql }) => sql.includes("next_attempt_at = DATE_ADD")),
    );
    failDelivery = false;
    assert.equal(await processEmailJob(jobId), "sent");
    status = "cancelled";
    assert.equal(await processEmailJob(jobId), "skipped");
    claimed = false;
    assert.equal(await processEmailJob(jobId), "unavailable");
    process.env.ORDER_EMAIL_ENABLED = "false";
    assert.equal(await processEmailJob(jobId), "disabled");
  } finally {
    pool.execute = originalExecute;
    nodemailer.createTransport = originalTransport;
    console.error = originalError;
  }
});
