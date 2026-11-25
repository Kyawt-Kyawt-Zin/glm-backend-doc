import { randomUUID } from "node:crypto";
import pool from "../helper/db_helper.js";
import * as Response from "../config/response.helper.js";
import { isS3MediaEnabled, mediaConfig } from "../config/media.config.js";
import * as uploadRepository from "../repositories/product-image-upload.repository.js";
import {
  createFinalObjectKey,
  createStagedUpload,
  inspectStagedUpload,
  validateStagedUploadVersion,
  promoteStagedUpload,
} from "./s3-media.service.js";

const isValidId = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

export const createProductImageUpload = async ({
  staffUserId,
  productId,
  variantId,
  contentType,
  altText,
  sortOrder,
  isPrimary,
}) => {
  if (!isS3MediaEnabled()) {
    return Response.conflict("S3 image uploads are not enabled");
  }

  if (!isValidId(staffUserId) || !isValidId(productId)) {
    return Response.badRequest("A valid product ID is required");
  }

  const numericProductId = Number(productId);
  const numericStaffId = Number(staffUserId);
  const hasVariant =
    variantId !== undefined && variantId !== null && variantId !== "";

  if (hasVariant && !isValidId(variantId)) {
    return Response.badRequest("A valid variant ID is required");
  }

  const numericVariantId = hasVariant ? Number(variantId) : null;
  const numericSortOrder =
    sortOrder === undefined || sortOrder === "" ? 0 : Number(sortOrder);
  const cleanAltText = typeof altText === "string" ? altText.trim() : "";

  if (!mediaConfig.allowedMimeTypes.includes(contentType)) {
    return Response.badRequest("Only JPG, PNG, and WebP images are allowed");
  }

  if (cleanAltText.length > 180) {
    return Response.badRequest(
      "Image description must be 180 characters or less",
    );
  }

  if (
    !Number.isSafeInteger(numericSortOrder) ||
    numericSortOrder < 0 ||
    numericSortOrder > 4294967295
  ) {
    return Response.badRequest(
      "Sort order must be a non-negative whole number",
    );
  }

  if (![undefined, true, false, "true", "false"].includes(isPrimary)) {
    return Response.badRequest("Cover-image choice must be true or false");
  }

  const shouldBePrimary = isPrimary === true || isPrimary === "true";
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const product = await uploadRepository.findProductForUpdate(
      connection,
      numericProductId,
    );

    if (!product) {
      await connection.rollback();
      return Response.notFound("Product not found");
    }

    if (numericVariantId !== null) {
      const variant = await uploadRepository.findVariantForUpdate(connection, {
        productId: numericProductId,
        variantId: numericVariantId,
      });

      if (!variant) {
        await connection.rollback();
        return Response.badRequest(
          "The selected variant does not belong to this product",
        );
      }
    }

    const uploadId = randomUUID();

    const finalKey = createFinalObjectKey({
      mediaKind: "productImage",
      contentType,
      uploadId,
    });

    const upload = await createStagedUpload({
      mediaKind: "productImage",
      contentType,
    });

    await uploadRepository.createUpload(connection, {
      id: uploadId,
      staffUserId: numericStaffId,
      productId: numericProductId,
      productVariantId: numericVariantId,
      stagingKey: upload.key,
      finalKey,
      contentType,
      altText: cleanAltText || null,
      sortOrder: numericSortOrder,
      isPrimary: shouldBePrimary,
      expiresInSeconds: upload.expiresIn,
    });

    await connection.commit();

    return Response.success(
      {
        uploadId,
        uploadUrl: upload.uploadUrl,
        fields: upload.fields,
        expiresIn: upload.expiresIn,
      },
      "Product image upload prepared",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("createProductImageUpload service error:", error.message);
    return Response.internalServerError(
      "Unable to prepare product image upload",
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const completeProductImageUpload = async ({
  staffUserId,
  productId,
  uploadId,
}) => {
  if (!isS3MediaEnabled()) {
    return Response.conflict("S3 image uploads are not enabled");
  }

  if (!isValidId(staffUserId) || !isValidId(productId)) {
    return Response.badRequest("A valid product ID is required");
  }

  if (
    typeof uploadId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      uploadId,
    )
  ) {
    return Response.badRequest("A valid upload ID is required");
  }

  const numericStaffId = Number(staffUserId);
  const numericProductId = Number(productId);
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock the product before the upload, consistently with preparation.
    const product = await uploadRepository.findProductForUpdate(
      connection,
      numericProductId,
    );

    if (!product) {
      await connection.rollback();
      return Response.notFound("Product not found");
    }

    const upload = await uploadRepository.findUploadForUpdate(connection, {
      id: uploadId,
      staffUserId: numericStaffId,
      productId: numericProductId,
    });

    if (!upload) {
      await connection.rollback();
      return Response.notFound("Product image upload not found");
    }

    const expectedFinalKey = createFinalObjectKey({
      mediaKind: "productImage",
      contentType: upload.content_type,
      uploadId: upload.id,
    });

    if (upload.final_key !== expectedFinalKey) {
      throw new Error("Product image upload has an unexpected final key");
    }

    if (upload.status === "completed") {
      const image = await uploadRepository.findCompletedImageForUpdate(
        connection,
        {
          productId: numericProductId,
          imageId: upload.product_image_id,
          finalKey: expectedFinalKey,
        },
      );

      await connection.rollback();

      if (!image) {
        return Response.conflict("The completed upload needs staff review");
      }

      return Response.success(
        { id: image.id },
        "Product image was already uploaded",
      );
    }

    if (upload.status !== "pending" || !Number(upload.is_unexpired)) {
      await connection.rollback();
      return Response.conflict("This upload has expired or is unavailable");
    }

    if (upload.product_variant_id !== null) {
      const variant = await uploadRepository.findVariantForUpdate(connection, {
        productId: numericProductId,
        variantId: upload.product_variant_id,
      });

      if (!variant) {
        await connection.rollback();
        return Response.conflict(
          "The selected variant no longer belongs to this product",
        );
      }
    }

    const inspected = await inspectStagedUpload({
      mediaKind: "productImage",
      key: upload.staging_key,
      contentType: upload.content_type,
    });

    await validateStagedUploadVersion({
      mediaKind: "productImage",
      stagingKey: upload.staging_key,
      contentType: upload.content_type,
      versionId: inspected.versionId,
    });

    const finalKey = await promoteStagedUpload({
      mediaKind: "productImage",
      stagingKey: upload.staging_key,
      contentType: upload.content_type,
      versionId: inspected.versionId,
      uploadId: upload.id,
    });

    const imageId = await uploadRepository.insertVerifiedImage(connection, {
      productId: numericProductId,
      productVariantId: upload.product_variant_id,
      finalKey,
      altText: upload.alt_text,
      sortOrder: upload.sort_order,
      isPrimary: Number(upload.is_primary) === 1,
    });

    const updatedRows = await uploadRepository.markUploadCompleted(connection, {
      id: upload.id,
      staffUserId: numericStaffId,
      productId: numericProductId,
      stagingVersionId: inspected.versionId,
      productImageId: imageId,
    });

    if (updatedRows !== 1) {
      throw new Error("Product image upload could not be completed");
    }

    await connection.commit();

    return Response.success(
      { id: imageId },
      "Product image uploaded successfully",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("completeProductImageUpload service error:", error.message);
    return Response.internalServerError(
      "Unable to complete product image upload",
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
