import { Router } from "express";
import * as productService from "../services/product.service.js";

const router = Router();

router.get("/", async (req, res) => {
  const response = await productService.getAllProducts();

  return res.status(response.code).json(response);
});

router.post("/", async (req, res) => {
  const response = await productService.createProduct(req.body);

  return res.status(response.code).json(response);
});

router.get("/:id", async (req, res) => {
  const response = await productService.getProductById(req.params.id);

  return res.status(response.code).json(response);
});

router.put("/:id", async (req, res) => {
  const response = await productService.updateProduct(req.params.id, req.body);

  return res.status(response.code).json(response);
});

router.delete("/:id", async (req, res) => {
  const response = await productService.deactivateProduct(req.params.id);

  return res.status(response.code).json(response);
});

router.patch("/:id/status", async (req, res) => {
  const response = await productService.updateProductStatus(
    req.params.id,
    req.body,
  );

  return res.status(response.code).json(response);
});

export default router;
