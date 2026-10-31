import { Router } from "express";
import * as productService from "../services/product.service.js";
import * as productVariantService from "../services/product-variant.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";
import * as productImageService from "../services/product-image.service.js";
import { uploadProductImage } from "../middlewares/upload.middleware.js";

const router = Router();

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
