import jwt from "jsonwebtoken";
import config from "../config/config.js";
import * as Response from "../config/response.helper.js";
import * as userRepository from "../repositories/user.repository.js";
import { isDeletedEmailMarker } from "../helper/deleted-email.helper.js";

export const authenticate = async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    const response = Response.unauthorized("Authentication token is required");

    return res.status(response.code).json(response);
  }

  const token = authorizationHeader.split(" ")[1];

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, config.auth.jwtSecret);
  } catch (error) {
    const response = Response.unauthorized(
      "Invalid or expired authentication token",
    );

    return res.status(response.code).json(response);
  }

  try {
    const user = await userRepository.findAuthenticationState(decodedToken.userId);
    if (!user || !user.is_active || user.role !== decodedToken.role || isDeletedEmailMarker(user.email)) {
      const response = Response.unauthorized("Account is inactive or unavailable");
      return res.status(response.code).json(response);
    }
    req.user = decodedToken;
    return next();
  } catch (error) {
    console.error("authenticate account lookup error:", error.message);
    const response = Response.internalServerError("Unable to verify account");
    return res.status(response.code).json(response);
  }
};
