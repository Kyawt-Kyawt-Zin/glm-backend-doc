import test from "node:test";
import assert from "node:assert/strict";

process.env.VERCEL = "1";
process.env.ORDER_EMAIL_ENABLED = "false";
const { default: pool } = await import("../src/helper/db_helper.js");
const { checkoutMyCart } = await import("../src/services/order.service.js");

const item = (id, fulfillmentType) => ({
  cart_item_id: id, product_variant_id: id + 10, product_id: id + 20,
  quantity: 1, price: 100, fulfillment_type: fulfillmentType, stock_quantity: 2,
  variant_is_active: 1, product_is_active: 1, category_is_active: 1,
  product_name: "Test sweater", product_slug: "test", category_name: "Test",
  color: "Black", size: "M", sku: `test-${id}`,
});

let cartItems = [];
let deleted = [];
let cartClosed = false;
let created = 0;
const connection = {
  beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  execute: async (sql, args) => {
    if (sql.includes("SELECT is_active FROM users")) return [[{ is_active: 1 }]];
    if (sql.includes("FROM carts") && sql.includes("FOR UPDATE")) return [[{ id: 7, user_id: 1, status: "active" }]];
    if (sql.includes("FROM cart_items") && sql.includes("FOR UPDATE")) return [cartItems];
    if (sql.includes("INSERT INTO orders")) { created++; return [{ insertId: 100 }]; }
    if (sql.includes("INSERT INTO order_items")) return [{ insertId: 101 }];
    if (sql.includes("UPDATE product_variants")) return [{ affectedRows: 1 }];
    if (sql.includes("INSERT INTO payments")) return [{ insertId: 102 }];
    if (sql.includes("DELETE FROM cart_items") && sql.includes("id IN")) { deleted = args.slice(1); return [{ affectedRows: deleted.length }]; }
    if (sql.includes("UPDATE carts")) { cartClosed = true; return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};
pool.getConnection = async () => connection;
const data = { fulfillmentType: "in_stock", recipientName: "Test", recipientPhone: "123", inStockDelivery: { deliveryMethod: "pickup", paymentMethod: "cash_on_pickup" } };

test("in-stock checkout leaves preorder items in an active mixed cart", async () => {
  cartItems = [item(1, "in_stock"), item(2, "preorder")];
  const result = await checkoutMyCart(1, data);
  assert.equal(result.code, 201);
  assert.equal(result.data.orders.length, 1);
  assert.equal(result.data.orders[0].fulfillment_type, "in_stock");
  assert.deepEqual(deleted, [1]);
  assert.equal(cartClosed, false);
});

test("in-stock checkout keeps an empty cart active for later items", async () => {
  cartItems = [item(3, "in_stock")]; deleted = []; cartClosed = false;
  assert.equal((await checkoutMyCart(1, data)).code, 201);
  assert.deepEqual(deleted, [3]);
  assert.equal(cartClosed, false);
});

test("in-stock checkout does not create an order for a preorder-only cart", async () => {
  cartItems = [item(2, "preorder")]; deleted = []; cartClosed = false;
  const before = created;
  assert.equal((await checkoutMyCart(1, data)).code, 400);
  assert.equal(created, before);
  assert.deepEqual(deleted, []);
});

test("legacy checkout cannot create a preorder without a receipt", async () => {
  cartItems = [item(2, "preorder")]; deleted = []; cartClosed = false;
  const before = created;
  const result = await checkoutMyCart(1, { ...data, fulfillmentType: undefined, preorderTermsAccepted: true });
  assert.equal(result.code, 400);
  assert.match(result.message, /deposit receipt/i);
  assert.equal(created, before);
  assert.deepEqual(deleted, []);
});

test.after(async () => pool.end());
