import { Router } from "express";
import * as orderService from "../services/order.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/checkout", async (req, res) => {
  const response = await orderService.checkoutMyCart(req.user.userId, req.body);

  return res.status(response.code).json(response);
});

router.get("/my", async (req, res) => {
  const response = await orderService.getMyOrders(req.user.userId);

  return res.status(response.code).json(response);
});

router.get("/my/:orderId", async (req, res) => {
  const response = await orderService.getMyOrderById(
    req.user.userId,
    req.params.orderId,
  );

  return res.status(response.code).json(response);
});

router.get("/", authorizeRoles("admin", "staff"), async (req, res) => {
  const response = await orderService.getOrdersForManagement();

  return res.status(response.code).json(response);
});

router.get("/:orderId", authorizeRoles("admin", "staff"), async (req, res) => {
  const response = await orderService.getOrderForManagement(req.params.orderId);

  return res.status(response.code).json(response);
});

router.patch(
  "/:orderId/status",
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await orderService.updateOrderStatusForManagement(
      req.params.orderId,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

export default router;
