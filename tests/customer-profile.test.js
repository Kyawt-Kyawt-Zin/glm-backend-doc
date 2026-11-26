import test from "node:test";
import assert from "node:assert/strict";

process.env.VERCEL = "1";
process.env.JWT_SECRET = "test-only-profile-secret";

const { default: jwt } = await import("jsonwebtoken");
const { default: app } = await import("../src/app.js");
const { default: pool } = await import("../src/helper/db_helper.js");

const fixture = { id: 11, full_name: "Test Customer", email: "test@example.invalid", phone: "+971500000000", role: "customer", is_active: 1 };
const updates = [];
pool.execute = async (sql, values) => {
  if (sql.includes("SELECT role, is_active, email FROM users")) {
    return [[{ role: values[0] === 22 ? "staff" : fixture.role, is_active: 1, email: fixture.email }]];
  }
  if (sql.includes("UPDATE users SET full_name")) {
    updates.push(values);
    assert.equal(values[2], fixture.id);
    fixture.full_name = values[0];
    fixture.phone = values[1];
    return [{ affectedRows: 1 }];
  }
  throw new Error("Unexpected database operation in profile test");
};
pool.getConnection = async () => ({ query: async () => [[{ ...fixture }]], release() {} });

const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const url = `http://127.0.0.1:${server.address().port}/api/auth/me`;
const request = (body, role = "customer") => fetch(url, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt.sign({ userId: role === "staff" ? 22 : 11, role }, process.env.JWT_SECRET)}`,
  },
  body: JSON.stringify(body),
});

test("profile endpoint requires authentication", async () => {
  const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(response.status, 401);
});

test("staff cannot use the customer profile endpoint", async () => {
  const response = await request({ fullName: "Other", phone: "" }, "staff");
  assert.equal(response.status, 403);
  assert.equal(updates.length, 0);
});

test("rejects invalid name and phone without updating the database", async () => {
  for (const body of [{ fullName: "  ", phone: "" }, { fullName: "A".repeat(101), phone: "" }, { fullName: "Valid", phone: "abc" }, { fullName: 1, phone: "" }]) {
    const response = await request(body);
    assert.equal(response.status, 400);
  }
  assert.equal(updates.length, 0);
});

test("updates only the authenticated customer's allowed fields", async () => {
  const response = await request({ fullName: "  New Name  ", phone: " +971501234567 ", id: 99, role: "admin", email: "other@example.invalid" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.full_name, "New Name");
  assert.equal(result.data.phone, "+971501234567");
  assert.equal(result.data.email, "test@example.invalid");
  assert.equal(result.data.role, "customer");
  assert.deepEqual(updates[0], ["New Name", "+971501234567", 11]);
});

test("a customer may clear the optional phone", async () => {
  const response = await request({ fullName: "New Name", phone: "" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.phone, null);
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
});
