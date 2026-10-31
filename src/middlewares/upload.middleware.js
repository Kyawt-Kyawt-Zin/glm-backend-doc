import multer from "multer";
import { randomUUID } from "node:crypto";

const extensionByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, "uploads/products");
  },

  filename: (_req, file, callback) => {
    const extension = extensionByMimeType[file.mimetype];
    const safeFileName = `${randomUUID()}${extension}`;

    callback(null, safeFileName);
  },
});

const fileFilter = (_req, file, callback) => {
  if (extensionByMimeType[file.mimetype]) {
    callback(null, true);
    return;
  }

  callback(new Error("Only JPG, PNG, and WEBP image files are allowed"));
};

export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("image");
