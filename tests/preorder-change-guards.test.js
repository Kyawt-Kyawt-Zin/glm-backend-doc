import test from "node:test";
import assert from "node:assert/strict";

process.env.VERCEL = "1";
process.env.JWT_SECRET = "test-only-guard-secret";
process.env.ORDER_EMAIL_ENABLED = "false";
const { default: jwt } = await import("jsonwebtoken");
const { default: app } = await import("../src/app.js");
const { default: pool } = await import("../src/helper/db_helper.js");
let requestType = "cancel_order";
let rollbacks = 0;
const connection = {
  beginTransaction: async () => {}, commit: async () => { throw new Error("Must not commit"); },
  rollback: async () => { rollbacks += 1; }, release: () => {},
  execute: async (sql) => {
    if (sql.includes("FROM order_change_requests") && sql.includes("FOR UPDATE")) return [[{ id: 7, order_id: 1, order_item_id: 10, request_type: requestType, status: "pending", order_status: "confirmed", fulfillment_type: "preorder", payment_status: "deposit_confirmed" }]];
    if (sql.startsWith("SELECT id FROM order_items") && sql.includes("preorder_received_quantity > 0")) return [[{ id: 10 }]];
    throw new Error("Unexpected SQL in reserved-item guard test");
  },
};
pool.getConnection = async () => connection;
pool.execute = async (sql) => {
  if (sql.includes("SELECT role, is_active, email FROM users")) return [[{ role: "staff", is_active: 1, email: "test@example.invalid" }]];
  throw new Error("Unexpected pool SQL");
};
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const url = `http://127.0.0.1:${server.address().port}/api/order-change-requests/7/review`;
const headers = { "content-type": "application/json", authorization: `Bearer ${jwt.sign({ userId: 1, role: "staff" }, process.env.JWT_SECRET)}` };

test("reserved preorder items block cancellation and variant changes", async () => {
  for (requestType of ["cancel_order", "change_variant"]) {
    const response = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ status: "approved" }) });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /received items reserved/i);
  }
  assert.equal(rollbacks, 2);
});

test.after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); });
