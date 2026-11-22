import { body, param } from "express-validator";
import { validateRequest } from "../middlewares/validate-request.middleware.js";

const cartItemIdRule = () =>
  param("itemId")
    .isInt({ min: 1 })
    .withMessage("Cart item ID must be a positive whole number");

export const validateAddCartItem = [
  body("productVariantId")
    .isInt({ min: 1 })
    .withMessage("productVariantId must be a positive whole number"),

  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("quantity must be a positive whole number"),

  validateRequest,
];

export const validateCartItemQuantityUpdate = [
  cartItemIdRule(),

  body("quantity")
    .isInt({ min: 1 })
    .withMessage("quantity must be a positive whole number"),

  validateRequest,
];

export const validateCartItemIdParam = [cartItemIdRule(), validateRequest];
