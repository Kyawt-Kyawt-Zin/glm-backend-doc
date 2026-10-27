import { Router } from "express";
import * as changeRequestService from "../services/order-change-request.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/my", async (req, res) => {
  const response = await changeRequestService.getMyOrderChangeRequests(
    req.user.userId,
  );

  return res.status(response.code).json(response);
});

router.post("/", async (req, res) => {
  const response = await changeRequestService.createMyOrderChangeRequest(
    req.user.userId,
    req.body,
  );

  return res.status(response.code).json(response);
});

router.get("/", authorizeRoles("admin", "staff"), async (req, res) => {
  const response =
    await changeRequestService.getOrderChangeRequestsForManagement();

  return res.status(response.code).json(response);
});

router.patch(
  "/:requestId/review",
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await changeRequestService.reviewOrderChangeRequest(
      req.user.userId,
      Number(req.params.requestId),
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

export default router;
