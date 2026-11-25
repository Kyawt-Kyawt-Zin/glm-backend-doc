import { createPrivateViewUrl } from "./s3-media.service.js";

export const resolveCustomerProductImageUrl = async ({
  imagePath,
  mediaDriver = "local",
  storageKey = null,
}) => {
  if (mediaDriver === "local") {
    return imagePath;
  }

  if (mediaDriver === "s3") {
    if (!storageKey) {
      throw new Error("S3 product image is missing its storage key");
    }

    return createPrivateViewUrl({
      key: storageKey,
    });
  }

  throw new Error(`Unsupported product image driver: ${mediaDriver}`);
};
