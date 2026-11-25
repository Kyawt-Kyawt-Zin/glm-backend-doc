import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isS3MediaEnabled, mediaConfig } from "../config/media.config.js";
import { validateImageBuffer } from "./image-validation.service.js";

const stagingPrefixByMediaKind = {
  productImage: "staging/product-images",
  paymentProof: "staging/payment-proofs",
};

const finalPrefixByMediaKind = {
  productImage: "products",
  paymentProof: "payment-proofs",
};

const extensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let s3MediaClient;

const assertSupportedUpload = ({ mediaKind, contentType }) => {
  if (!stagingPrefixByMediaKind[mediaKind]) {
    throw new Error("Unsupported media upload type");
  }

  if (!mediaConfig.allowedMimeTypes.includes(contentType)) {
    throw new Error("Only JPG, PNG, and WebP images are allowed");
  }
};

const assertKeyUsesPrefix = (key, prefix) => {
  if (typeof key !== "string" || !key.startsWith(`${prefix}/`)) {
    throw new Error("Unexpected S3 object key");
  }
};

const createCopySource = (key, versionId) => {
  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${mediaConfig.bucket}/${encodedKey}?versionId=${encodeURIComponent(versionId)}`;
};

export const getS3MediaClient = ({ allowLocalRead = false } = {}) => {
  if (!isS3MediaEnabled() && !allowLocalRead) {
    throw new Error(
      "S3 media client is unavailable while MEDIA_DRIVER is set to local",
    );
  }

  if (!mediaConfig.bucket) {
    throw new Error(
      "S3_MEDIA_BUCKET is required when MEDIA_DRIVER is set to s3",
    );
  }

  if (!s3MediaClient) {
    s3MediaClient = new S3Client({
      region: mediaConfig.region,
    });
  }

  return s3MediaClient;
};

export const createStagingObjectKey = ({ mediaKind, contentType }) => {
  assertSupportedUpload({ mediaKind, contentType });

  const prefix = stagingPrefixByMediaKind[mediaKind];
  const extension = extensionByMimeType[contentType];

  return `${prefix}/${randomUUID()}.${extension}`;
};

export const createStagedUpload = async ({ mediaKind, contentType }) => {
  assertSupportedUpload({ mediaKind, contentType });

  const key = createStagingObjectKey({
    mediaKind,
    contentType,
  });

  const signedPost = await createPresignedPost(getS3MediaClient(), {
    Bucket: mediaConfig.bucket,
    Key: key,
    Expires: mediaConfig.uploadUrlExpiresIn,
    Fields: {
      "Content-Type": contentType,
    },
    Conditions: [
      ["content-length-range", 1, mediaConfig.maxUploadBytes],
      ["eq", "$Content-Type", contentType],
    ],
  });

  return {
    key,
    uploadUrl: signedPost.url,
    fields: signedPost.fields,
    expiresIn: mediaConfig.uploadUrlExpiresIn,
  };
};

export const inspectStagedUpload = async ({ mediaKind, key, contentType }) => {
  assertSupportedUpload({ mediaKind, contentType });
  assertKeyUsesPrefix(key, stagingPrefixByMediaKind[mediaKind]);

  const response = await getS3MediaClient().send(
    new HeadObjectCommand({
      Bucket: mediaConfig.bucket,
      Key: key,
    }),
  );

  if (
    !response.ContentLength ||
    response.ContentLength > mediaConfig.maxUploadBytes
  ) {
    throw new Error("Uploaded file exceeds the allowed size");
  }

  if (response.ContentType !== contentType) {
    throw new Error("Uploaded file type does not match the upload request");
  }

  if (
    typeof response.VersionId !== "string" ||
    !response.VersionId ||
    response.VersionId === "null"
  ) {
    throw new Error("The uploaded file does not have a valid S3 version ID");
  }

  return {
    contentLength: response.ContentLength,
    contentType: response.ContentType,
    eTag: response.ETag,
    versionId: response.VersionId,
  };
};

export const createFinalObjectKey = ({ mediaKind, contentType, uploadId }) => {
  assertSupportedUpload({ mediaKind, contentType });

  if (
    typeof uploadId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      uploadId,
    )
  ) {
    throw new Error("A valid upload ID is required");
  }

  const extension = extensionByMimeType[contentType];

  return `${finalPrefixByMediaKind[mediaKind]}/${uploadId}.${extension}`;
};

export const promoteStagedUpload = async ({
  mediaKind,
  stagingKey,
  contentType,
  versionId,
  uploadId,
}) => {
  assertSupportedUpload({ mediaKind, contentType });
  assertKeyUsesPrefix(stagingKey, stagingPrefixByMediaKind[mediaKind]);

  if (typeof versionId !== "string" || !versionId || versionId === "null") {
    throw new Error("A valid S3 object version ID is required");
  }

  const finalKey = createFinalObjectKey({
    mediaKind,
    contentType,
    uploadId,
  });

  await getS3MediaClient().send(
    new CopyObjectCommand({
      Bucket: mediaConfig.bucket,
      Key: finalKey,
      CopySource: createCopySource(stagingKey, versionId),
    }),
  );

  return finalKey;
};

export const deleteS3Object = async ({ key }) => {
  await getS3MediaClient().send(
    new DeleteObjectCommand({
      Bucket: mediaConfig.bucket,
      Key: key,
    }),
  );
};

export const createPrivateViewUrl = async ({ key }) => {
  return getSignedUrl(
    getS3MediaClient({ allowLocalRead: true }),
    new GetObjectCommand({
      Bucket: mediaConfig.bucket,
      Key: key,
    }),
    {
      expiresIn: mediaConfig.downloadUrlExpiresIn,
    },
  );
};

export const validateStagedUploadVersion = async ({
  mediaKind,
  stagingKey,
  contentType,
  versionId,
}) => {
  assertSupportedUpload({ mediaKind, contentType });
  assertKeyUsesPrefix(stagingKey, stagingPrefixByMediaKind[mediaKind]);

  if (typeof versionId !== "string" || !versionId || versionId === "null") {
    throw new Error("A valid S3 object version ID is required");
  }

  const response = await getS3MediaClient().send(
    new GetObjectCommand({
      Bucket: mediaConfig.bucket,
      Key: stagingKey,
      VersionId: versionId,
    }),
  );

  if (response.ContentType !== contentType) {
    response.Body?.destroy?.();
    throw new Error("Uploaded file type does not match the upload request");
  }

  if (
    !response.Body ||
    !response.ContentLength ||
    response.ContentLength > mediaConfig.maxUploadBytes
  ) {
    response.Body?.destroy?.();
    throw new Error("Uploaded file is empty or exceeds the allowed size");
  }

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of response.Body) {
    totalBytes += chunk.length;

    if (totalBytes > mediaConfig.maxUploadBytes) {
      response.Body.destroy?.();
      throw new Error("Uploaded file exceeds the allowed size");
    }

    chunks.push(chunk);
  }

  return validateImageBuffer({
    buffer: Buffer.concat(chunks, totalBytes),
    expectedContentType: contentType,
  });
};

export const listFinalPaymentProofVersions = async ({
  uploadId,
  contentType,
}) => {
  const finalKey = createFinalObjectKey({
    mediaKind: "paymentProof",
    contentType,
    uploadId,
  });

  const items = [];
  let keyMarker;
  let versionIdMarker;

  do {
    const response = await getS3MediaClient().send(
      new ListObjectVersionsCommand({
        Bucket: mediaConfig.bucket,
        Prefix: finalKey,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
        MaxKeys: 1000,
      }),
    );

    const versions = [
      ...(response.Versions ?? []),
      ...(response.DeleteMarkers ?? []),
    ];

    for (const item of versions) {
      // Prefix matching can return other keys, so keep only the exact key.
      if (item.Key !== finalKey) {
        continue;
      }

      if (!item.VersionId) {
        throw new Error("An S3 object version is missing its version ID");
      }

      items.push({
        key: item.Key,
        versionId: item.VersionId,
      });

      if (items.length > 10_000) {
        throw new Error("Too many versions to process safely");
      }
    }

    if (!response.IsTruncated) {
      break;
    }

    if (!response.NextKeyMarker) {
      throw new Error("S3 version listing is missing a pagination marker");
    }

    keyMarker = response.NextKeyMarker;
    versionIdMarker = response.NextVersionIdMarker;
  } while (true);

  return { finalKey, items };
};

export const deleteFinalPaymentProofVersion = async ({
  uploadId,
  contentType,
  versionId,
}) => {
  const finalKey = createFinalObjectKey({
    mediaKind: "paymentProof",
    contentType,
    uploadId,
  });

  if (typeof versionId !== "string" || !versionId || versionId === "null") {
    throw new Error("A valid S3 object version ID is required");
  }

  await getS3MediaClient().send(
    new DeleteObjectCommand({
      Bucket: mediaConfig.bucket,
      Key: finalKey,
      VersionId: versionId,
    }),
  );
};
