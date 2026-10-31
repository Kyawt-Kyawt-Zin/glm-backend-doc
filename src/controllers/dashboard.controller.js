import { Router } from "express";
import * as dashboardService from "../services/dashboard.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

const router = Router();

router.get(
  "/overview",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await dashboardService.getDashboardOverview();

    return res.status(response.code).json(response);
  },
);

export default router;
