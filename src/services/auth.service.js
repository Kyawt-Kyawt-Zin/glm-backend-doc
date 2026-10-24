import bcrypt from "bcrypt";
import * as userRepository from "../repositories/user.repository.js";
import * as Response from "../config/response.helper.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";

export const login = async ({ email, password }) => {
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail || !password) {
    return Response.badRequest("Email and password are required");
  }

  try {
    const user = await userRepository.findForLogin(cleanEmail);

    if (!user) {
      return Response.badRequest("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return Response.badRequest("Invalid email or password");
    }

    if (!user.is_active) {
      return Response.badRequest(
        "This account is inactive. Please contact support.",
      );
    }

    const { password_hash, ...safeUser } = user;

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      config.auth.jwtSecret,
      {
        expiresIn: "1d",
      },
    );

    return Response.success(
      {
        user: safeUser,
        token,
      },
      "Login successful",
    );
  } catch (error) {
    console.error("login service error:", error.message);

    return Response.internalServerError("Unable to log in");
  }
};
