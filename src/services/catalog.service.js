import * as Response from "../config/response.helper.js";
import * as catalogRepository from "../repositories/catalog.repository.js";
import {
  createPaginationMeta,
  getPagination,
} from "../helper/pagination.helper.js";
import { resolveCustomerProductImageUrl } from "./product-image-url.service.js";

const allowedGenders = ["men", "women", "unisex"];

export const getPublicCatalogProducts = async (query = {}) => {
  try {
    const { page, limit, offset } = getPagination(query);

    const search =
      typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";

    const category =
      typeof query.category === "string"
        ? query.category.trim().toLowerCase().slice(0, 120)
        : null;

    const gender = allowedGenders.includes(query.gender) ? query.gender : null;

    const { products, total } = await catalogRepository.findAllForCatalog({
      limit,
      offset,
      search,
      category,
      gender,
    });

    const productsWithImageUrls = await Promise.all(
      products.map(async (product) => {
        const {
          primary_image_driver,
          primary_image_storage_key,
          ...publicProduct
        } = product;

        const imageUrl = await resolveCustomerProductImageUrl({
          imagePath: product.primary_image_path,
          mediaDriver: primary_image_driver ?? "local",
          storageKey: primary_image_storage_key,
        });

        return {
          ...publicProduct,
          primary_image_path: imageUrl,
        };
      }),
    );

    return Response.success(
      {
        items: productsWithImageUrls,
        pagination: createPaginationMeta({
          page,
          limit,
          total,
        }),
      },
      "Public catalog products fetched successfully",
    );
  } catch (error) {
    console.error("getPublicCatalogProducts service error:", error.message);

    return Response.internalServerError("Unable to fetch catalog products");
  }
};

export const getPublicCatalogProductBySlug = async (slug) => {
  try {
    const normalizedSlug =
      typeof slug === "string" ? slug.trim().toLowerCase().slice(0, 120) : "";

    if (!normalizedSlug) {
      return Response.badRequest("A valid product slug is required");
    }

    const catalogProduct =
      await catalogRepository.findOneForCatalogBySlug(normalizedSlug);

    if (!catalogProduct) {
      return Response.notFound("This sweater is unavailable");
    }

    const imagesWithUrls = await Promise.all(
      catalogProduct.images.map(async (image) => {
        const { media_driver, storage_key, ...publicImage } = image;

        const imageUrl = await resolveCustomerProductImageUrl({
          imagePath: image.image_path,
          mediaDriver: media_driver ?? "local",
          storageKey: storage_key,
        });

        return {
          ...publicImage,
          image_path: imageUrl,
        };
      }),
    );

    return Response.success(
      {
        ...catalogProduct,
        images: imagesWithUrls,
      },
      "Public catalog product fetched successfully",
    );
  } catch (error) {
    console.error(
      "getPublicCatalogProductBySlug service error:",
      error.message,
    );

    return Response.internalServerError("Unable to fetch this sweater");
  }
};
