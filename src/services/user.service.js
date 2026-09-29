import bcrypt from "bcrypt";
import * as userRepository from "../repositories/user.repository.js";
import * as Response from "../config/response.helper.js";

const allowedRoles = ["customer", "staff", "admin"];

export const getAllUsers = async () => {
  try {
    const users = await userRepository.findAll();

    return Response.success(users, "Users fetched successfully");
  } catch (error) {
    console.error("getAllUsers service error:", error.message);

    return Response.internalServerError("Unable to fetch users");
  }
};

export const createUser = async ({
  fullName,
  email,
  password,
  phone,
  role = "customer",
}) => {
  const cleanFullName = fullName?.trim();
  const cleanEmail = email?.trim().toLowerCase();
  const cleanPhone = phone?.trim() || null;
  const cleanRole = role?.trim().toLowerCase();

  if (!cleanFullName || !cleanEmail || !password) {
    return Response.badRequest("Full name, email, and password are required");
  }

  if (password.length < 6) {
    return Response.badRequest("Password must contain at least 6 characters");
  }

  if (!allowedRoles.includes(cleanRole)) {
    return Response.badRequest("Role must be customer, staff, or admin");
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
      role: cleanRole,
    });

    const newUser = await userRepository.findById(userId);

    return Response.created(newUser, "User created successfully");
  } catch (error) {
    console.error("createUser service error:", error.message);

    return Response.internalServerError("Unable to create user");
  }
};

export const getUserById = async (id) => {
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.badRequest("User ID must be a positive whole number");
  }

  try {
    const user = await userRepository.findById(userId);

    if (!user) {
      return Response.notFound("User not found");
    }

    return Response.success(user, "User fetched successfully");
  } catch (error) {
    console.error("getUserById service error:", error.message);

    return Response.internalServerError("Unable to fetch user");
  }
};

export const updateUser = async (
  id,
  { fullName, email, phone, role, isActive },
) => {
  const userId = Number(id);
  const cleanFullName = fullName?.trim();
  const cleanEmail = email?.trim().toLowerCase();
  const cleanPhone = phone?.trim() || null;
  const cleanRole = role?.trim().toLowerCase();

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.badRequest("User ID must be a positive whole number");
  }

  if (!cleanFullName || !cleanEmail || !cleanRole) {
    return Response.badRequest("Full name, email, and role are required");
  }

  if (typeof isActive !== "boolean") {
    return Response.badRequest("isActive must be true or false");
  }

  if (!allowedRoles.includes(cleanRole)) {
    return Response.badRequest("Role must be customer, staff, or admin");
  }

  try {
    const user = await userRepository.findById(userId);

    if (!user) {
      return Response.notFound("User not found");
    }

    const userWithSameEmail = await userRepository.findByEmail(cleanEmail);

    if (userWithSameEmail && userWithSameEmail.id !== userId) {
      return Response.conflict("An account with this email already exists");
    }

    await userRepository.update(userId, {
      fullName: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
      role: cleanRole,
      isActive,
    });

    const updatedUser = await userRepository.findById(userId);

    return Response.success(updatedUser, "User updated successfully");
  } catch (error) {
    console.error("updateUser service error:", error.message);

    return Response.internalServerError("Unable to update user");
  }
};

export const deactivateUser = async (id) => {
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.badRequest("User ID must be a positive whole number");
  }

  try {
    const user = await userRepository.findById(userId);

    if (!user) {
      return Response.notFound("User not found");
    }

    await userRepository.deactivate(userId);

    const deactivatedUser = await userRepository.findById(userId);

    return Response.success(deactivatedUser, "User deactivated successfully");
  } catch (error) {
    console.error("deactivateUser service error:", error.message);

    return Response.internalServerError("Unable to deactivate user");
  }
};
