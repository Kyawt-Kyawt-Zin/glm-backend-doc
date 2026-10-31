import { Router } from "express";
import * as feedbackService from "../services/feedback.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorizeRoles("customer", "admin"),
  async (req, res) => {
    const response = await feedbackService.createMyFeedback(
      req.user.userId,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

router.get(
  "/my",
  authorizeRoles("customer", "admin"),
  async (req, res) => {
    const response = await feedbackService.getMyFeedback(req.user.userId);

    return res.status(response.code).json(response);
  },
);

router.get(
  "/",
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await feedbackService.getFeedbackForManagement();

    return res.status(response.code).json(response);
  },
);

router.patch(
  "/:feedbackId/review",
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await feedbackService.reviewFeedback(
      req.params.feedbackId,
      req.user.userId,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

export default router;