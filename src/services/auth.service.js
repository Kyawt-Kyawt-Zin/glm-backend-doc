import { isValidEmail, isValidPhone } from "../helper/validation.helper.js";
import bcrypt from "bcrypt";
import * as userRepository from "../repositories/user.repository.js";
import * as Response from "../config/response.helper.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import {
  deletedEmailMarker,
  isDeletedEmailMarker,
  DELETED_EMAIL_DOMAIN,
} from "../helper/deleted-email.helper.js";
import { tryEmailJob } from "./email-queue.service.js";

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

export const registerCustomer = async ({
  fullName,
  email,
  phone,
  password,
}) => {
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

  if (cleanEmail.endsWith(`@${DELETED_EMAIL_DOMAIN}`)) {
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
    const passwordHash = await bcrypt.hash(password, 12);
    const registration = await userRepository.registerCustomerLocked(
      deletedEmailMarker(cleanEmail),
      {
        fullName: cleanFullName,
        email: cleanEmail,
        passwordHash,
        phone: cleanPhone,
        role: "customer",
      },
    );
    if (!registration)
      return Response.conflict(
        "This email is already associated with an account and cannot be used to register.",
      );
    const { userId, emailJobId } = registration;
    tryEmailJob(emailJobId);
    const customer = await userRepository.findForLogin(cleanEmail);

    if (!customer || customer.id !== userId) {
      return Response.internalServerError("Unable to create customer account");
    }

    const sessionData = createSessionData(customer);

    return Response.created(
      sessionData,
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

    if (!user || isDeletedEmailMarker(user.email)) {
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

export const updateMyProfile = async (userId, role, data = {}) => {
  if (role !== "customer")
    return Response.forbidden("Customer account required.");
  if (
    !data ||
    typeof data.fullName !== "string" ||
    typeof data.phone !== "string"
  ) {
    return Response.badRequest("Enter your name and phone number.");
  }

  const fullName = data.fullName.trim();
  const phone = data.phone.trim();
  if (!fullName || fullName.length > 100) {
    return Response.badRequest("Enter a name of 1 to 100 characters.");
  }
  if (!isValidPhone(phone)) {
    return Response.badRequest(
      "Phone number must contain 7 to 15 digits and may start with +.",
    );
  }

  try {
    const updated = await userRepository.updateOwnCustomerProfile(userId, {
      fullName,
      phone,
    });
    if (!updated) return Response.unauthorized("Account is unavailable.");
    const user = await userRepository.findById(userId);
    if (
      !user ||
      !user.is_active ||
      user.role !== "customer" ||
      isDeletedEmailMarker(user.email)
    ) {
      return Response.unauthorized("Account is unavailable.");
    }
    return Response.success(user, "Profile updated successfully.");
  } catch (error) {
    console.error("updateMyProfile service error:", error.message);
    return Response.internalServerError("Unable to update your profile.");
  }
};

export const deleteMyAccount = async (userId, password) => {
  if (typeof password !== "string" || !password)
    return Response.badRequest(
      "Enter your password to confirm account deletion.",
    );
  try {
    const user = await userRepository.getAccountForDeletion(userId);
    if (
      !user ||
      user.role !== "customer" ||
      !user.is_active ||
      isDeletedEmailMarker(user.email)
    )
      return Response.unauthorized("Account is unavailable.");
    if (!(await bcrypt.compare(password, user.password_hash)))
      return Response.badRequest("The password is incorrect.");
    const outcome = await userRepository.deleteCustomerProfile(
      user.id,
      user.email,
      deletedEmailMarker(user.email),
      user.password_hash,
    );
    if (outcome === "active_order")
      return Response.conflict(
        "You have an active order. Please contact the shop before deleting your account.",
      );
    if (outcome === "pending_checkout")
      return Response.conflict("You have an unfinished preorder checkout. If you have not transferred the deposit, cancel the checkout first. Otherwise, please contact the shop.");
    if (outcome !== "deleted")
      return Response.conflict(
        "Your account changed. Please sign in again and retry.",
      );
    return Response.success(null, "Your customer profile has been deleted.");
  } catch (error) {
    console.error("deleteMyAccount service error:", error.message);
    return Response.internalServerError(
      "Unable to delete your account. Please contact the shop.",
    );
  }
};
