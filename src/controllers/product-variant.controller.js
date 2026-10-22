import { Router } from "express";
import * as productVariantService from "../services/product-variant.service.js";

const router = Router();

router.get("/", async (req, res) => {
  const response = await productVariantService.getAllProductVariants();

  return res.status(response.code).json(response);
});

export default router;
