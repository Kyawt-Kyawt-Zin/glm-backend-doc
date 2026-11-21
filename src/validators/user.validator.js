import { body, param, query } from "express-validator";
import { validateRequest } from "../middlewares/validate-request.middleware.js";

const customerIdRule = () =>
  param("id")
    .isInt({ min: 1 })
    .withMessage("Customer ID must be a positive whole number");

export const validateCustomerListQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive whole number"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("limit must be a whole number between 1 and 50"),

  query("search")
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage("search must contain no more than 100 characters"),

  query("status")
    .optional()
    .trim()
    .toLowerCase()
    .isIn(["all", "active", "inactive"])
    .withMessage("status must be all, active, or inactive"),

  validateRequest,
];

export const validateCustomerIdParam = [customerIdRule(), validateRequest];

export const validateCustomerStatusUpdate = [
  customerIdRule(),

  body("isActive").isBoolean().withMessage("isActive must be true or false"),

  validateRequest,
];
