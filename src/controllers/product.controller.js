import { Router } from "express";
import * as productService from "../services/product.service.js";
import * as productVariantService from "../services/product-variant.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

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
