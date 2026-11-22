import { param } from "express-validator";
import { validateRequest } from "../middlewares/validate-request.middleware.js";

export const validatePaymentIdParam = [
  param("paymentId")
    .isInt({ min: 1 })
    .withMessage("Payment ID must be a positive whole number"),

  validateRequest,
];
