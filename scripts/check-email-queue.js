import pool from "../src/helper/db_helper.js";
import { getEmailQueueHealth } from "../src/services/email-queue.service.js";

try {
  const health = await getEmailQueueHealth();
  console.log(`Waiting: ${health.pending}; previously failed: ${health.previously_failed}; ready to retry: ${health.due}`);
} catch (error) {
  console.error("Unable to check email queue. Error code:", error.code || "UNKNOWN");
  process.exitCode = 1;
} finally {
  await pool.end();
}
