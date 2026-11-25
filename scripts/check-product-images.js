import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import pool from "../src/helper/db_helper.js";
import { validateImageBuffer } from "../src/services/image-validation.service.js";

const expectedIds = [1, 2, 4, 5, 8, 9, 10, 11];
const imageDirectory = path.resolve("uploads/products");

try {
  const [databaseRows] = await pool.execute(
    "SELECT DATABASE() AS db, @@hostname AS server",
  );

  if (
    databaseRows[0].db !== "defaultdb" ||
    databaseRows[0].server !== "golden-loom-mysql-1"
  ) {
    throw new Error("Unexpected database; check stopped");
  }

  const [images] = await pool.execute(
    `
      SELECT id, image_path
      FROM product_images
      WHERE media_driver = 'local'
        AND storage_key IS NULL
        AND id IN (?, ?, ?, ?, ?, ?, ?, ?)
      ORDER BY id
    `,
    expectedIds,
  );

  if (images.length !== expectedIds.length) {
    throw new Error("The expected image records have changed; check stopped");
  }

  for (const image of images) {
    const prefix = "/uploads/products/";
    const filename = image.image_path?.slice(prefix.length);

    if (
      !image.image_path?.startsWith(prefix) ||
      !filename ||
      !/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)
    ) {
      throw new Error(`Image ${image.id} has an unexpected path`);
    }

    const localPath = path.join(imageDirectory, filename);
    const fileInfo = await stat(localPath);

    if (!fileInfo.isFile() || fileInfo.size > 5 * 1024 * 1024) {
      throw new Error(`Image ${image.id} is not a valid-size file`);
    }

    const extension = path.extname(filename).toLowerCase();
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg";

    const buffer = await readFile(localPath);
    await validateImageBuffer({ buffer, expectedContentType: contentType });

    const sha256 = createHash("sha256").update(buffer).digest("hex");

    console.log(
      `Image ${image.id}: valid, ${buffer.length} bytes, SHA-256 ${sha256}`,
    );
  }

  console.log("Read-only check passed for all eight images.");
} catch (error) {
  console.error("Image check failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
