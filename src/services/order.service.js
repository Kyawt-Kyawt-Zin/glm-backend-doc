import { randomUUID } from "node:crypto";
import * as Response from "../config/response.helper.js";
import * as orderRepository from "../repositories/order.repository.js";
import * as deliveryZoneRepository from "../repositories/delivery-zone.repository.js";

const PREORDER_DEPOSIT_PERCENTAGE = 20;

const isPositiveInteger = (value) => {
  return Number.isInteger(Number(value)) && Number(value) > 0;
};

const roundMoney = (value) => {
  return Number(Number(value).toFixed(2));
};

const generateOrderNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const uniquePart = randomUUID().split("-")[0].toUpperCase();

  return `GLM-${datePart}-${uniquePart}`;
};

const getEstimatedReadyDate = (items) => {
  const longestLeadDays = Math.max(
    ...items.map((item) => Number(item.preorder_lead_days) || 14),
  );

  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + longestLeadDays);

  return estimatedDate.toISOString().slice(0, 10);
};

const resolveDeliveryDetails = async (delivery, fulfillmentType) => {
  const deliveryMethod = delivery?.deliveryMethod;

  if (!["standard", "quick", "pickup"].includes(deliveryMethod)) {
    return {
      error: "Delivery method must be standard, quick, or pickup",
    };
  }

  if (fulfillmentType === "preorder" && deliveryMethod === "quick") {
    return {
      error: "Quick delivery is available only for in-stock orders",
    };
  }

  const paymentMethod =
    fulfillmentType === "preorder"
      ? delivery?.remainingPaymentMethod
      : delivery?.paymentMethod;

  const allowedPaymentMethods =
    deliveryMethod === "pickup"
      ? ["cash_on_pickup", "bank_transfer"]
      : ["cash_on_delivery", "bank_transfer"];

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    return {
      error:
        "Selected payment method is not available for this delivery method",
    };
  }

  if (deliveryMethod === "pickup") {
    const pickupTimeSlot = delivery?.pickupTimeSlot?.trim();

    if (!pickupTimeSlot) {
      return {
        error: "Pickup time slot is required for pickup orders",
      };
    }

    return {
      data: {
        deliveryMethod,
        deliveryZoneId: null,
        deliveryZoneName: null,
        deliveryAddress: null,
        pickupTimeSlot,
        deliveryFee: 0,
        paymentMethod,
      },
    };
  }

  const deliveryZoneId = Number(delivery?.deliveryZoneId);
  const deliveryAddress = delivery?.deliveryAddress?.trim();

  if (!isPositiveInteger(deliveryZoneId) || !deliveryAddress) {
    return {
      error: "Delivery zone and delivery address are required",
    };
  }

  const zone = await deliveryZoneRepository.findActiveById(deliveryZoneId);

  if (!zone) {
    return {
      error: "Selected delivery zone is not available",
    };
  }

  const deliveryFee =
    deliveryMethod === "standard"
      ? Number(zone.standard_fee)
      : Number(zone.quick_fee);

  return {
    data: {
      deliveryMethod,
      deliveryZoneId: zone.id,
      deliveryZoneName: zone.name,
      deliveryAddress,
      pickupTimeSlot: null,
      deliveryFee,
      paymentMethod,
    },
  };
};

const createOrderWithItems = async ({
  connection,
  userId,
  recipientName,
  recipientPhone,
  fulfillmentType,
  items,
  delivery,
}) => {
  const subtotal = roundMoney(
    items.reduce((total, item) => {
      return total + Number(item.price) * Number(item.quantity);
    }, 0),
  );

  const deliveryFee = roundMoney(delivery.deliveryFee);
  const totalAmount = roundMoney(subtotal + deliveryFee);

  const isPreorder = fulfillmentType === "preorder";
  const depositPercentage = isPreorder ? PREORDER_DEPOSIT_PERCENTAGE : 0;
  const depositAmount = isPreorder
    ? roundMoney((subtotal * PREORDER_DEPOSIT_PERCENTAGE) / 100)
    : 0;

  const orderNumber = generateOrderNumber();
  const estimatedReadyDate = isPreorder ? getEstimatedReadyDate(items) : null;

  const orderId = await orderRepository.createOrder(connection, {
    orderNumber,
    userId,
    fulfillmentType,
    status: "pending",
    paymentMethod: isPreorder ? "split_payment" : delivery.paymentMethod,
    paymentStatus: isPreorder ? "deposit_pending" : "unpaid",
    deliveryMethod: delivery.deliveryMethod,
    deliveryZoneId: delivery.deliveryZoneId,
    deliveryZoneName: delivery.deliveryZoneName,
    recipientName,
    recipientPhone,
    deliveryAddress: delivery.deliveryAddress,
    pickupTimeSlot: delivery.pickupTimeSlot,
    subtotal,
    deliveryFee,
    totalAmount,
    depositPercentage,
    depositAmount,
    estimatedReadyDate,
  });

  for (const item of items) {
    const unitPrice = roundMoney(Number(item.price));
    const lineTotal = roundMoney(unitPrice * Number(item.quantity));

    await orderRepository.createOrderItem(connection, {
      orderId,
      productId: item.product_id,
      productVariantId: item.product_variant_id,
      productName: item.product_name,
      productSlug: item.product_slug,
      categoryName: item.category_name,
      color: item.color,
      size: item.size,
      sku: item.sku,
      unitPrice,
      quantity: item.quantity,
      lineTotal,
      preorderLeadDays: isPreorder
        ? Number(item.preorder_lead_days) || 14
        : null,
      depositPercentage,
    });

    if (fulfillmentType === "in_stock") {
      const stockWasReduced = await orderRepository.decreaseVariantStock(
        connection,
        item.product_variant_id,
        item.quantity,
      );

      if (!stockWasReduced) {
        throw new Error("IN_STOCK_QUANTITY_CHANGED");
      }
    }
  }

  if (isPreorder) {
    await orderRepository.createPayment(connection, {
      orderId,
      paymentType: "deposit",
      paymentMethod: "bank_transfer",
      amount: depositAmount,
      status: "pending",
    });

    await orderRepository.createPayment(connection, {
      orderId,
      paymentType: "remaining_balance",
      paymentMethod: delivery.paymentMethod,
      amount: roundMoney(totalAmount - depositAmount),
      status: "pending",
    });
  } else {
    await orderRepository.createPayment(connection, {
      orderId,
      paymentType: "full_payment",
      paymentMethod: delivery.paymentMethod,
      amount: totalAmount,
      status: "pending",
    });
  }

  return {
    id: orderId,
    order_number: orderNumber,
    fulfillment_type: fulfillmentType,
    total_amount: totalAmount,
    deposit_amount: depositAmount,
    estimated_ready_date: estimatedReadyDate,
  };
};

