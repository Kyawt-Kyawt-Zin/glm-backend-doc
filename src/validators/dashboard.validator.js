import { query, validationResult } from "express-validator";
import * as Response from "../config/response.helper.js";

export const validateAnalyticsWeekQuery = [
  query("weekStart")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("weekStart must use YYYY-MM-DD format")
    .bail()
    .isISO8601({ strict: true })
    .withMessage("weekStart must be a valid date"),
  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const response = Response.badRequest(errors.array()[0].msg);

      return res.status(response.code).json(response);
    }

    return next();
  },
];
