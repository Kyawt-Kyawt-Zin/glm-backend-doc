import { createCustomerOrderLink, pickupMapLink } from "./customer-links.js";

const statusMessages = {
  confirmed: "Your order has been confirmed.",
  out_for_delivery: "Your order is out for delivery.",
  ready_for_pickup:
    "Your order is ready for pickup. Please check your pickup details in your account.",
  delivered:
    "Your order has been delivered. Thanks for shopping with us and hoping to see you again.",
  picked_up:
    "Your order has been picked up. Thanks for shopping with us and hoping to see you again.",
  cancelled:
    "Your order has been cancelled. Please check your account for details.",
};

export const createOrderStatusEmail = ({
  fullName,
  orderNumber,
  orderId,
  status,
  deliveryMethod,
  fulfillmentType,
  pickupTimeSlot,
  isCorrection = false,
  siteUrl,
}) => {
  // Return nothing for statuses that should not trigger an email.
  if (!Object.hasOwn(statusMessages, status)) {
    return null;
  }

  const name = typeof fullName === "string" ? fullName.trim() : "";
  const greeting = name ? `Hello ${name},` : "Hello,";
  const orderLink = createCustomerOrderLink(orderId, { siteUrl });
  const canSchedule =
    deliveryMethod === "pickup" &&
    !pickupTimeSlot &&
    (status === "ready_for_pickup" ||
      (status === "confirmed" && fulfillmentType === "in_stock"));
  const pickupLine = canSchedule
    ? `\nChoose a pickup time: ${createCustomerOrderLink(orderId, { pickup: true, siteUrl })}\n`
    : deliveryMethod === "pickup" && status === "ready_for_pickup"
      ? `\nView pickup details: ${createCustomerOrderLink(orderId, { pickup: true, siteUrl })}\n`
      : "";

  return {
    subject: "Your Golden Loom Myanmar order update",
    text: `${greeting}

${isCorrection ? "Correction: " : ""}${statusMessages[status]}

Order reference: ${orderNumber}

View your order: ${orderLink}
${pickupLine}

Golden Loom Myanmar`,
  };
};

export const createPickupConfirmationEmail = ({
  fullName,
  orderNumber,
  orderId,
  pickupTimeSlot,
  updated = false,
  siteUrl,
}) => {
  if (typeof pickupTimeSlot !== "string" || !pickupTimeSlot.trim())
    throw new Error("A pickup time is required");
  const name = typeof fullName === "string" ? fullName.trim() : "";
  const greeting = name ? `Hello ${name},` : "Hello,";
  return {
    subject: updated
      ? "Your pickup time has been updated"
      : "Your pickup time is saved",
    text: `${greeting}

${updated ? "Your pickup time has been updated." : "Your pickup time is saved."}

Order reference: ${orderNumber}
Pickup: ${pickupTimeSlot}

Pickup location: ${pickupMapLink}
View pickup details: ${createCustomerOrderLink(orderId, { pickup: true, siteUrl })}

Golden Loom Myanmar`,
  };
};
