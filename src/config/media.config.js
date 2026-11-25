const allowedMediaDrivers = new Set(["local", "s3"]);

const readPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const mediaDriver = (process.env.MEDIA_DRIVER || "local").trim().toLowerCase();

if (!allowedMediaDrivers.has(mediaDriver)) {
  throw new Error("MEDIA_DRIVER must be either 'local' or 's3'");
}

export const mediaConfig = Object.freeze({
  driver: mediaDriver,
  bucket: (process.env.S3_MEDIA_BUCKET || "").trim(),
  region: (process.env.AWS_REGION || "eu-north-1").trim(),

  maxUploadBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],

  uploadUrlExpiresIn: readPositiveInteger(
    process.env.S3_UPLOAD_URL_TTL_SECONDS,
    300,
  ),

  downloadUrlExpiresIn: readPositiveInteger(
    process.env.S3_DOWNLOAD_URL_TTL_SECONDS,
    300,
  ),
});

export const isS3MediaEnabled = () => mediaConfig.driver === "s3";
