import { Router } from "express";
import * as authService from "../services/auth.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import * as Response from "../config/response.helper.js";

const router = Router();

router.post("/login", async (req, res) => {
  const response = await authService.login(req.body);

  return res.status(response.code).json(response);
});

router.get("/me", authenticate, (req, res) => {
  const response = Response.success(
    req.user,
    "Authenticated user fetched successfully",
  );

  return res.status(response.code).json(response);
});

export default router;
