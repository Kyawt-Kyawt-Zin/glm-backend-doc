import { isValidEmail, isValidPhone } from "../helper/validation.helper.js";
import bcrypt from "bcrypt";
import * as userRepository from "../repositories/user.repository.js";
import * as Response from "../config/response.helper.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";

const createSessionData = (user) => {
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

  return {
    user: safeUser,
    token,
  };
};

export const registerCustomer = async ({ fullName, email, phone, password }) => {
  const cleanFullName = fullName?.trim();
  const cleanEmail = email?.trim().toLowerCase();
  const cleanPhone = phone?.trim();

  if (!cleanFullName || !cleanEmail || !cleanPhone || !password) {
    return Response.badRequest(
      "Full name, email, phone number, and password are required",
    );
  }

  if (!isValidEmail(cleanEmail)) {
    return Response.badRequest("Please provide a valid email address.");
  }

  if (!isValidPhone(cleanPhone)) {
    return Response.badRequest(
      "Phone number must contain 7 to 15 digits and may start with +.",
    );
  }

  if (password.length < 6) {
    return Response.badRequest("Password must contain at least 6 characters");
  }

  try {
    const existingUser = await userRepository.findByEmail(cleanEmail);

    if (existingUser) {
      return Response.conflict("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = await userRepository.create({
      fullName: cleanFullName,
      email: cleanEmail,
      passwordHash,
      phone: cleanPhone,
      role: "customer",
    });
    const customer = await userRepository.findForLogin(cleanEmail);

    if (!customer || customer.id !== userId) {
      return Response.internalServerError("Unable to create customer account");
    }

    return Response.created(
      createSessionData(customer),
      "Customer account created successfully",
    );
  } catch (error) {
    console.error("registerCustomer service error:", error.message);

    return Response.internalServerError("Unable to create customer account");
  }
};

export const login = async ({ email, password }) => {
  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail || !password) {
    return Response.badRequest("Email and password are required");
  }

  try {
    if (!isValidEmail(email)) {
      return Response.badRequest("Please provide a valid email address.");
    }
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

    return Response.success(createSessionData(user), "Login successful");
  } catch (error) {
    console.error("login service error:", error.message);

    return Response.internalServerError("Unable to log in");
  }
};
