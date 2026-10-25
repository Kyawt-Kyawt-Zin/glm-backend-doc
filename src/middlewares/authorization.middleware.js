import * as Response from "../config/response.helper.js";

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      const response = Response.unauthorized("Authentication is required");

      return res.status(response.code).json(response);
    }

    if (!allowedRoles.includes(req.user.role)) {
      const response = Response.forbidden();

      return res.status(response.code).json(response);
    }

    return next();
  };
};
