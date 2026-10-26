import { Router } from "express";
import * as deliveryZoneService from "../services/delivery-zone.service.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorization.middleware.js";

const router = Router();

router.get("/", async (req, res) => {
  const response = await deliveryZoneService.getAllActiveDeliveryZones();

  return res.status(response.code).json(response);
});

router.get(
  "/management",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    const response =
      await deliveryZoneService.getAllDeliveryZonesForManagement();

    return res.status(response.code).json(response);
  },
);

router.post("/", authenticate, authorizeRoles("admin"), async (req, res) => {
  const response = await deliveryZoneService.createDeliveryZone(req.body);

  return res.status(response.code).json(response);
});

router.put(
  "/:zoneId",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    const response = await deliveryZoneService.updateDeliveryZone(
      req.params.zoneId,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

router.delete(
  "/:zoneId",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    const response = await deliveryZoneService.deactivateDeliveryZone(
      req.params.zoneId,
    );

    return res.status(response.code).json(response);
  },
);

router.patch(
  "/:zoneId/status",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    const response = await deliveryZoneService.setDeliveryZoneActiveStatus(
      req.params.zoneId,
      req.body,
    );

    return res.status(response.code).json(response);
  },
);

export default router;
