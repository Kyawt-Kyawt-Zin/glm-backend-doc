import { body, param } from "express-validator";
import { validateRequest } from "../middlewares/validate-request.middleware.js";

export const validatePaymentIdParam = [
  param("paymentId")
    .isInt({ min: 1 })
    .withMessage("Payment ID must be a positive whole number"),

  validateRequest,
];

export const validatePaymentProofSubmission = [
  body("transactionReference")
    .trim()
    .notEmpty()
    .withMessage("Transaction reference is required")
    .isLength({ max: 100 })
    .withMessage("Transaction reference must be 100 characters or fewer"),

  validateRequest,
];
