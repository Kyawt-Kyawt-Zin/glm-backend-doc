import test from "node:test";
import assert from "node:assert/strict";
process.env.VERCEL = "1";
const { default: pool } = await import("../src/helper/db_helper.js");
const { cancelPreorderDraft } = await import("../src/services/order.service.js");
const id = "11111111-1111-4111-8111-111111111111";
let draft = { id, status: "pending", staging_key: null };
let updates = 0;
const connection = {
  beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  execute: async (sql, args) => {
    if (sql.startsWith("SELECT id, status, staging_key")) return [args[0] === id && args[1] === 1 ? [draft] : []];
    if (sql.startsWith("UPDATE preorder_checkout_drafts")) { updates++; draft = { ...draft, status: "cancelled" }; return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};
pool.getConnection = async () => connection;

test("draft cancellation requires the owner and acknowledgement", async () => {
  assert.equal((await cancelPreorderDraft(1, id, false)).code, 400);
  assert.equal((await cancelPreorderDraft(2, id, true)).code, 404);
  assert.equal(updates, 0);
});

test("completed drafts cannot be cancelled", async () => {
  draft = { id, status: "completed", staging_key: null };
  assert.equal((await cancelPreorderDraft(1, id, true)).code, 409);
  assert.equal(updates, 0);
});

test("an untouched draft can be cancelled without deleting cart items", async () => {
  draft = { id, status: "pending", staging_key: null };
  assert.equal((await cancelPreorderDraft(1, id, true)).code, 200);
  assert.equal(draft.status, "cancelled");
  assert.equal(updates, 1);
});
test("a failed upload attempt can be cancelled only with acknowledgement", async () => {
  draft = { id, status: "pending", staging_key: "staging/proof" };
  assert.equal((await cancelPreorderDraft(1, id, false)).code, 400);
  assert.equal((await cancelPreorderDraft(1, id, true)).code, 200);
  assert.equal(draft.status, "cancelled");
});
test.after(async () => pool.end());
