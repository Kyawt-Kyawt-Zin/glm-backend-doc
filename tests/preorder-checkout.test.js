import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

process.env.VERCEL = "1";
process.env.MEDIA_DRIVER = "s3";
process.env.S3_MEDIA_BUCKET = "test-bucket";
process.env.AWS_REGION = "us-east-1";
process.env.AWS_ACCESS_KEY_ID = "test-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
const { default: sharp } = await import("sharp");
const { default: pool } = await import("../src/helper/db_helper.js");
const { getS3MediaClient } = await import("../src/services/s3-media.service.js");
const service = await import("../src/services/order.service.js");
const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
let uploaded = false, copyFails = false, copies = 0, orderCount = 0, paymentSubmitted = false, draft = null, deleted = [], commits = 0, currentQuantity = 4;
const item = { cart_item_id: 1, product_variant_id: 2, product_id: 3, quantity: 2, price: 50, fulfillment_type: "preorder", stock_quantity: 0, variant_is_active: 1, product_is_active: 1, category_is_active: 1, product_name: "Test", product_slug: "test", category_name: "Test", color: "Black", size: "M", sku: "test" };
const connection = {
  beginTransaction: async () => {}, commit: async () => { commits++; }, rollback: async () => {}, release: () => {},
  execute: async (sql, args) => {
    if (sql.includes("SELECT is_active FROM users")) return [[{ is_active: 1 }]];
    if (sql.includes("FROM carts") && sql.includes("FOR UPDATE")) return [[{ id: 7, user_id: 5, status: "active" }]];
    if (sql.includes("FROM cart_items") && sql.includes("FOR UPDATE")) return [[item]];
    if (sql.includes("FROM preorder_checkout_drafts") && sql.includes("active_user_id")) return [draft && draft.status === "pending" && args[0] === 5 ? [draft] : []];
    if (sql.includes("FROM preorder_checkout_drafts") && sql.includes("WHERE id =")) return [draft && args[0] === draft.id && args[1] === 5 ? [draft] : []];
    if (sql.startsWith("INSERT INTO preorder_checkout_drafts")) { draft = { id: args[0], user_id: args[1], active_cart_id: args[3], checkout_data: args[4], items_snapshot: args[5], deposit_amount: args[6], status: "pending" }; return [{ affectedRows: 1 }]; }
    if (sql.startsWith("UPDATE preorder_checkout_drafts SET staging_key")) { draft.staging_key = args[0]; draft.content_type = args[1]; return [{ affectedRows: 1 }]; }
    if (sql.includes("INSERT INTO orders")) { orderCount++; return [{ insertId: 42 }]; }
    if (sql.includes("INSERT INTO order_items")) return [{ insertId: 43 }];
    if (sql.includes("INSERT INTO payments")) return [{ insertId: 44 }];
    if (sql.includes("UPDATE payments") && sql.includes("transaction_reference")) { paymentSubmitted = true; assert.equal(args[0], "BANK-123"); assert.equal(args[2], "s3"); return [{ affectedRows: 1 }]; }
    if (sql.includes("UPDATE orders AS o") && sql.includes("deposit_submitted")) return [{ affectedRows: 1 }];
    if (sql.startsWith("DELETE FROM cart_items")) { deleted.push(args); if (currentQuantity <= args[2]) currentQuantity = 0; return [{ affectedRows: 1 }]; }
    if (sql.startsWith("UPDATE cart_items SET quantity")) { if (currentQuantity > args[3]) currentQuantity -= args[0]; return [{ affectedRows: 1 }]; }
    if (sql.startsWith("SELECT id FROM cart_items")) return [[]];
    if (sql.includes("UPDATE carts")) return [{ affectedRows: 1 }];
    if (sql.startsWith("UPDATE preorder_checkout_drafts SET status")) { draft.status = "completed"; draft.order_id = args[0]; return [{ affectedRows: 1 }]; }
    if (sql.includes("FROM orders JOIN payments")) return [[{ id: 42, order_number: "TEST", fulfillment_type: "preorder", total_amount: 100, deposit_amount: 20, deposit_payment_id: 44 }]];
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};
pool.getConnection = async () => connection;
const s3 = getS3MediaClient();
s3.send = async (command) => {
  if (command.constructor.name === "HeadObjectCommand") { if (!uploaded) throw new Error("No upload"); return { ContentLength: image.length, ContentType: "image/png", VersionId: "version-1" }; }
  if (command.constructor.name === "GetObjectCommand") return { ContentLength: image.length, ContentType: "image/png", Body: Readable.from([image]) };
  if (command.constructor.name === "CopyObjectCommand") { if (copyFails) throw new Error("Copy failed"); copies++; return {}; }
  throw new Error(`Unexpected S3 command: ${command.constructor.name}`);
};
const input = { recipientName: "Test", recipientPhone: "123", preorderTermsAccepted: true, preorderDelivery: { deliveryMethod: "pickup", remainingPaymentMethod: "cash_on_pickup" } };

test("preparing a preorder creates only a resumable draft and server-calculated deposit", async () => {
  const response = await service.preparePreorderCheckout(5, input);
  assert.equal(response.code, 201); assert.equal(response.data.deposit_amount, 20); assert.equal(orderCount, 0);
  assert.equal((await service.preparePreorderCheckout(5, input)).data.id, response.data.id);
  assert.equal(orderCount, 0);
});

test("receipt ownership and upload must be valid before creating an order", async () => {
  assert.equal((await service.preparePreorderReceiptUpload(6, draft.id, "image/png")).code, 409);
  assert.equal((await service.completePreorderCheckout(5, draft.id, "BANK-123")).code, 400);
  assert.equal(orderCount, 0);
  assert.equal((await service.preparePreorderReceiptUpload(5, draft.id, "image/png")).code, 200);
  assert.equal((await service.completePreorderCheckout(5, draft.id, "BANK-123")).code, 500);
  assert.equal(orderCount, 0);
});

test("an upload failure leaves the draft retryable; success creates one order and attaches proof", async () => {
  uploaded = true; copyFails = true;
  assert.equal((await service.completePreorderCheckout(5, draft.id, "BANK-123")).code, 500);
  assert.equal(orderCount, 0); assert.equal(draft.status, "pending");
  copyFails = false;
  const result = await service.completePreorderCheckout(5, draft.id, "BANK-123");
  assert.equal(result.code, 201); assert.equal(result.data.orders[0].fulfillment_type, "preorder");
  assert.equal(orderCount, 1); assert.equal(copies, 1); assert.equal(paymentSubmitted, true);
  assert.deepEqual(deleted, [[7, 1, 2]]); assert.equal(currentQuantity, 2); assert.equal(draft.status, "completed"); assert.ok(commits >= 3);
  assert.equal((await service.completePreorderCheckout(5, draft.id, "BANK-123")).code, 200);
  assert.equal(orderCount, 1);
});

test.after(async () => pool.end());
