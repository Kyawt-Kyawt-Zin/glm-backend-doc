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

const isPositiveInteger = (value) => {
  return Number.isInteger(Number(value)) && Number(value) > 0;
};

const isValidFee = (value) => {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
};

const formatDeliveryZone = (zone) => {
  return {
    ...zone,
    standard_fee: Number(zone.standard_fee),
    quick_fee: Number(zone.quick_fee),
  };
};

const validateZoneData = ({ name, areaDescription, standardFee, quickFee }) => {
  const cleanName = String(name || "").trim();
  const cleanAreaDescription = String(areaDescription || "").trim();

  if (!cleanName) {
    return {
      error: "Zone name is required",
    };
  }

  if (!isValidFee(standardFee) || !isValidFee(quickFee)) {
    return {
      error: "Standard and quick fees must be zero or positive numbers",
    };
  }

  if (Number(quickFee) < Number(standardFee)) {
    return {
      error: "Quick delivery fee cannot be lower than standard delivery fee",
    };
  }

  return {
    data: {
      name: cleanName,
      areaDescription: cleanAreaDescription,
      standardFee: Number(standardFee),
      quickFee: Number(quickFee),
    },
  };
};

export const getAllDeliveryZonesForManagement = async () => {
  try {
    const deliveryZones = await deliveryZoneRepository.findAllForManagement();

    return Response.success(
      deliveryZones.map(formatDeliveryZone),
      "Delivery zones fetched successfully",
    );
  } catch (error) {
    console.error(
      "getAllDeliveryZonesForManagement service error:",
      error.message,
    );

    return Response.internalServerError("Unable to fetch delivery zones");
  }
};

export const createDeliveryZone = async (zoneData) => {
  const validation = validateZoneData(zoneData);

  if (validation.error) {
    return Response.badRequest(validation.error);
  }

  try {
    const existingZone = await deliveryZoneRepository.findByName(
      validation.data.name,
    );

    if (existingZone) {
      return Response.conflict("A delivery zone with this name already exists");
    }

    const deliveryZone = await deliveryZoneRepository.createDeliveryZone(
      validation.data,
    );

    return Response.created(
      formatDeliveryZone(deliveryZone),
      "Delivery zone created successfully",
    );
  } catch (error) {
    console.error("createDeliveryZone service error:", error.message);

    return Response.internalServerError("Unable to create delivery zone");
  }
};

export const updateDeliveryZone = async (zoneId, zoneData) => {
  const numericZoneId = Number(zoneId);

  if (!isPositiveInteger(numericZoneId)) {
    return Response.badRequest(
      "Delivery zone ID must be a positive whole number",
    );
  }

  const validation = validateZoneData(zoneData);

  if (validation.error) {
    return Response.badRequest(validation.error);
  }

  try {
    const currentZone = await deliveryZoneRepository.findById(numericZoneId);

    if (!currentZone) {
      return Response.notFound("Delivery zone not found");
    }

    const nameOwner = await deliveryZoneRepository.findByName(
      validation.data.name,
    );

    if (nameOwner && nameOwner.id !== numericZoneId) {
      return Response.conflict("A delivery zone with this name already exists");
    }

    await deliveryZoneRepository.updateDeliveryZone(numericZoneId, {
      ...validation.data,
      isActive: currentZone.is_active,
    });

    return Response.success(
      {
        id: numericZoneId,
        ...validation.data,
        is_active: Number(currentZone.is_active),
      },
      "Delivery zone updated successfully",
    );
  } catch (error) {
    console.error("updateDeliveryZone service error:", error.message);

    return Response.internalServerError("Unable to update delivery zone");
  }
};

export const deactivateDeliveryZone = async (zoneId) => {
  const numericZoneId = Number(zoneId);

  if (!isPositiveInteger(numericZoneId)) {
    return Response.badRequest(
      "Delivery zone ID must be a positive whole number",
    );
  }

  try {
    const zone = await deliveryZoneRepository.findById(numericZoneId);

    if (!zone) {
      return Response.notFound("Delivery zone not found");
    }

    if (!zone.is_active) {
      return Response.badRequest("Delivery zone is already inactive");
    }

    await deliveryZoneRepository.deactivateDeliveryZone(numericZoneId);

    return Response.success(null, "Delivery zone deactivated successfully");
  } catch (error) {
    console.error("deactivateDeliveryZone service error:", error.message);

    return Response.internalServerError("Unable to deactivate delivery zone");
  }
};

export const setDeliveryZoneActiveStatus = async (zoneId, { isActive }) => {
  const numericZoneId = Number(zoneId);

  if (!isPositiveInteger(numericZoneId) || typeof isActive !== "boolean") {
    return Response.badRequest(
      "Delivery zone ID and boolean isActive value are required",
    );
  }

  try {
    const zone = await deliveryZoneRepository.findById(numericZoneId);

    if (!zone) {
      return Response.notFound("Delivery zone not found");
    }

    if (Boolean(zone.is_active) === isActive) {
      return Response.badRequest(
        `Delivery zone is already ${isActive ? "active" : "inactive"}`,
      );
    }

    await deliveryZoneRepository.setActiveStatus(numericZoneId, isActive);

    return Response.success(
      {
        id: numericZoneId,
        is_active: isActive,
      },
      "Delivery zone status updated successfully",
    );
  } catch (error) {
    console.error("setDeliveryZoneActiveStatus service error:", error.message);

    return Response.internalServerError(
      "Unable to update delivery zone status",
    );
  }
};
