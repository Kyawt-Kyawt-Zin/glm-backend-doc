import { Router } from "express";
import * as productVariantService from "../services/product-variant.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

const router = Router();

router.get("/", async (req, res) => {
  const response = await productVariantService.getAllProductVariants();

  return res.status(response.code).json(response);
});

router.post(
  "/",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productVariantService.createProductVariant(req.body);

    return res.status(response.code).json(response);
  },
);

router.get("/:id", async (req, res) => {
  const response = await productVariantService.getProductVariantById(
    req.params.id,
  );

  return res.status(response.code).json(response);
});

router.put(
  "/:id",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productVariantService.updateProductVariant(
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
    const response = await productVariantService.deactivateProductVariant(
      req.params.id,
    );

    return res.status(response.code).json(response);
  },
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await productVariantService.updateProductVariantStatus(
      req.params.id,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

export default router;
