import * as productVariantRepository from "../repositories/product-variant.repository.js";
import * as Response from "../config/response.helper.js";

export const getAllProductVariants = async () => {
  try {
    const variants = await productVariantRepository.findAll();

    return Response.success(variants, "Product variants fetched successfully");
  } catch (error) {
    console.error("getAllProductVariants service error:", error.message);

    return Response.internalServerError("Unable to fetch product variants");
  }
};
