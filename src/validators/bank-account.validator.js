import { body, param } from "express-validator";
import { validateRequest } from "../middlewares/validate-request.middleware.js";

const bankAccountIdRule = () =>
  param("accountId")
    .isInt({ min: 1 })
    .withMessage("Bank account ID must be a positive whole number");

const bankAccountBodyRules = [
  body("label")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Account label is required")
    .isLength({ max: 100 })
    .withMessage("Account label must contain no more than 100 characters"),

  body("bankName")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Bank name is required")
    .isLength({ max: 100 })
    .withMessage("Bank name must contain no more than 100 characters"),

  body("accountHolder")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Account holder is required")
    .isLength({ max: 150 })
    .withMessage("Account holder must contain no more than 150 characters"),

  body("accountNumber")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Account number is required")
    .isLength({ max: 80 })
    .withMessage("Account number must contain no more than 80 characters"),

  body("iban")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage("IBAN must contain no more than 50 characters"),

  body("branchName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Branch name must contain no more than 100 characters"),

  body("currency")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a three-letter code such as AED")
    .isAlpha()
    .withMessage("Currency may contain letters only"),

  body("transferInstructions")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage(
      "Transfer instructions must contain no more than 1000 characters",
    ),

  body("displayOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Display order must be a whole number of zero or more"),
];

export const validateBankAccountCreate = [
  ...bankAccountBodyRules,
  validateRequest,
];

export const validateBankAccountUpdate = [
  bankAccountIdRule(),
  ...bankAccountBodyRules,
  validateRequest,
];

export const validateBankAccountStatusUpdate = [
  bankAccountIdRule(),

  body("isActive").isBoolean().withMessage("isActive must be true or false"),

  validateRequest,
];
