import { Router } from "express";
import * as productService from "../services/product.service.js";
import * as productVariantService from "../services/product-variant.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";
import * as productImageService from "../services/product-image.service.js";
import { uploadProductImage } from "../middlewares/upload.middleware.js";
import * as productImageS3Service from "../services/product-image-s3.service.js";
import { requireLocalMediaMode } from "../middlewares/require-local-media.middleware.js";

const router = Router();

router.post(
  "/:productId/images/upload",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productImageS3Service.createProductImageUpload({
      staffUserId: req.user.userId,
      productId: req.params.productId,
      variantId: req.body?.variantId,
      contentType: req.body?.contentType,
      altText: req.body?.altText,
      sortOrder: req.body?.sortOrder,
      isPrimary: req.body?.isPrimary,
    });

    return res
      .set("Cache-Control", "private, no-store")
      .status(response.code)
      .json(response);
  },
);

router.post(
  "/:productId/images/complete",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productImageS3Service.completeProductImageUpload({
      staffUserId: req.user.userId,
      productId: req.params.productId,
      uploadId: req.body?.uploadId,
    });

    return res
      .set("Cache-Control", "private, no-store")
      .status(response.code)
      .json(response);
  },
);

router.get("/", async (req, res) => {
  const response = await productService.getAllProducts();

  return res.status(response.code).json(response);
});

router.post(
  "/",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productService.createProduct(req.body);

    return res.status(response.code).json(response);
  },
);

router.get("/:productId/images", async (req, res) => {
  const response = await productImageService.getProductImages(
    req.params.productId,
  );

  return res.status(response.code).json(response);
});

router.post(
  "/:productId/images",
  authenticate,
  authorizeRoles("admin", "staff"),
  requireLocalMediaMode,
  uploadProductImage,
  async (req, res) => {
    const response = await productImageService.uploadProductImage(
      req.params.productId,
      req.file,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

router.patch(
  "/:productId/images/:imageId",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productImageService.updateProductImage(
      req.params.productId,
      req.params.imageId,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

router.delete(
  "/:productId/images/:imageId",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productImageService.deleteProductImage(
      req.params.productId,
      req.params.imageId,
    );

    return res.status(response.code).json(response);
  },
);

router.get("/:id", async (req, res) => {
  const response = await productService.getProductById(req.params.id);

  return res.status(response.code).json(response);
});

router.get("/:productId/variants", async (req, res) => {
  const response = await productVariantService.getProductVariantsByProductId(
    req.params.productId,
  );

  return res.status(response.code).json(response);
});

router.put(
  "/:id",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productService.updateProduct(
      req.params.id,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productService.deactivateProduct(req.params.id);

    return res.status(response.code).json(response);
  },
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productService.updateProductStatus(
      req.params.id,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

export default router;
