import { Router } from "express";
import * as paymentService from "../services/payment.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

const router = Router();

router.use(authenticate, authorizeRoles("admin", "staff"));

router.get("/pending-deposits", async (req, res) => {
  const response = await paymentService.getPendingDepositPayments();

  return res.status(response.code).json(response);
});

router.patch("/:paymentId/confirm", async (req, res) => {
  const response = await paymentService.confirmPreorderDeposit(
    req.user.userId,
    Number(req.params.paymentId),
    req.body,
  );

  return res.status(response.code).json(response);
});

router.get("/refund-pending", async (req, res) => {
  const response = await paymentService.getRefundPendingPayments();

  return res.status(response.code).json(response);
});

router.patch("/:paymentId/refund", async (req, res) => {
  const response = await paymentService.completePreorderDepositRefund(
    req.user.userId,
    Number(req.params.paymentId),
    req.body,
  );

  return res.status(response.code).json(response);
});

export default router;
