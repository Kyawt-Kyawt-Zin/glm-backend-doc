import jwt from "jsonwebtoken";
import config from "../config/config.js";
import * as Response from "../config/response.helper.js";

export const authenticate = (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    const response = Response.unauthorized("Authentication token is required");

    return res.status(response.code).json(response);
  }

  const token = authorizationHeader.split(" ")[1];

  try {
    const decodedToken = jwt.verify(token, config.auth.jwtSecret);

    req.user = decodedToken;

    return next();
  } catch (error) {
    const response = Response.unauthorized(
      "Invalid or expired authentication token",
    );

    return res.status(response.code).json(response);
  }
};
