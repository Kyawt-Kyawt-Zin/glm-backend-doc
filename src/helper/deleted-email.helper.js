import { createHmac } from "node:crypto";

export const DELETED_EMAIL_DOMAIN = "deleted.golden-loom.invalid";

export const deletedEmailMarker = (email) => {
  const key = process.env.ACCOUNT_DELETION_HMAC_KEY;
  if (!key || key.length < 32) throw new Error("ACCOUNT_DELETION_HMAC_KEY is not configured");
  const digest = createHmac("sha256", key).update(email.trim().toLowerCase()).digest("hex");
  return `${digest}@${DELETED_EMAIL_DOMAIN}`;
};

export const isDeletedEmailMarker = (email) =>
  typeof email === "string" && email.toLowerCase().endsWith(`@${DELETED_EMAIL_DOMAIN}`);
