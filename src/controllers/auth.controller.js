import * as customerRefreshService from "../services/customer-refresh-session.service.js";
import {
  clearCustomerRefreshCookie,
  readCustomerRefreshCookie,
  setCustomerRefreshCookie,
} from "../helper/customer-refresh-cookie.helper.js";
import { Router } from "express";
import * as authService from "../services/auth.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import * as Response from "../config/response.helper.js";

const router = Router();

const sendCustomerAuthResponse = async (req, res, response) => {
  const user = response.data?.user;

  // Keep the existing response for errors and staff/admin accounts.
  if (
    response.status !== "ok" ||
    user?.role !== "customer" ||
    req.get("X-Customer-Session") !== "refresh"
  ) {
    return res.status(response.code).json(response);
  }

  try {
    const accessToken = customerRefreshService.createCustomerAccessToken(user);
    const refreshToken =
      await customerRefreshService.createCustomerRefreshSession(user.id);

    setCustomerRefreshCookie(res, refreshToken);

    return res.status(response.code).json({
      ...response,
      data: {
        ...response.data,
        token: accessToken,
      },
    });
  } catch (error) {
    console.error("Customer session creation error:", error.message);

    const failure = Response.internalServerError(
      "Unable to start your session. Please try signing in.",
    );
    return res.status(failure.code).json(failure);
  }
};

router.post("/register", async (req, res) => {
  const response = await authService.registerCustomer(req.body);

  return sendCustomerAuthResponse(req, res, response);
});

router.post("/login", async (req, res) => {
  const response = await authService.login(req.body);

  return sendCustomerAuthResponse(req, res, response);
});

router.patch("/me", authenticate, async (req, res) => {
  const response = await authService.updateMyProfile(req.user.userId, req.user.role, req.body);
  return res.status(response.code).json(response);
});

router.delete("/me", authenticate, async (req, res) => {
  const response = await authService.deleteMyAccount(
    req.user.userId,
    req.body?.password,
  );
  return res.status(response.code).json(response);
});

router.get("/me", authenticate, (req, res) => {
  const response = Response.success(
    req.user,
    "Authenticated user fetched successfully",
  );

  return res.status(response.code).json(response);
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = readCustomerRefreshCookie(req);
    const session =
      await customerRefreshService.refreshCustomerSession(refreshToken);

    if (!session) {
      clearCustomerRefreshCookie(res);
      const response = Response.unauthorized(
        "Your session has expired. Please sign in again.",
      );
      return res.status(response.code).json(response);
    }

    setCustomerRefreshCookie(res, session.refreshToken);

    const response = Response.success({
      user: session.user,
      token: session.accessToken,
    });

    return res.status(response.code).json(response);
  } catch (error) {
    console.error("Customer session refresh error:", error.message);
    const response = Response.internalServerError(
      "Unable to refresh your session.",
    );
    return res.status(response.code).json(response);
  }
});

router.post("/logout", async (req, res) => {
  try {
    const refreshToken = readCustomerRefreshCookie(req);

    await customerRefreshService.revokeCustomerRefreshSession(refreshToken);
    clearCustomerRefreshCookie(res);

    const response = Response.success(null, "Signed out successfully.");
    return res.status(response.code).json(response);
  } catch (error) {
    console.error("Customer sign-out error:", error.message);
    const response = Response.internalServerError("Unable to sign out.");
    return res.status(response.code).json(response);
  }
});

export default router;
