import express from "express";
import cors from "cors";
import indexController from "./controllers/index.controller.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { getEmailQueueHealth, processDueEmailJobs } from "./services/email-queue.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json());

// Vercel sends this secret in the Authorization header for scheduled jobs.
const requireCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const provided = req.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (!secret || Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

app.get("/api/cron/email-queue-health", requireCronSecret, async (req, res) => {
  try {
    return res.status(200).json(await getEmailQueueHealth());
  } catch (error) {
    console.error("Email queue health check failed. Code:", error.code || "UNKNOWN");
    return res.status(500).json({ message: "Email queue health check failed" });
  }
});

app.get("/api/cron/retry-order-emails", requireCronSecret, async (req, res) => {
  try {
    return res.status(200).json(await processDueEmailJobs());
  } catch (error) {
    console.error("Email retry job failed. Code:", error.code || "UNKNOWN");
    return res.status(500).json({ message: "Email retry job failed" });
  }
});

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api", indexController);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Golden Loom Myanmar API is running",
  });
});

export default app;
