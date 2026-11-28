import test from "node:test";
import assert from "node:assert/strict";

process.env.VERCEL = "1";
const { submitDepositProof } = await import("../src/repositories/payment.repository.js");
const { default: pool } = await import("../src/helper/db_helper.js");

test("receipt submission updates the order summary without overwriting later statuses", async () => {
  let orderStatus = "deposit_pending";
  let paymentStatus = "pending";
  const connection = { execute: async (sql, args) => {
    if (sql.includes("UPDATE payments")) { assert.equal(args[4], 17); paymentStatus = "submitted"; return [{ affectedRows: 1 }]; }
    assert.match(sql, /o\.payment_status = 'deposit_pending'/);
    assert.deepEqual(args, [17]);
    if (orderStatus === "deposit_pending") orderStatus = "deposit_submitted";
    return [{ affectedRows: 1 }];
  } };
  const submit = () => submitDepositProof({ connection, paymentId: 17, transactionReference: "TEST", paymentProofPath: "test.jpg" });
  await submit();
  assert.equal(paymentStatus, "submitted");
  assert.equal(orderStatus, "deposit_submitted");
  orderStatus = "deposit_confirmed";
  await submit();
  assert.equal(orderStatus, "deposit_confirmed");
});

test.after(async () => pool.end());
