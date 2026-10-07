import { Router } from "express";
import * as categoryService from "../services/category.service.js";

const router = Router();

router.get("/", async (req, res) => {
  const response = await categoryService.getAllCategories();

  return res.status(response.code).json(response);
});

router.post("/", async (req, res) => {
  const response = await categoryService.createCategory(req.body);

  return res.status(response.code).json(response);
});

router.get("/:id", async (req, res) => {
  const response = await categoryService.getCategoryById(req.params.id);

  return res.status(response.code).json(response);
});

router.put("/:id", async (req, res) => {
  const response = await categoryService.updateCategory(
    req.params.id,
    req.body,
  );

  return res.status(response.code).json(response);
});

router.delete("/:id", async (req, res) => {
  const response = await categoryService.deactivateCategory(req.params.id);

  return res.status(response.code).json(response);
});

router.patch("/:id/status", async (req, res) => {
  const response = await categoryService.updateCategoryStatus(
    req.params.id,
    req.body,
  );

  return res.status(response.code).json(response);
});

export default router;
