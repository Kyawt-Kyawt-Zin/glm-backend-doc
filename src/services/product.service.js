import * as productRepository from "../repositories/product.repository.js";
import * as Response from "../config/response.helper.js";
import * as categoryRepository from "../repositories/category.repository.js";

const allowedTargetGenders = ["men", "women", "unisex"];

const createSlug = (name) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const getAllProducts = async () => {
  try {
    const products = await productRepository.findAll();

    return Response.success(products, "Products fetched successfully");
  } catch (error) {
    console.error("getAllProducts service error:", error.message);

    return Response.internalServerError("Unable to fetch products");
  }
};

export const createProduct = async ({
  categoryId,
  name,
  description,
  targetGender,
}) => {
  try {
    const normalizedCategoryId = Number(categoryId);
    const cleanName = name?.trim();
    const cleanTargetGender = targetGender?.trim().toLowerCase();

    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId < 1) {
      return Response.badRequest("A valid categoryId is required");
    }

    if (!cleanName) {
      return Response.badRequest("Product name is required");
    }

    if (!allowedTargetGenders.includes(cleanTargetGender)) {
      return Response.badRequest("targetGender must be men, women, or unisex");
    }

    const category = await categoryRepository.findById(normalizedCategoryId);

    if (!category) {
      return Response.badRequest("Selected category does not exist");
    }

    if (!category.is_active) {
      return Response.badRequest("Selected category is inactive");
    }

    const slug = createSlug(cleanName);
    const existingProduct = await productRepository.findBySlug(slug);

    if (existingProduct) {
      return Response.conflict("A product with this name already exists");
    }

    const cleanDescription = description?.trim() || null;

    const productId = await productRepository.createProduct({
      categoryId: normalizedCategoryId,
      name: cleanName,
      slug,
      description: cleanDescription,
      targetGender: cleanTargetGender,
    });

    return Response.created(
      {
        id: productId,
        category_id: normalizedCategoryId,
        name: cleanName,
        slug,
        description: cleanDescription,
        target_gender: cleanTargetGender,
        is_active: true,
      },
      "Product created successfully",
    );
  } catch (error) {
    console.error("createProduct service error:", error.message);

    return Response.internalServerError("Unable to create product");
  }
};

export const getProductById = async (id) => {
  try {
    const product = await productRepository.findById(id);

    if (!product) {
      return Response.notFound("Product not found");
    }

    return Response.success(product, "Product fetched successfully");
  } catch (error) {
    console.error("getProductById service error:", error.message);

    return Response.internalServerError("Unable to fetch product");
  }
};

export const updateProduct = async (
  id,
  { categoryId, name, description, targetGender, isActive },
) => {
  try {
    const currentProduct = await productRepository.findById(id);

    if (!currentProduct) {
      return Response.notFound("Product not found");
    }

    const normalizedCategoryId = Number(categoryId);
    const cleanName = name?.trim();
    const cleanTargetGender = targetGender?.trim().toLowerCase();

    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId < 1) {
      return Response.badRequest("A valid categoryId is required");
    }

    if (!cleanName) {
      return Response.badRequest("Product name is required");
    }

    if (!allowedTargetGenders.includes(cleanTargetGender)) {
      return Response.badRequest("targetGender must be men, women, or unisex");
    }

    if (typeof isActive !== "boolean") {
      return Response.badRequest("isActive must be true or false");
    }

    const category = await categoryRepository.findById(normalizedCategoryId);

    if (!category) {
      return Response.badRequest("Selected category does not exist");
    }

    if (!category.is_active) {
      return Response.badRequest("Selected category is inactive");
    }

    const slug = createSlug(cleanName);
    const existingProduct = await productRepository.findBySlug(slug);

    if (existingProduct && existingProduct.id !== Number(id)) {
      return Response.conflict("A product with this name already exists");
    }

    const cleanDescription = description?.trim() || null;

    await productRepository.updateProduct(id, {
      categoryId: normalizedCategoryId,
      name: cleanName,
      slug,
      description: cleanDescription,
      targetGender: cleanTargetGender,
      isActive,
    });

    return Response.success(
      {
        id: Number(id),
        category_id: normalizedCategoryId,
        name: cleanName,
        slug,
        description: cleanDescription,
        target_gender: cleanTargetGender,
        is_active: isActive,
      },
      "Product updated successfully",
    );
  } catch (error) {
    console.error("updateProduct service error:", error.message);

    return Response.internalServerError("Unable to update product");
  }
};

export const deactivateProduct = async (id) => {
  try {
    const product = await productRepository.findById(id);

    if (!product) {
      return Response.notFound("Product not found");
    }

    if (!product.is_active) {
      return Response.badRequest("Product is already inactive");
    }

    await productRepository.deactivateProduct(id);

    return Response.success(null, "Product deactivated successfully");
  } catch (error) {
    console.error("deactivateProduct service error:", error.message);

    return Response.internalServerError("Unable to deactivate product");
  }
};

export const updateProductStatus = async (id, { isActive }) => {
  try {
    const product = await productRepository.findById(id);

    if (!product) {
      return Response.notFound("Product not found");
    }

    if (typeof isActive !== "boolean") {
      return Response.badRequest("isActive must be true or false");
    }

    if (Boolean(product.is_active) === isActive) {
      const status = isActive ? "active" : "inactive";

      return Response.badRequest(`Product is already ${status}`);
    }

    await productRepository.setActiveStatus(id, isActive);

    const message = isActive
      ? "Product activated successfully"
      : "Product deactivated successfully";

    return Response.success(
      {
        id: Number(id),
        is_active: isActive,
      },
      message,
    );
  } catch (error) {
    console.error("updateProductStatus service error:", error.message);

    return Response.internalServerError("Unable to update product status");
  }
};
