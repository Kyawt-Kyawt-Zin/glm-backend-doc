import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";

const uploadDirectory = path.join(process.cwd(), "storage", "payment-proofs");

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const extension = allowedMimeTypes.get(file.mimetype);

    callback(null, `payment-proof-${Date.now()}-${randomUUID()}.${extension}`);
  },
});

const paymentProofFileFilter = (req, file, callback) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return callback(
      new Error("Payment proof must be a JPG, PNG, or WebP image"),
    );
  }

  return callback(null, true);
};

const uploadPaymentProof = multer({
  storage,
  fileFilter: paymentProofFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default uploadPaymentProof;
