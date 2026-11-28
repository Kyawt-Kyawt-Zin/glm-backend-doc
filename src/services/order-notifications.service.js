import { findOrderNotificationContext } from "../repositories/order.repository.js";
import { sendEmail } from "./email.service.js";
import {
  createOrderStatusEmail,
  createPickupConfirmationEmail,
} from "./order-email.template.js";

// Notifications are optional and must never turn a committed order into an error.
export const notifyOrderStatus = async (
  orderId,
  status,
  { isCorrection = false } = {},
) => {
  if (process.env.ORDER_EMAIL_ENABLED !== "true") return;
  try {
    const order = await findOrderNotificationContext(orderId);
    if (!order || order.status !== status || !order.customer_email) return;
    const message = createOrderStatusEmail({
      fullName: order.customer_name,
      orderNumber: order.order_number,
      orderId: order.id,
      status,
      deliveryMethod: order.delivery_method,
      fulfillmentType: order.fulfillment_type,
      pickupTimeSlot: order.pickup_time_slot,
      isCorrection,
    });
    if (message) await sendEmail({ to: order.customer_email, message });
  } catch (error) {
    console.error(
      "Order update email failed. Error code:",
      error.code || "UNKNOWN",
    );
  }
};

export const notifyPickupTime = async (
  orderId,
  pickupTimeSlot,
  { updated = false } = {},
) => {
  if (process.env.ORDER_EMAIL_ENABLED !== "true") return;
  try {
    const order = await findOrderNotificationContext(orderId);
    if (
      !order ||
      order.delivery_method !== "pickup" ||
      order.pickup_time_slot !== pickupTimeSlot ||
      !order.customer_email ||
      ["cancelled", "delivered", "picked_up"].includes(order.status)
    )
      return;
    const message = createPickupConfirmationEmail({
      fullName: order.customer_name,
      orderNumber: order.order_number,
      orderId: order.id,
      pickupTimeSlot,
      updated,
    });
    await sendEmail({ to: order.customer_email, message });
  } catch (error) {
    console.error(
      "Pickup time email failed. Error code:",
      error.code || "UNKNOWN",
    );
  }
};
