import test from "node:test";
import assert from "node:assert/strict";

process.env.VERCEL = "1";
process.env.JWT_SECRET = "test-only-preorder-secret";
const { default: jwt } = await import("jsonwebtoken");
const { default: app } = await import("../src/app.js");
const { default: pool } = await import("../src/helper/db_helper.js");

const rows = [
  { order_id: 1, order_number: "TEST-1", order_item_id: 10, product_name: "Sweater", color: "Black", size: "M", quantity: 2 },
  { order_id: 1, order_number: "TEST-1", order_item_id: 11, product_name: "Cardigan", color: "Pink", size: "L", quantity: 1 },
];
let queryCount = 0;
pool.execute = async (sql, values) => {
  if (sql.includes("SELECT role, is_active, email FROM users")) return [[{ role: values[0] === 2 ? "customer" : "staff", is_active: 1, email: "test@example.invalid" }]];
  if (sql.includes("FROM orders") && sql.includes("order_items")) {
    queryCount += 1;
    assert.match(sql, /orders\.fulfillment_type\s*=\s*'preorder'/);
    assert.match(sql, /orders\.status\s*=\s*'confirmed'/);
    return [rows];
  }
  throw new Error("Unexpected SQL in preorder reminder test");
};
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const url = `http://127.0.0.1:${server.address().port}/api/dashboard/confirmed-preorders`;
const auth = (userId, role) => ({ authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET)}` });

test("preorder reminders require staff access", async () => {
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: auth(2, "customer") })).status, 403);
  assert.equal(queryCount, 0);
});

test("staff receive the confirmed preorder item quantities", async () => {
  const response = await fetch(url, { headers: auth(1, "staff") });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, rows);
  assert.equal(queryCount, 1);
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
});
