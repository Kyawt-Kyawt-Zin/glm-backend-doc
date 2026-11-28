import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import {
  createCustomerOrderLink,
  pickupMapLink,
} from "../src/services/customer-links.js";
import {
  createOrderStatusEmail,
  createPickupConfirmationEmail,
} from "../src/services/order-email.template.js";

process.env.VERCEL = "1";
process.env.ORDER_EMAIL_ENABLED = "false";
process.env.MAILER_GMAIL_USER = "sender@example.invalid";
process.env.MAILER_GMAIL_APP_PASSWORD = "test-only";
const sent = [];
let failSending = false;
nodemailer.createTransport = () => ({
  sendMail: async (message) => {
    if (failSending)
      throw Object.assign(new Error("simulated"), { code: "ETEST" });
    sent.push(message);
  },
});

const { default: pool } = await import("../src/helper/db_helper.js");
const { notifyOrderStatus, notifyPickupTime } =
  await import("../src/services/order-notifications.service.js");
let lookups = 0;
const order = {
  id: 42,
  order_number: "GLM-TEST-42",
  status: "confirmed",
  fulfillment_type: "in_stock",
  delivery_method: "pickup",
  pickup_time_slot: null,
  customer_name: "Test Customer",
  customer_email: "customer@example.invalid",
};
pool.execute = async (sql, values) => {
  assert.match(sql, /users\.is_active = TRUE/);
  assert.deepEqual(values, [42]);
  lookups++;
  return [[{ ...order }]];
};

test("order links use the correct order and reject unsafe destinations", () => {
  assert.equal(
    createCustomerOrderLink(42),
    "https://golden-loom-myanmar.vercel.app/account/orders/42",
  );
  assert.equal(
    createCustomerOrderLink(42, { pickup: true }),
    "https://golden-loom-myanmar.vercel.app/account/orders/42#pickup",
  );
  assert.throws(() => createCustomerOrderLink("../other"));
  assert.throws(() =>
    createCustomerOrderLink(42, { siteUrl: "http://example.com" }),
  );
  assert.throws(() =>
    createCustomerOrderLink(42, { siteUrl: "https://example.com/path" }),
  );
});

test("only selected status updates generate messages", () => {
  const base = { orderId: 42, orderNumber: "GLM-TEST-42", fullName: "Aye" };
  for (const status of [
    "confirmed",
    "out_for_delivery",
    "ready_for_pickup",
    "delivered",
    "picked_up",
    "cancelled",
  ]) {
    const email = createOrderStatusEmail({ ...base, status });
    assert.ok(email);
    assert.match(email.text, /account\/orders\/42/);
  }
  assert.equal(createOrderStatusEmail({ ...base, status: "processing" }), null);
  assert.equal(createOrderStatusEmail({ ...base, status: "__proto__" }), null);
});

test("pickup scheduling links match eligibility and do not appear for an already saved time", () => {
  const base = {
    orderId: 42,
    orderNumber: "GLM-TEST-42",
    fullName: "Aye",
    deliveryMethod: "pickup",
  };
  assert.match(
    createOrderStatusEmail({
      ...base,
      status: "confirmed",
      fulfillmentType: "in_stock",
    }).text,
    /#pickup/,
  );
  assert.doesNotMatch(
    createOrderStatusEmail({
      ...base,
      status: "confirmed",
      fulfillmentType: "preorder",
    }).text,
    /#pickup/,
  );
  assert.match(
    createOrderStatusEmail({
      ...base,
      status: "ready_for_pickup",
      fulfillmentType: "preorder",
    }).text,
    /#pickup/,
  );
  assert.match(
    createOrderStatusEmail({
      ...base,
      status: "ready_for_pickup",
      pickupTimeSlot: "already saved",
    }).text,
    /View pickup details: .*#pickup/,
  );
  assert.doesNotMatch(
    createOrderStatusEmail({
      ...base,
      status: "confirmed",
      deliveryMethod: "standard",
    }).text,
    /#pickup/,
  );
});

test("pickup confirmation includes the saved Dubai time and map", () => {
  const input = {
    orderId: 42,
    orderNumber: "GLM-TEST-42",
    pickupTimeSlot: "2026-12-01 · 10:30 (Dubai time)",
  };
  const email = createPickupConfirmationEmail(input);
  assert.match(email.text, /2026-12-01 · 10:30 \(Dubai time\)/);
  assert.ok(email.text.includes(pickupMapLink));
  assert.match(email.text, /View pickup details: .*#pickup/);
  assert.equal(
    createPickupConfirmationEmail({ ...input, updated: true }).subject,
    "Your pickup time has been updated",
  );
  assert.throws(() =>
    createPickupConfirmationEmail({ ...input, pickupTimeSlot: "" }),
  );
});

test("notifications are off by default", async () => {
  await notifyOrderStatus(42, "confirmed");
  await notifyPickupTime(42, "anything");
  assert.equal(lookups, 0);
  assert.equal(sent.length, 0);
});

test("enabled notifications use the current customer and skip stale or unselected events", async () => {
  process.env.ORDER_EMAIL_ENABLED = "true";
  await notifyOrderStatus(42, "confirmed");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, order.customer_email);
  assert.match(sent[0].text, /#pickup/);
  await notifyOrderStatus(42, "delivered");
  order.status = "processing";
  await notifyOrderStatus(42, "processing");
  assert.equal(sent.length, 1);
});

test("pickup notification skips stale slots and mail failures are contained", async () => {
  order.status = "ready_for_pickup";
  order.pickup_time_slot = "2026-12-01 · 10:30 (Dubai time)";
  await notifyPickupTime(42, "outdated slot");
  assert.equal(sent.length, 1);
  await notifyPickupTime(42, order.pickup_time_slot, { updated: true });
  assert.equal(sent.length, 2);
  assert.equal(sent[1].subject, "Your pickup time has been updated");
  failSending = true;
  const originalError = console.error;
  try {
    console.error = () => {};
    await notifyPickupTime(42, order.pickup_time_slot);
  } finally {
    console.error = originalError;
    failSending = false;
  }
});

test.after(async () => {
  await pool.end();
});
