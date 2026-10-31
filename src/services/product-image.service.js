import { unlink } from "node:fs/promises";
import path from "node:path";
import * as Response from "../config/response.helper.js";
import * as productRepository from "../repositories/product.repository.js";
import * as productImageRepository from "../repositories/product-image.repository.js";

const removeUploadedFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Unable to remove uploaded image:", error.message);
    }
  }
};

export const getProductImages = async (productId) => {
  try {
    const product = await productRepository.findById(productId);

    if (!product) {
      return Response.notFound("Product not found");
    }

    const images = await productImageRepository.findAllByProductId(productId);

    return Response.success(images, "Product images fetched successfully");
  } catch (error) {
    console.error("getProductImages service error:", error.message);

    return Response.internalServerError("Unable to fetch product images");
  }
};

export const uploadProductImage = async (
  productId,
  file,
  { altText, sortOrder, isPrimary },
) => {
  try {
    if (!file) {
      return Response.badRequest("An image file is required");
    }

    const normalizedProductId = Number(productId);

    if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
      await removeUploadedFile(file.path);

      return Response.badRequest("A valid product ID is required");
    }

    const product = await productRepository.findById(normalizedProductId);

    if (!product) {
      await removeUploadedFile(file.path);

      return Response.notFound("Product not found");
    }

    const normalizedSortOrder =
      sortOrder === undefined || sortOrder === "" ? 0 : Number(sortOrder);

    if (!Number.isInteger(normalizedSortOrder) || normalizedSortOrder < 0) {
      await removeUploadedFile(file.path);

      return Response.badRequest(
        "sortOrder must be zero or a positive whole number",
      );
    }

    const validIsPrimaryValues = [undefined, "true", "false", true, false];

    if (!validIsPrimaryValues.includes(isPrimary)) {
      await removeUploadedFile(file.path);

      return Response.badRequest("isPrimary must be true or false");
    }

    const existingImages =
      await productImageRepository.findAllByProductId(normalizedProductId);

    // The first uploaded image automatically becomes the cover image.
    const shouldBePrimary =
      existingImages.length === 0 || isPrimary === true || isPrimary === "true";

    if (shouldBePrimary) {
      await productImageRepository.clearPrimaryImage(normalizedProductId);
    }

    const imagePath = `/uploads/products/${file.filename}`;

    const imageId = await productImageRepository.createImage({
      productId: normalizedProductId,
      imagePath,
      altText: altText?.trim(),
      sortOrder: normalizedSortOrder,
      isPrimary: shouldBePrimary,
    });

    const image = await productImageRepository.findById(imageId);

    return Response.created(image, "Product image uploaded successfully");
  } catch (error) {
    if (file?.path) {
      await removeUploadedFile(file.path);
    }

    console.error("uploadProductImage service error:", error.message);

    return Response.internalServerError("Unable to upload product image");
  }
};

export const updateProductImage = async (
  productId,
  imageId,
  { altText, sortOrder, isPrimary },
) => {
  try {
    const normalizedProductId = Number(productId);
    const normalizedImageId = Number(imageId);

    if (
      !Number.isInteger(normalizedProductId) ||
      !Number.isInteger(normalizedImageId)
    ) {
      return Response.badRequest(
        "A valid product ID and image ID are required",
      );
    }

    const image = await productImageRepository.findById(normalizedImageId);

    if (!image || image.product_id !== normalizedProductId) {
      return Response.notFound("Product image not found");
    }

    const normalizedSortOrder =
      sortOrder === undefined ? image.sort_order : Number(sortOrder);

    if (!Number.isInteger(normalizedSortOrder) || normalizedSortOrder < 0) {
      return Response.badRequest(
        "sortOrder must be zero or a positive whole number",
      );
    }

    const validIsPrimaryValues = [undefined, "true", "false", true, false];

    if (!validIsPrimaryValues.includes(isPrimary)) {
      return Response.badRequest("isPrimary must be true or false");
    }

    const cleanAltText =
      altText === undefined ? image.alt_text : altText?.trim() || null;

    await productImageRepository.updateImageDetails(normalizedImageId, {
      altText: cleanAltText,
      sortOrder: normalizedSortOrder,
    });

    const shouldBecomePrimary = isPrimary === true || isPrimary === "true";

    if (shouldBecomePrimary) {
      await productImageRepository.clearPrimaryImage(normalizedProductId);
      await productImageRepository.setPrimaryById(normalizedImageId);
    }

    const updatedImage =
      await productImageRepository.findById(normalizedImageId);

    return Response.success(updatedImage, "Product image updated successfully");
  } catch (error) {
    console.error("updateProductImage service error:", error.message);

    return Response.internalServerError("Unable to update product image");
  }
};

export const deleteProductImage = async (productId, imageId) => {
  try {
    const normalizedProductId = Number(productId);
    const normalizedImageId = Number(imageId);

    if (
      !Number.isInteger(normalizedProductId) ||
      !Number.isInteger(normalizedImageId)
    ) {
      return Response.badRequest(
        "A valid product ID and image ID are required",
      );
    }

    const image = await productImageRepository.findById(normalizedImageId);

    if (!image || image.product_id !== normalizedProductId) {
      return Response.notFound("Product image not found");
    }

    const imageFilePath = path.join(
      process.cwd(),
      "uploads",
      "products",
      path.basename(image.image_path),
    );

    try {
      await unlink(imageFilePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    await productImageRepository.deleteById(normalizedImageId);

    // If the deleted image was the cover photo, promote the next one.
    if (image.is_primary) {
      const remainingImages =
        await productImageRepository.findAllByProductId(normalizedProductId);

      if (remainingImages.length > 0) {
        await productImageRepository.clearPrimaryImage(normalizedProductId);
        await productImageRepository.setPrimaryById(remainingImages[0].id);
      }
    }

    return Response.success(null, "Product image deleted successfully");
  } catch (error) {
    console.error("deleteProductImage service error:", error.message);

    return Response.internalServerError("Unable to delete product image");
  }
};
