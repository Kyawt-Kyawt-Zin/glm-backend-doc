import { isValidEmail, isValidPhone } from "../helper/validation.helper.js";
import bcrypt from "bcrypt";
import * as userRepository from "../repositories/user.repository.js";
import * as orderRepository from "../repositories/order.repository.js";
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

export const getCustomers = async ({
  page = 1,
  limit = 5,
  search = "",
  status = "all",
}) => {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  const cleanSearch = typeof search === "string" ? search.trim() : "";

  const cleanStatus =
    typeof status === "string" ? status.trim().toLowerCase() : "all";

  const allowedStatuses = ["all", "active", "inactive"];

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    return Response.badRequest("page must be a positive whole number");
  }

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
    return Response.badRequest("limit must be a whole number between 1 and 50");
  }

  if (!allowedStatuses.includes(cleanStatus)) {
    return Response.badRequest("status must be all, active, or inactive");
  }

  const offset = (parsedPage - 1) * parsedLimit;

  try {
    const [customers, totalItems] = await Promise.all([
      userRepository.findCustomers({
        limit: parsedLimit,
        offset,
        search: cleanSearch,
        status: cleanStatus,
      }),
      userRepository.countCustomers({
        search: cleanSearch,
        status: cleanStatus,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / parsedLimit));

    return Response.success(
      {
        customers,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          totalItems,
          totalPages,
        },
      },
      "Customers fetched successfully",
    );
  } catch (error) {
    console.error("getCustomers service error:", error.message);

    return Response.internalServerError("Unable to fetch customers");
  }
};

export const getCustomerOrderHistory = async (id) => {
  const customerId = Number(id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return Response.badRequest("Customer ID must be a positive whole number");
  }

  try {
    const customer = await userRepository.findById(customerId);

    if (!customer || customer.role !== "customer") {
      return Response.notFound("Customer not found");
    }

    const orders = await orderRepository.findAllByUserId(customerId);

    return Response.success(
      {
        customer,
        orders: orders.map((order) => {
          return {
            ...order,
            total_amount: Number(order.total_amount),
            deposit_amount: Number(order.deposit_amount),
          };
        }),
      },
      "Customer order history fetched successfully",
    );
  } catch (error) {
    console.error("getCustomerOrderHistory service error:", error.message);

    return Response.internalServerError(
      "Unable to fetch customer order history",
    );
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
    if (!fullName?.trim()) {
      return Response.badRequest("Full name is required.");
    }

    if (!isValidEmail(email)) {
      return Response.badRequest("Please provide a valid email address.");
    }

    if (!isValidPhone(phone)) {
      return Response.badRequest(
        "Phone number must contain 7 to 15 digits and may start with +.",
      );
    }
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
    if (!fullName?.trim()) {
      return Response.badRequest("Full name is required.");
    }

    if (!isValidEmail(email)) {
      return Response.badRequest("Please provide a valid email address.");
    }

    if (!isValidPhone(phone)) {
      return Response.badRequest(
        "Phone number must contain 7 to 15 digits and may start with +.",
      );
    }
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

export const updateCustomerActiveStatus = async (id, isActive) => {
  const customerId = Number(id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return Response.badRequest("Customer ID must be a positive whole number");
  }

  if (typeof isActive !== "boolean") {
    return Response.badRequest("isActive must be true or false");
  }

  try {
    const customer = await userRepository.findById(customerId);

    if (!customer || customer.role !== "customer") {
      return Response.notFound("Customer not found");
    }

    if (Boolean(customer.is_active) === isActive) {
      return Response.success(
        customer,
        `Customer is already ${isActive ? "active" : "inactive"}`,
      );
    }

    await userRepository.updateActiveStatus(customerId, isActive);

    const updatedCustomer = await userRepository.findById(customerId);

    return Response.success(
      updatedCustomer,
      `Customer ${isActive ? "activated" : "deactivated"} successfully`,
    );
  } catch (error) {
    console.error("updateCustomerActiveStatus service error:", error.message);

    return Response.internalServerError("Unable to update customer status");
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
