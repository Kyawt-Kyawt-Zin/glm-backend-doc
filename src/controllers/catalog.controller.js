import { Router } from "express";
import * as catalogService from "../services/catalog.service.js";

const router = Router();

router.get("/products", async (req, res) => {
  const response = await catalogService.getPublicCatalogProducts(req.query);

  return res.status(response.code).json(response);
});

router.get("/products/:slug", async (req, res) => {
  const response = await catalogService.getPublicCatalogProductBySlug(
    req.params.slug,
  );

  return res.status(response.code).json(response);
});

export default router;
