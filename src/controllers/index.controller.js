import { Router } from "express";
import userController from "./user.controller.js";
import categoryController from "./category.controller.js";
import productController from "./product.controller.js";

const router = Router();

router.use("/users", userController);
router.use("/categories", categoryController);
router.use("/products", productController);

export default router;
