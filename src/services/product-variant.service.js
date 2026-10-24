import * as productVariantRepository from "../repositories/product-variant.repository.js";
import * as productRepository from "../repositories/product.repository.js";
import * as Response from "../config/response.helper.js";

const allowedFulfillmentTypes = ["in_stock", "preorder"];
const defaultPreorderLeadDays = 14;
const defaultDepositPercentage = 20;

export const getAllProductVariants = async () => {
  try {
    const variants = await productVariantRepository.findAll();

    return Response.success(variants, "Product variants fetched successfully");
  } catch (error) {
    console.error("getAllProductVariants service error:", error.message);

    return Response.internalServerError("Unable to fetch product variants");
  }
};

export const createProductVariant = async ({
  productId,
  color,
  size,
  sku,
  price,
  fulfillmentType,
  stockQuantity,
  preorderLeadDays,
}) => {
  try {
    const normalizedProductId = Number(productId);
    const cleanColor = color?.trim();
    const cleanSize = size?.trim();
    const cleanSku = sku?.trim().toUpperCase();
    const normalizedPrice = Number(price);
    const cleanFulfillmentType = fulfillmentType?.trim().toLowerCase();
    const normalizedStockQuantity = Number(stockQuantity);

    if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
      return Response.badRequest("A valid productId is required");
    }

    if (!cleanColor || !cleanSize || !cleanSku) {
      return Response.badRequest("Color, size, and SKU are required");
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      return Response.badRequest("Price must be greater than zero");
    }

    if (!allowedFulfillmentTypes.includes(cleanFulfillmentType)) {
      return Response.badRequest(
        "fulfillmentType must be in_stock or preorder",
      );
    }

    if (
      !Number.isInteger(normalizedStockQuantity) ||
      normalizedStockQuantity < 0
    ) {
      return Response.badRequest(
        "stockQuantity must be a whole number of zero or more",
      );
    }

    const product = await productRepository.findById(normalizedProductId);

    if (!product || !product.is_active) {
      return Response.badRequest(
        "Selected product does not exist or is inactive",
      );
    }

    if (await productVariantRepository.findBySku(cleanSku)) {
      return Response.conflict("This SKU already exists");
    }

    if (
      await productVariantRepository.findByProductColorSize(
        normalizedProductId,
        cleanColor,
        cleanSize,
      )
    ) {
      return Response.conflict(
        "This product already has the same color and size",
      );
    }

    let normalizedPreorderLeadDays = null;

    if (cleanFulfillmentType === "preorder") {
      normalizedPreorderLeadDays = Number(
        preorderLeadDays ?? defaultPreorderLeadDays,
      );

      if (
        !Number.isInteger(normalizedPreorderLeadDays) ||
        normalizedPreorderLeadDays < 1
      ) {
        return Response.badRequest("preorderLeadDays must be at least one day");
      }

      if (normalizedStockQuantity !== 0) {
        return Response.badRequest(
          "Preorder variants must have stockQuantity of zero",
        );
      }
    }

    const variantId = await productVariantRepository.createProductVariant({
      productId: normalizedProductId,
      color: cleanColor,
      size: cleanSize,
      sku: cleanSku,
      price: normalizedPrice,
      fulfillmentType: cleanFulfillmentType,
      stockQuantity: normalizedStockQuantity,
      preorderLeadDays: normalizedPreorderLeadDays,
      depositPercentage: defaultDepositPercentage,
    });

    return Response.created(
      {
        id: variantId,
        product_id: normalizedProductId,
        color: cleanColor,
        size: cleanSize,
        sku: cleanSku,
        price: normalizedPrice,
        fulfillment_type: cleanFulfillmentType,
        stock_quantity: normalizedStockQuantity,
        preorder_lead_days: normalizedPreorderLeadDays,
        deposit_percentage: defaultDepositPercentage,
        is_active: true,
      },
      "Product variant created successfully",
    );
  } catch (error) {
    console.error("createProductVariant service error:", error.message);

    return Response.internalServerError("Unable to create product variant");
  }
};

export const getProductVariantById = async (id) => {
  try {
    const variant = await productVariantRepository.findById(id);

    if (!variant) {
      return Response.notFound("Product variant not found");
    }

    return Response.success(variant, "Product variant fetched successfully");
  } catch (error) {
    console.error("getProductVariantById service error:", error.message);

    return Response.internalServerError("Unable to fetch product variant");
  }
};

export const getProductVariantsByProductId = async (productId) => {
  try {
    const product = await productRepository.findById(productId);

    if (!product) {
      return Response.notFound("Product not found");
    }

    const variants =
      await productVariantRepository.findAllByProductId(productId);

    return Response.success(
      {
        product,
        variants,
      },
      "Product variants fetched successfully",
    );
  } catch (error) {
    console.error(
      "getProductVariantsByProductId service error:",
      error.message,
    );

    return Response.internalServerError("Unable to fetch product variants");
  }
};

