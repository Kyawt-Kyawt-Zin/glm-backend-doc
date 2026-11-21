import { validationResult } from "express-validator";
import * as Response from "../config/response.helper.js";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  const firstError = errors.array({ onlyFirstError: true })[0];

  const response = Response.badRequest(firstError.msg);

  return res.status(response.code).json({
    ...response,
    data: {
      field: firstError.path,
      source: firstError.location,
    },
  });
};
