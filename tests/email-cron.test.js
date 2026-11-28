import test from "node:test";
import assert from "node:assert/strict";

process.env.VERCEL = "1";
process.env.ORDER_EMAIL_ENABLED = "false";
process.env.WELCOME_EMAIL_ENABLED = "false";
process.env.CRON_SECRET = "test-only-secret";
const pool = (await import("../src/helper/db_helper.js")).default;
const { default: app } = await import("../src/app.js");

test("email scheduler and health endpoint require the secret", async () => {
  const originalExecute = pool.execute;
  pool.execute = async () => [[{ pending: 2, previously_failed: 1, due: 1 }]];
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ["retry-order-emails", "email-queue-health"]) {
      assert.equal((await fetch(`${origin}/api/cron/${route}`)).status, 401);
      assert.equal((await fetch(`${origin}/api/cron/${route}`, { headers: { authorization: "Bearer wrong" } })).status, 401);
    }
    const headers = { authorization: "Bearer test-only-secret" };
    const retry = await fetch(`${origin}/api/cron/retry-order-emails`, { headers });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).disabled, true);
    const health = await fetch(`${origin}/api/cron/email-queue-health`, { headers });
    assert.deepEqual(await health.json(), { pending: 2, previously_failed: 1, due: 1 });
  } finally {
    pool.execute = originalExecute;
    await new Promise(resolve => server.close(resolve));
  }
});
