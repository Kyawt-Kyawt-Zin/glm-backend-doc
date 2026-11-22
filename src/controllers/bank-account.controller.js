import { Router } from "express";
import * as bankAccountService from "../services/bank-account.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";
import {
  validateBankAccountCreate,
  validateBankAccountStatusUpdate,
  validateBankAccountUpdate,
} from "../validators/bank-account.validator.js";

const router = Router();

router.get("/", async (_req, res) => {
  const response = await bankAccountService.getActiveBankAccounts();

  return res.status(response.code).json(response);
});

router.get(
  "/management",
  authenticate,
  authorizeRoles("admin"),
  async (_req, res) => {
    const response = await bankAccountService.getBankAccountsForManagement();

    return res.status(response.code).json(response);
  },
);

router.post(
  "/",
  authenticate,
  authorizeRoles("admin"),
  validateBankAccountCreate,
  async (req, res) => {
    const response = await bankAccountService.createBankAccount(req.body);

    return res.status(response.code).json(response);
  },
);

router.put(
  "/:accountId",
  authenticate,
  authorizeRoles("admin"),
  validateBankAccountUpdate,
  async (req, res) => {
    const response = await bankAccountService.updateBankAccount(
      req.params.accountId,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

router.patch(
  "/:accountId/status",
  authenticate,
  authorizeRoles("admin"),
  validateBankAccountStatusUpdate,
  async (req, res) => {
    const response = await bankAccountService.setBankAccountActiveStatus(
      req.params.accountId,
      req.body.isActive,
    );

    return res.status(response.code).json(response);
  },
);

export default router;