export const updateProductVariant = async (
  id,
  {
    productId,
    color,
    size,
    sku,
    price,
    fulfillmentType,
    stockQuantity,
    preorderLeadDays,
    isActive,
  },
) => {
  try {
    const currentVariant = await productVariantRepository.findById(id);

    if (!currentVariant) {
      return Response.notFound("Product variant not found");
    }

    const normalizedProductId = Number(productId);
    const cleanColor = color?.trim();
    const cleanSize = size?.trim();
    const cleanSku = sku?.trim().toUpperCase();
    const normalizedPrice = Number(price);
    const cleanFulfillmentType = fulfillmentType?.trim().toLowerCase();
    const normalizedStockQuantity = Number(stockQuantity);

    if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
      return Response.badRequest("A valid productId is required");
    }

    if (!cleanColor || !cleanSize || !cleanSku) {
      return Response.badRequest("Color, size, and SKU are required");
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      return Response.badRequest("Price must be greater than zero");
    }

    if (!allowedFulfillmentTypes.includes(cleanFulfillmentType)) {
      return Response.badRequest(
        "fulfillmentType must be in_stock or preorder",
      );
    }

    if (
      !Number.isInteger(normalizedStockQuantity) ||
      normalizedStockQuantity < 0
    ) {
      return Response.badRequest(
        "stockQuantity must be a whole number of zero or more",
      );
    }

    if (typeof isActive !== "boolean") {
      return Response.badRequest("isActive must be true or false");
    }

    const product = await productRepository.findById(normalizedProductId);

    if (!product || !product.is_active) {
      return Response.badRequest(
        "Selected product does not exist or is inactive",
      );
    }

    const existingSku = await productVariantRepository.findBySku(cleanSku);

    if (existingSku && existingSku.id !== Number(id)) {
      return Response.conflict("This SKU already exists");
    }

    const duplicateVariant =
      await productVariantRepository.findByProductColorSize(
        normalizedProductId,
        cleanColor,
        cleanSize,
      );

    if (duplicateVariant && duplicateVariant.id !== Number(id)) {
      return Response.conflict(
        "This product already has the same color and size",
      );
    }

    let normalizedPreorderLeadDays = null;

    if (cleanFulfillmentType === "preorder") {
      normalizedPreorderLeadDays = Number(
        preorderLeadDays ?? defaultPreorderLeadDays,
      );

      if (
        !Number.isInteger(normalizedPreorderLeadDays) ||
        normalizedPreorderLeadDays < 1
      ) {
        return Response.badRequest("preorderLeadDays must be at least one day");
      }

      if (normalizedStockQuantity !== 0) {
        return Response.badRequest(
          "Preorder variants must have stockQuantity of zero",
        );
      }
    }

    await productVariantRepository.updateProductVariant(id, {
      productId: normalizedProductId,
      color: cleanColor,
      size: cleanSize,
      sku: cleanSku,
      price: normalizedPrice,
      fulfillmentType: cleanFulfillmentType,
      stockQuantity: normalizedStockQuantity,
      preorderLeadDays: normalizedPreorderLeadDays,
      isActive,
    });

    return Response.success(
      {
        id: Number(id),
        product_id: normalizedProductId,
        color: cleanColor,
        size: cleanSize,
        sku: cleanSku,
        price: normalizedPrice,
        fulfillment_type: cleanFulfillmentType,
        stock_quantity: normalizedStockQuantity,
        preorder_lead_days: normalizedPreorderLeadDays,
        deposit_percentage: defaultDepositPercentage,
        is_active: isActive,
      },
      "Product variant updated successfully",
    );
  } catch (error) {
    console.error("updateProductVariant service error:", error.message);

    return Response.internalServerError("Unable to update product variant");
  }
};

export const deactivateProductVariant = async (id) => {
  try {
    const variant = await productVariantRepository.findById(id);

    if (!variant) {
      return Response.notFound("Product variant not found");
    }

    if (!variant.is_active) {
      return Response.badRequest("Product variant is already inactive");
    }

    await productVariantRepository.deactivateProductVariant(id);

    return Response.success(null, "Product variant deactivated successfully");
  } catch (error) {
    console.error("deactivateProductVariant service error:", error.message);

    return Response.internalServerError("Unable to deactivate product variant");
  }
};

export const updateProductVariantStatus = async (id, { isActive }) => {
  try {
    const variant = await productVariantRepository.findById(id);

    if (!variant) {
      return Response.notFound("Product variant not found");
    }

    if (typeof isActive !== "boolean") {
      return Response.badRequest("isActive must be true or false");
    }

    if (Boolean(variant.is_active) === isActive) {
      const status = isActive ? "active" : "inactive";

      return Response.badRequest(`Product variant is already ${status}`);
    }

    await productVariantRepository.setActiveStatus(id, isActive);

    const message = isActive
      ? "Product variant activated successfully"
      : "Product variant deactivated successfully";

    return Response.success(
      {
        id: Number(id),
        is_active: isActive,
      },
      message,
    );
  } catch (error) {
    console.error("updateProductVariantStatus service error:", error.message);

    return Response.internalServerError(
      "Unable to update product variant status",
    );
  }
};

