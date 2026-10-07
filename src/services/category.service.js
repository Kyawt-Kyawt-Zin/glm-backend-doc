import * as categoryRepository from "../repositories/category.repository.js";
import * as Response from "../config/response.helper.js";

const createSlug = (name) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const getAllCategories = async () => {
  try {
    const categories = await categoryRepository.findAll();

    return Response.success(categories, "Categories fetched successfully");
  } catch (error) {
    console.error("getAllCategories service error:", error.message);

    return Response.internalServerError("Unable to fetch categories");
  }
};

export const createCategory = async ({ name, description }) => {
  try {
    const cleanName = name?.trim();

    if (!cleanName) {
      return Response.badRequest("Category name is required");
    }

    const slug = createSlug(cleanName);
    const existingCategory = await categoryRepository.findBySlug(slug);

    if (existingCategory) {
      return Response.conflict("A category with this name already exists");
    }

    const cleanDescription = description?.trim() || null;

    const categoryId = await categoryRepository.createCategory({
      name: cleanName,
      slug,
      description: cleanDescription,
    });

    return Response.created(
      {
        id: categoryId,
        name: cleanName,
        slug,
        description: cleanDescription,
      },
      "Category created successfully",
    );
  } catch (error) {
    console.error("createCategory service error:", error.message);

    return Response.internalServerError("Unable to create category");
  }
};

export const getCategoryById = async (id) => {
  try {
    const category = await categoryRepository.findById(id);

    if (!category) {
      return Response.notFound("Category not found");
    }

    return Response.success(category, "Category fetched successfully");
  } catch (error) {
    console.error("getCategoryById service error:", error.message);

    return Response.internalServerError("Unable to fetch category");
  }
};

export const updateCategory = async (id, { name, description, isActive }) => {
  try {
    const currentCategory = await categoryRepository.findById(id);

    if (!currentCategory) {
      return Response.notFound("Category not found");
    }

    const cleanName = name?.trim();

    if (!cleanName) {
      return Response.badRequest("Category name is required");
    }

    if (typeof isActive !== "boolean") {
      return Response.badRequest("isActive must be true or false");
    }

    const slug = createSlug(cleanName);
    const existingCategory = await categoryRepository.findBySlug(slug);

    if (existingCategory && existingCategory.id !== Number(id)) {
      return Response.conflict("A category with this name already exists");
    }

    const cleanDescription = description?.trim() || null;

    await categoryRepository.updateCategory(id, {
      name: cleanName,
      slug,
      description: cleanDescription,
      isActive,
    });

    return Response.success(
      {
        id: Number(id),
        name: cleanName,
        slug,
        description: cleanDescription,
        is_active: isActive,
      },
      "Category updated successfully",
    );
  } catch (error) {
    console.error("updateCategory service error:", error.message);

    return Response.internalServerError("Unable to update category");
  }
};

export const deactivateCategory = async (id) => {
  try {
    const category = await categoryRepository.findById(id);

    if (!category) {
      return Response.notFound("Category not found");
    }

    if (!category.is_active) {
      return Response.badRequest("Category is already inactive");
    }

    await categoryRepository.deactivateCategory(id);

    return Response.success(null, "Category deactivated successfully");
  } catch (error) {
    console.error("deactivateCategory service error:", error.message);

    return Response.internalServerError("Unable to deactivate category");
  }
};

export const updateCategoryStatus = async (id, { isActive }) => {
  try {
    const category = await categoryRepository.findById(id);

    if (!category) {
      return Response.notFound("Category not found");
    }

    if (typeof isActive !== "boolean") {
      return Response.badRequest("isActive must be true or false");
    }

    if (Boolean(category.is_active) === isActive) {
      const status = isActive ? "active" : "inactive";

      return Response.badRequest(`Category is already ${status}`);
    }

    await categoryRepository.setActiveStatus(id, isActive);

    const message = isActive
      ? "Category activated successfully"
      : "Category deactivated successfully";

    return Response.success(
      {
        id: Number(id),
        is_active: isActive,
      },
      message,
    );
  } catch (error) {
    console.error("updateCategoryStatus service error:", error.message);

    return Response.internalServerError("Unable to update category status");
  }
};
