import test from "node:test";
import assert from "node:assert/strict";

process.env.VERCEL = "1";
process.env.JWT_SECRET = "test-only-receipt-secret";
process.env.ORDER_EMAIL_ENABLED = "false";
const { default: jwt } = await import("jsonwebtoken");
const { default: pool } = await import("../src/helper/db_helper.js");
const { default: app } = await import("../src/app.js");

let order = { id: 1, order_number: "TEST-1", status: "confirmed", fulfillment_type: "preorder", payment_status: "deposit_confirmed", delivery_method: "pickup", total_amount: 100, deposit_amount: 20 };
let received = 0;
let commits = 0;
let rollbacks = 0;
const connection = {
  beginTransaction: async () => {},
  commit: async () => { commits += 1; },
  rollback: async () => { rollbacks += 1; },
  release: () => {},
  execute: async (sql, values) => {
    if (sql.startsWith("SELECT id, fulfillment_type, status FROM orders")) return [values[0] === 1 ? [order] : []];
    if (sql.startsWith("SELECT id, quantity FROM order_items")) return [values[0] === 10 && values[1] === 1 ? [{ id: 10, quantity: 2 }] : []];
    if (sql.startsWith("UPDATE order_items SET preorder_received_quantity")) { received = values[0]; return [{ affectedRows: 1 }]; }
    if (sql.includes("FROM orders") && sql.includes("users.full_name AS customer_name")) { assert.match(sql, /FOR UPDATE/); return [[order]]; }
    if (sql.startsWith("SELECT id FROM order_items") && sql.includes("preorder_received_quantity > 0")) return [received > 0 ? [{ id: 10 }] : []];
    throw new Error("Unexpected transaction SQL: " + sql);
  },
};
pool.getConnection = async () => connection;
pool.execute = async (sql, values) => {
  if (sql.includes("SELECT role, is_active, email FROM users")) return [[{ role: values[0] === 2 ? "customer" : values[0] === 3 ? "admin" : "staff", is_active: 1, email: "test@example.invalid" }]];
  if (sql.includes("FROM orders") && sql.includes("users.full_name AS customer_name")) return [[order]];
  if (sql.includes("FROM order_items") && sql.includes("preorder_received_quantity")) return [[{ id: 10, preorder_received_quantity: received }]];
  if (sql.includes("FROM order_items")) return [[{ id: 10, quantity: 2, unit_price: 50, line_total: 100, deposit_percentage: 20 }]];
  if (sql.includes("FROM payments") || sql.includes("FROM order_status_history")) return [[]];
  throw new Error("Unexpected pool SQL: " + sql);
};
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/orders`;
const headers = role => ({ "content-type": "application/json", authorization: `Bearer ${jwt.sign({ userId: role === "customer" ? 2 : role === "admin" ? 3 : 1, role }, process.env.JWT_SECRET)}` });
const update = (quantity, role = "staff", path = "/1/items/10/preorder-received") => fetch(base + path, { method: "PATCH", headers: headers(role), body: JSON.stringify({ quantity }) });

test("received quantities require staff access and valid whole numbers", async () => {
  assert.equal((await update(1, "customer")).status, 403);
  for (const invalid of [-1, 1.5, "1", 3, null]) assert.equal((await update(invalid)).status, 400);
  assert.equal((await update(1, "staff", "/99/items/10/preorder-received")).status, 404);
  assert.equal(commits, 0);
});

test("staff can save reserved received quantities and see them in order details", async () => {
  assert.equal((await update(2)).status, 200);
  assert.equal(received, 2);
  const response = await fetch(base + "/1", { headers: headers("staff") });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.items[0].preorder_received_quantity, 2);
});

test("reserved items block cancellation until adjusted", async () => {
  const response = await fetch(base + "/1/status", { method: "PATCH", headers: headers("staff"), body: JSON.stringify({ status: "cancelled" }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /received items reserved/i);
  assert.ok(rollbacks > 0);
});

test("reserved items cannot be stranded by correcting an order back to pending", async () => {
  order = { ...order, status: "processing" };
  const response = await fetch(base + "/1/status-correction", { method: "PATCH", headers: headers("admin"), body: JSON.stringify({ status: "pending", reason: "Incorrect order status" }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /received items reserved/i);
});

test("completed orders and in-stock orders cannot change preorder received quantities", async () => {
  order = { ...order, status: "delivered" };
  assert.equal((await update(1)).status, 400);
  order = { ...order, status: "confirmed", fulfillment_type: "in_stock" };
  assert.equal((await update(1)).status, 400);
});

test.after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); });
