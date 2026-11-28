import { Router } from "express";
import * as orderService from "../services/order.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/checkout/preorder/draft", async (req, res) => {
  const response = await orderService.getPendingPreorderDraft(req.user.userId);
  return res.set("Cache-Control", "private, no-store").status(response.code).json(response);
});

router.post("/checkout/preorder/draft", async (req, res) => {
  const response = await orderService.preparePreorderCheckout(req.user.userId, req.body);
  return res.set("Cache-Control", "private, no-store").status(response.code).json(response);
});

router.get("/checkout/preorder/:draftId", async (req, res) => {
  const response = await orderService.getPreorderDraftStatus(req.user.userId, req.params.draftId);
  return res.set("Cache-Control", "private, no-store").status(response.code).json(response);
});

router.post("/checkout/preorder/:draftId/cancel", async (req, res) => {
  const response = await orderService.cancelPreorderDraft(req.user.userId, req.params.draftId, req.body?.acknowledgedNoTransfer);
  return res.set("Cache-Control", "private, no-store").status(response.code).json(response);
});

router.post("/checkout/preorder/:draftId/upload", async (req, res) => {
  const response = await orderService.preparePreorderReceiptUpload(req.user.userId, req.params.draftId, req.body?.contentType);
  return res.set("Cache-Control", "private, no-store").status(response.code).json(response);
});

router.post("/checkout/preorder/:draftId/complete", async (req, res) => {
  const response = await orderService.completePreorderCheckout(req.user.userId, req.params.draftId, req.body?.transactionReference);
  return res.set("Cache-Control", "private, no-store").status(response.code).json(response);
});

router.post("/checkout", async (req, res) => {
  const response = await orderService.checkoutMyCart(req.user.userId, req.body);

  return res.status(response.code).json(response);
});

router.get("/my", async (req, res) => {
  const response = await orderService.getMyOrders(req.user.userId);

  return res.status(response.code).json(response);
});

router.patch("/my/:orderId/pickup", async (req, res) => {
  const response = await orderService.scheduleCustomerPickup(req.user.userId, req.params.orderId, req.body);
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

router.patch("/:orderId/items/:itemId/preorder-received", authorizeRoles("admin", "staff"), async (req, res) => {
  const response = await orderService.updatePreorderReceivedQuantity(req.params.orderId, req.params.itemId, req.body?.quantity);
  return res.status(response.code).json(response);
});

router.patch(
  "/:orderId/status",
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    const response = await orderService.updateOrderStatusForManagement(
      req.params.orderId,
      req.body,
      req.user.userId,
    );

    return res.status(response.code).json(response);
  },
);

router.patch(
  "/:orderId/status-correction",
  authorizeRoles("admin"),
  async (req, res) => {
    const response = await orderService.correctOrderStatusForManagement(
      req.params.orderId,
      req.body,
      req.user.userId,
    );

    return res.status(response.code).json(response);
  },
);

export default router;
