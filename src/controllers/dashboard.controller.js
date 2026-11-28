import { Router } from "express";
import * as dashboardService from "../services/dashboard.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";
import { validateAnalyticsWeekQuery } from "../validators/dashboard.validator.js";

const router = Router();

router.get("/confirmed-preorders", authenticate, authorizeRoles("admin", "staff"), async (req, res) => {
  const response = await dashboardService.getConfirmedPreorderItems();
  return res.status(response.code).json(response);
});

router.get("/received-preorders", authenticate, authorizeRoles("admin", "staff"), async (req, res) => {
  const response = await dashboardService.getReceivedPreorderItems();
  return res.status(response.code).json(response);
});

router.get(
  "/overview",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await dashboardService.getDashboardOverview();

    return res.status(response.code).json(response);
  },
);

router.get(
  "/analytics",
  authenticate,
  authorizeRoles("admin", "staff"),
  validateAnalyticsWeekQuery,
  async (req, res) => {
    const response = await dashboardService.getDashboardAnalytics(
      req.query.weekStart,
    );

    return res.status(response.code).json(response);
  },
);

router.get(
  "/recent-orders",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await dashboardService.getRecentOrders(req.query.limit);

    return res.status(response.code).json(response);
  },
);

router.get(
  "/low-stock",
  authenticate,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await dashboardService.getLowStockVariants(
      req.query.threshold,
    );

    return res.status(response.code).json(response);
  },
);

export default router;
