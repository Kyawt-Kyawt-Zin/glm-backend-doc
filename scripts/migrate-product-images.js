import { readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import pool from "../src/helper/db_helper.js";
import { validateImageBuffer } from "../src/services/image-validation.service.js";

const expectedIds = [1, 2, 4, 5, 8, 9, 10, 11];
const bucket = "golden-loom-myanmar-media";
const imageDirectory = path.resolve("uploads/products");
const apply = process.argv.includes("--apply");

let s3;

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

try {
  const [databaseRows] = await pool.execute(
    "SELECT DATABASE() AS db, @@hostname AS server",
  );

  if (
    databaseRows[0].db !== "defaultdb" ||
    databaseRows[0].server !== "golden-loom-mysql-1"
  ) {
    throw new Error("Unexpected database; migration stopped");
  }

  if (apply) {
    if (process.env.AWS_PROFILE !== "golden-loom-media-dev") {
      throw new Error("Use the golden-loom-media-dev AWS profile");
    }

    if (
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.AWS_SESSION_TOKEN
    ) {
      throw new Error(
        "AWS credential environment variables are set; use a clean PowerShell window",
      );
    }

    s3 = new S3Client({ region: "eu-north-1" });
  }

  const [images] = await pool.execute(
    `
      SELECT id, image_path, media_driver, storage_key
      FROM product_images
      WHERE id IN (?, ?, ?, ?, ?, ?, ?, ?)
      ORDER BY id
    `,
    expectedIds,
  );

  if (images.length !== expectedIds.length) {
    throw new Error(
      "The expected image records have changed; migration stopped",
    );
  }

  for (const image of images) {
    const prefix = "/uploads/products/";
    const filename = image.image_path?.slice(prefix.length);

    if (
      !image.image_path?.startsWith(prefix) ||
      !filename ||
      !/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)
    ) {
      throw new Error(`Image ${image.id} has an unexpected local path`);
    }

    const localPath = path.join(imageDirectory, filename);
    const fileInfo = await lstat(localPath);

    if (!fileInfo.isFile() || fileInfo.size > 5 * 1024 * 1024) {
      throw new Error(`Image ${image.id} is not a valid-size regular file`);
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

    const localHash = sha256(buffer);
    const s3Key = `products/migrated/${image.id}-${filename}`;

    if (image.media_driver === "s3") {
      if (image.storage_key !== s3Key) {
        throw new Error(`Image ${image.id} has a different S3 key`);
      }
    } else if (image.media_driver !== "local" || image.storage_key !== null) {
      throw new Error(`Image ${image.id} has an unexpected storage state`);
    }

    if (!apply) {
      console.log(`Image ${image.id}: ${image.media_driver}, ${s3Key}`);
      continue;
    }

    let uploadedVersion;

    if (image.media_driver === "local") {
      try {
        const uploaded = await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: buffer,
            ContentType: contentType,
            ChecksumAlgorithm: "SHA256",
            IfNoneMatch: "*",
          }),
        );

        uploadedVersion = uploaded.VersionId;

        if (!uploadedVersion || uploadedVersion === "null") {
          throw new Error(`Image ${image.id} has no S3 version ID`);
        }
      } catch (error) {
        if (error?.$metadata?.httpStatusCode !== 412) {
          throw error;
        }

        // A previous attempt may already have uploaded this key.
        // The existing object must still pass the checksum check below.
        console.log(`Image ${image.id}: checking existing S3 copy`);
      }
    }

    const downloaded = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        ...(uploadedVersion ? { VersionId: uploadedVersion } : {}),
      }),
    );

    if (
      !downloaded.Body ||
      downloaded.ContentLength !== buffer.length ||
      downloaded.ContentType !== contentType ||
      !downloaded.VersionId ||
      downloaded.VersionId === "null"
    ) {
      downloaded.Body?.destroy?.();
      throw new Error(`Image ${image.id}: S3 metadata check failed`);
    }

    const remoteHash = createHash("sha256");
    let downloadedBytes = 0;

    for await (const chunk of downloaded.Body) {
      downloadedBytes += chunk.length;

      if (downloadedBytes > 5 * 1024 * 1024) {
        downloaded.Body.destroy?.();
        throw new Error(`Image ${image.id}: S3 copy is too large`);
      }

      remoteHash.update(chunk);
    }

    if (
      downloadedBytes !== buffer.length ||
      remoteHash.digest("hex") !== localHash
    ) {
      throw new Error(`Image ${image.id}: S3 checksum does not match`);
    }

    if (image.media_driver === "local") {
      const [result] = await pool.execute(
        `
          UPDATE product_images
          SET media_driver = 's3', storage_key = ?
          WHERE id = ?
            AND image_path = ?
            AND media_driver = 'local'
            AND storage_key IS NULL
        `,
        [s3Key, image.id, image.image_path],
      );

      if (result.affectedRows !== 1) {
        throw new Error(`Image ${image.id}: database record changed; stopped`);
      }
    }

    console.log(`Image ${image.id}: S3 copy verified`);
  }

  console.log(
    apply
      ? "Migration finished. Local files were retained."
      : "Dry run finished. No S3 or database changes were made.",
  );
} catch (error) {
  console.error("Migration stopped:", error.message);
  process.exitCode = 1;
} finally {
  s3?.destroy();
  await pool.end();
}
