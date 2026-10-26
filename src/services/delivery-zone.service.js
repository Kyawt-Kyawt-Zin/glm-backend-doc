import * as Response from "../config/response.helper.js";
import * as deliveryZoneRepository from "../repositories/delivery-zone.repository.js";

export const getAllActiveDeliveryZones = async () => {
  try {
    const deliveryZones = await deliveryZoneRepository.findAllActive();

    const formattedZones = deliveryZones.map((zone) => {
      return {
        ...zone,
        standard_fee: Number(zone.standard_fee),
        quick_fee: Number(zone.quick_fee),
      };
    });

    return Response.success(
      formattedZones,
      "Delivery zones fetched successfully",
    );
  } catch (error) {
    console.error("getAllActiveDeliveryZones service error:", error.message);

    return Response.internalServerError("Unable to fetch delivery zones");
  }
};
