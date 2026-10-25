import { Router } from "express";
import * as cartService from "../services/cart.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  const response = await cartService.getMyCart(req.user.userId);

  return res.status(response.code).json(response);
});

router.post("/items", async (req, res) => {
  const response = await cartService.addItemToCart(req.user.userId, req.body);

  return res.status(response.code).json(response);
});

router.patch("/items/:itemId", async (req, res) => {
  const response = await cartService.updateMyCartItem(
    req.user.userId,
    req.params.itemId,
    req.body,
  );

  return res.status(response.code).json(response);
});

router.delete("/items/:itemId", async (req, res) => {
  const response = await cartService.removeMyCartItem(
    req.user.userId,
    req.params.itemId,
  );

  return res.status(response.code).json(response);
});

export default router;
