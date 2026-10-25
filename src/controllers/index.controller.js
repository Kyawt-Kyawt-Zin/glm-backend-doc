import { Router } from "express";
import userController from "./user.controller.js";
import categoryController from "./category.controller.js";
import productController from "./product.controller.js";
import productVariantController from "./product-variant.controller.js";
import authController from "./auth.controller.js";
import cartController from "./cart.controller.js";

const router = Router();

router.use("/users", userController);
router.use("/categories", categoryController);
router.use("/products", productController);
router.use("/product-variants", productVariantController);
router.use("/auth", authController);
router.use("/cart", cartController);

export default router;
