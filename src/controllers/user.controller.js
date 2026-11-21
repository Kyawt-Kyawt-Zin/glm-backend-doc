import { Router } from "express";
import * as userService from "../services/user.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";
import {
  validateCustomerIdParam,
  validateCustomerListQuery,
  validateCustomerStatusUpdate,
} from "../validators/user.validator.js";

const router = Router();

router.use(authenticate, authorizeRoles("admin"));

router.get("/", async (req, res) => {
  const response = await userService.getAllUsers();

  return res.status(response.code).json(response);
});

router.get("/customers", validateCustomerListQuery, async (req, res) => {
  const response = await userService.getCustomers(req.query);

  return res.status(response.code).json(response);
});

router.get("/:id/orders", validateCustomerIdParam, async (req, res) => {
  const response = await userService.getCustomerOrderHistory(req.params.id);

  return res.status(response.code).json(response);
});

router.get("/:id", validateCustomerIdParam, async (req, res) => {
  const response = await userService.getUserById(req.params.id);

  return res.status(response.code).json(response);
});

router.post("/", async (req, res) => {
  const response = await userService.createUser(req.body);

  return res.status(response.code).json(response);
});

router.put("/:id", async (req, res) => {
  const response = await userService.updateUser(req.params.id, req.body);

  return res.status(response.code).json(response);
});

router.patch("/:id/status", validateCustomerStatusUpdate, async (req, res) => {
  const response = await userService.updateCustomerActiveStatus(
    req.params.id,
    req.body.isActive,
  );

  return res.status(response.code).json(response);
});

router.delete("/:id", async (req, res) => {
  const response = await userService.deactivateUser(req.params.id);

  return res.status(response.code).json(response);
});

export default router;
