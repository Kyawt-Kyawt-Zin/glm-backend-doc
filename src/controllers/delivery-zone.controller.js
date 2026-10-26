import { Router } from "express";
import * as deliveryZoneService from "../services/delivery-zone.service.js";

const router = Router();

router.get("/", async (req, res) => {
  const response = await deliveryZoneService.getAllActiveDeliveryZones();

  return res.status(response.code).json(response);
});

export default router;
