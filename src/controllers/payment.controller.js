import { Router } from "express";
import * as paymentService from "../services/payment.service.js";
import {
  validatePaymentIdParam,
  validatePaymentProofSubmission,
} from "../validators/payment.validator.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";
import fs from "node:fs/promises";
import path from "node:path";
import * as Response from "../config/response.helper.js";
import uploadPaymentProof from "../middlewares/payment-proof-upload.middleware.js";

const router = Router();

router.use(authenticate);

const uploadSinglePaymentProof = (req, res, next) => {
  uploadPaymentProof.single("paymentProof")(req, res, (error) => {
    if (error) {
      const response = Response.badRequest(error.message);

      return res.status(response.code).json(response);
    }

    return next();
  });
};

router.post(
  "/:paymentId/proof",
  validatePaymentIdParam,
  uploadSinglePaymentProof,
  validatePaymentProofSubmission,
  async (req, res) => {
    const response = await paymentService.submitCustomerPreorderDepositProof(
      req.user.userId,
      Number(req.params.paymentId),
      {
        transactionReference: req.body.transactionReference,
        paymentProofPath: req.file?.filename,
      },
    );

    if (response.code >= 400 && req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    return res.status(response.code).json(response);
  },
);

router.use(authorizeRoles("admin", "staff"));

const paymentProofDirectory = path.join(
  process.cwd(),
  "storage",
  "payment-proofs",
);

router.get("/:paymentId/proof", validatePaymentIdParam, async (req, res) => {
  const response = await paymentService.getPaymentProofForManagement(
    Number(req.params.paymentId),
  );

  if (response.code >= 400) {
    return res.status(response.code).json(response);
  }

  const filename = path.basename(response.data.filename);
  const filePath = path.join(paymentProofDirectory, filename);

  try {
    await fs.access(filePath);
  } catch {
    const notFoundResponse = Response.notFound("Payment proof file not found");

    return res.status(notFoundResponse.code).json(notFoundResponse);
  }

  return res.set("Cache-Control", "private, no-store").sendFile(filePath);
});

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

router.get("/:paymentId", validatePaymentIdParam, async (req, res) => {
  const response = await paymentService.getPaymentDetailsForManagement(
    Number(req.params.paymentId),
  );

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
