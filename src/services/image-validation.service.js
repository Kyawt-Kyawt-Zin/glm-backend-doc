import sharp from "sharp";
import { mediaConfig } from "../config/media.config.js";

const mimeTypeByFormat = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const maxImagePixels = 16_000_000;

export const validateImageBuffer = async ({ buffer, expectedContentType }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("The image file is empty or invalid");
  }

  if (buffer.length > mediaConfig.maxUploadBytes) {
    throw new Error("The image file exceeds the 5 MB limit");
  }

  if (!mediaConfig.allowedMimeTypes.includes(expectedContentType)) {
    throw new Error("Only JPG, PNG, and WebP images are allowed");
  }

  const options = {
    failOn: "warning",
    limitInputPixels: maxImagePixels,
    animated: true,
  };

  let metadata;

  try {
    metadata = await sharp(buffer, options).metadata();
  } catch {
    throw new Error("The file is not a valid supported image");
  }

  const detectedContentType = mimeTypeByFormat[metadata.format];

  if (detectedContentType !== expectedContentType) {
    throw new Error("The image content does not match its declared type");
  }

  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) {
    throw new Error("The image must contain one valid still image");
  }

  try {
    // Decode the pixels so we don't accept a valid header with broken image data.
    await sharp(buffer, options).raw().toBuffer();
  } catch {
    throw new Error("The image could not be decoded safely");
  }

  return {
    contentType: detectedContentType,
    size: buffer.length,
    width: metadata.width,
    height: metadata.height,
  };
};
