import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

process.env.VERCEL = "1";
process.env.WELCOME_EMAIL_ENABLED = "true";
process.env.ORDER_EMAIL_ENABLED = "false";
process.env.MAILER_GMAIL_USER = "sender@example.invalid";
process.env.MAILER_GMAIL_APP_PASSWORD = "test-only";
const pool = (await import("../src/helper/db_helper.js")).default;
const { enqueueWelcomeEmail, processEmailJob, tryEmailJob } = await import("../src/services/email-queue.service.js");
const { registerCustomerLocked } = await import("../src/repositories/user.repository.js");

test("registration commits the welcome job with the customer and rolls back if queuing fails", async () => {
  const originalGetConnection = pool.getConnection;
  let failQueue = false;
  let steps = [];
  const connection = {
    beginTransaction: async () => steps.push("begin"),
    commit: async () => steps.push("commit"),
    rollback: async () => steps.push("rollback"),
    release: () => steps.push("release"),
    execute: async (sql) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.includes("RELEASE_LOCK")) return [[]];
      if (sql.startsWith("SELECT id FROM users")) return [[]];
      if (sql.startsWith("INSERT INTO users")) { steps.push("user"); return [{ insertId: 42 }]; }
      if (sql.startsWith("INSERT INTO email_notification_jobs")) {
        steps.push("queue");
        if (failQueue) throw new Error("simulated queue failure");
        return [{ affectedRows: 1 }];
      }
      throw new Error("Unexpected SQL in test");
    },
  };
  pool.getConnection = async () => connection;
  try {
    const result = await registerCustomerLocked("marker", { fullName: "Test", email: "test@example.invalid", passwordHash: "fake", phone: "1234567" });
    assert.equal(result.userId, 42);
    assert.ok(result.emailJobId);
    assert.deepEqual(steps.slice(0, 4), ["begin", "user", "queue", "commit"]);
    steps = [];
    failQueue = true;
    await assert.rejects(registerCustomerLocked("marker", { fullName: "Test", email: "test@example.invalid", passwordHash: "fake", phone: "1234567" }));
    assert.ok(steps.includes("rollback"));
    assert.ok(!steps.includes("commit"));
  } finally { pool.getConnection = originalGetConnection; }
});

test("a failed welcome email remains queued and can be sent on a later attempt", async () => {
  const originalExecute = pool.execute;
  const originalTransport = nodemailer.createTransport;
  const originalError = console.error;
  let fail = true;
  let sent;
  let retryRecorded = false;
  pool.execute = async (sql) => {
    if (sql.includes("attempts = attempts + 1")) return [{ affectedRows: 1 }];
    if (sql.startsWith("SELECT order_id")) return [[{ kind: "welcome", user_id: 42, payload: {}, attempts: 1 }]];
    if (sql.startsWith("SELECT full_name, email FROM users")) return [[{ full_name: "Test", email: "customer@example.invalid" }]];
    if (sql.includes("next_attempt_at = DATE_ADD")) retryRecorded = true;
    return [{ affectedRows: 1 }];
  };
  nodemailer.createTransport = () => ({ sendMail: async (message) => {
    if (fail) { const error = new Error("simulated outage"); error.code = "ETIMEDOUT"; throw error; }
    sent = message;
  } });
  console.error = () => {};
  try {
    const id = await enqueueWelcomeEmail({ execute: async () => {} }, 42);
    assert.equal(await processEmailJob(id), "retry");
    assert.equal(retryRecorded, true);
    fail = false;
    assert.equal(await processEmailJob(id), "sent");
    assert.equal(sent.to, "customer@example.invalid");
    assert.match(sent.subject, /Welcome/);
    process.env.WELCOME_EMAIL_ENABLED = "false";
    assert.equal(await processEmailJob(id), "disabled");
    assert.equal(tryEmailJob(null), undefined);
  } finally {
    pool.execute = originalExecute;
    nodemailer.createTransport = originalTransport;
    console.error = originalError;
  }
});

test("a slow email attempt is handed to Vercel without waiting", async () => {
  process.env.WELCOME_EMAIL_ENABLED = "true";
  const originalExecute = pool.execute;
  const contextKey = Symbol.for("@vercel/request-context");
  const originalContext = globalThis[contextKey];
  let unblock;
  let backgroundTask;
  const blocked = new Promise(resolve => { unblock = resolve; });
  pool.execute = async () => { await blocked; return [{ affectedRows: 0 }]; };
  globalThis[contextKey] = { get: () => ({ waitUntil: task => { backgroundTask = task; } }) };
  try {
    assert.equal(tryEmailJob("test-job"), undefined);
    assert.ok(backgroundTask instanceof Promise);
    unblock();
    await backgroundTask;
  } finally {
    pool.execute = originalExecute;
    if (originalContext === undefined) delete globalThis[contextKey];
    else globalThis[contextKey] = originalContext;
  }
});