export const checkoutMyCart = async (userId, checkoutData) => {
  const recipientName = String(checkoutData?.recipientName || "").trim();
  const recipientPhone = String(checkoutData?.recipientPhone || "").trim();

  if (!recipientName || !recipientPhone) {
    return Response.badRequest("Recipient name and phone are required");
  }

  let connection;

  try {
    connection = await orderRepository.getCheckoutConnection();
    await connection.beginTransaction();

    const cart = await orderRepository.findActiveCartForCheckout(
      connection,
      userId,
    );

    if (!cart) {
      await connection.rollback();

      return Response.badRequest("Your cart is empty");
    }

    const cartItems = await orderRepository.getCartItemsForCheckout(
      connection,
      cart.id,
    );

    if (cartItems.length === 0) {
      await connection.rollback();

      return Response.badRequest("Your cart is empty");
    }

    const unavailableItem = cartItems.find((item) => {
      return (
        !Number(item.variant_is_active) ||
        !Number(item.product_is_active) ||
        !Number(item.category_is_active)
      );
    });

    if (unavailableItem) {
      await connection.rollback();

      return Response.badRequest(
        "One or more cart items are no longer available",
      );
    }

    const inStockItems = cartItems.filter(
      (item) => item.fulfillment_type === "in_stock",
    );

    const preorderItems = cartItems.filter(
      (item) => item.fulfillment_type === "preorder",
    );

    const stockProblem = inStockItems.find((item) => {
      return Number(item.stock_quantity) < Number(item.quantity);
    });

    if (stockProblem) {
      await connection.rollback();

      return Response.badRequest(
        "One or more in-stock items no longer have enough quantity",
      );
    }

    let inStockDelivery;
    let preorderDelivery;

    if (inStockItems.length > 0) {
      const deliveryResult = await resolveDeliveryDetails(
        checkoutData?.inStockDelivery,
        "in_stock",
      );

      if (deliveryResult.error) {
        await connection.rollback();

        return Response.badRequest(deliveryResult.error);
      }

      inStockDelivery = deliveryResult.data;
    }

    if (preorderItems.length > 0) {
      const deliveryResult = await resolveDeliveryDetails(
        checkoutData?.preorderDelivery,
        "preorder",
      );

      if (deliveryResult.error) {
        await connection.rollback();

        return Response.badRequest(deliveryResult.error);
      }

      preorderDelivery = deliveryResult.data;
    }

    const createdOrders = [];

    if (inStockItems.length > 0) {
      const order = await createOrderWithItems({
        connection,
        userId,
        recipientName,
        recipientPhone,
        fulfillmentType: "in_stock",
        items: inStockItems,
        delivery: inStockDelivery,
      });

      createdOrders.push(order);
    }

    if (preorderItems.length > 0) {
      const order = await createOrderWithItems({
        connection,
        userId,
        recipientName,
        recipientPhone,
        fulfillmentType: "preorder",
        items: preorderItems,
        delivery: preorderDelivery,
      });

      createdOrders.push(order);
    }

    await orderRepository.deleteCartItemsByCartId(connection, cart.id);
    await orderRepository.markCartCheckedOut(connection, cart.id);

    await connection.commit();

    return Response.created(
      { orders: createdOrders },
      "Checkout completed successfully",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("checkoutMyCart service error:", error.message);

    if (error.message === "IN_STOCK_QUANTITY_CHANGED") {
      return Response.badRequest(
        "In-stock quantity changed during checkout. Please review your cart.",
      );
    }

    return Response.internalServerError("Unable to complete checkout");
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
