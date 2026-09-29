import * as categoryRepository from "../repositories/category.repository.js";
import * as Response from "../config/response.helper.js";

export const getAllCategories = async () => {
  try {
    const categories = await categoryRepository.findAll();

    return Response.success(categories, "Categories fetched successfully");
  } catch (error) {
    console.error("getAllCategories service error:", error.message);

    return Response.internalServerError("Unable to fetch categories");
  }
};
