import { Router } from "express";
import userController from "./user.controller.js";
import categoryController from "./category.controller.js";
import productController from "./product.controller.js";
import productVariantController from "./product-variant.controller.js";
import authController from "./auth.controller.js";
import cartController from "./cart.controller.js";
import orderController from "./order.controller.js";
import deliveryZoneController from "./delivery-zone.controller.js";
import orderChangeRequestController from "./order-change-request.controller.js";
import paymentController from "./payment.controller.js";

const router = Router();

router.use("/users", userController);
router.use("/categories", categoryController);
router.use("/products", productController);
router.use("/product-variants", productVariantController);
router.use("/auth", authController);
router.use("/cart", cartController);
router.use("/orders", orderController);
router.use("/delivery-zones", deliveryZoneController);
router.use("/order-change-requests", orderChangeRequestController);
router.use("/payments", paymentController);

export default router;
