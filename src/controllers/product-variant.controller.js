import { Router } from "express";
import * as productVariantService from "../services/product-variant.service.js";

const router = Router();

router.get("/", async (req, res) => {
  const response = await productVariantService.getAllProductVariants();

  return res.status(response.code).json(response);
});

router.post("/", async (req, res) => {
  const response = await productVariantService.createProductVariant(req.body);

  return res.status(response.code).json(response);
});

router.get("/:id", async (req, res) => {
  const response = await productVariantService.getProductVariantById(
    req.params.id,
  );

  return res.status(response.code).json(response);
});

router.put("/:id", async (req, res) => {
  const response = await productVariantService.updateProductVariant(
    req.params.id,
    req.body,
  );

  return res.status(response.code).json(response);
});

router.delete("/:id", async (req, res) => {
  const response = await productVariantService.deactivateProductVariant(
    req.params.id,
  );

  return res.status(response.code).json(response);
});

router.patch("/:id/status", async (req, res) => {
  const response = await productVariantService.updateProductVariantStatus(
    req.params.id,
    req.body,
  );

  return res.status(response.code).json(response);
});

export default router;
