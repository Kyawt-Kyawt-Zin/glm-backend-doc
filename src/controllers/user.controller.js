import { Router } from "express";
import * as userService from "../services/user.service.js";

const router = Router();

router.get("/", async (req, res) => {
  const response = await userService.getAllUsers();

  return res.status(response.code).json(response);
});

router.get("/:id", async (req, res) => {
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

router.delete("/:id", async (req, res) => {
  const response = await userService.deactivateUser(req.params.id);

  return res.status(response.code).json(response);
});

export default router;
