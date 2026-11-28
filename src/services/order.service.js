import { randomUUID } from "node:crypto";
import * as Response from "../config/response.helper.js";
import * as orderRepository from "../repositories/order.repository.js";
import * as paymentRepository from "../repositories/payment.repository.js";
import * as deliveryZoneRepository from "../repositories/delivery-zone.repository.js";
import { mediaConfig } from "../config/media.config.js";
import { createStagedUpload, inspectStagedUpload, validateStagedUploadVersion, promoteStagedUpload } from "./s3-media.service.js";
import { pickupWindow, validatePickupSelection } from "./pickup-scheduling.js";
import { enqueueOrderEmail, tryEmailJob } from "./email-queue.service.js";

const PREORDER_DEPOSIT_PERCENTAGE = 20;
const PREORDER_TERMS_VERSION = "v1";
const PREORDER_CANCELLATION_WINDOW_DAYS = 7;

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
    return {
      data: {
        deliveryMethod,
        deliveryZoneId: null,
        deliveryZoneName: null,
        deliveryAddress: null,
        pickupTimeSlot: null,
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
    preorderTermsAcceptedAt: isPreorder ? new Date() : null,
    preorderTermsVersion: isPreorder ? PREORDER_TERMS_VERSION : null,
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

  let depositPaymentId = null;
  if (isPreorder) {
    depositPaymentId = await orderRepository.createPayment(connection, {
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
    deposit_payment_id: depositPaymentId,
    estimated_ready_date: estimatedReadyDate,
  };
};

const isDraftId = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const draftJson = (data) => typeof data === "string" ? JSON.parse(data) : data;
const draftSummary = (draft) => {
  const items = draftJson(draft.items_snapshot);
  const details = draftJson(draft.checkout_data);
  return {
    id: draft.id,
    deposit_amount: Number(draft.deposit_amount),
    total_amount: roundMoney(items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0) + Number(details.delivery.deliveryFee)),
    delivery_method: details.delivery.deliveryMethod,
    delivery_address: details.delivery.deliveryAddress,
    recipient_name: details.recipientName,
    status: draft.status,
    items: items.map(({ product_name, color, size, quantity, price }) => ({ product_name, color, size, quantity, price })),
  };
};

export const getPendingPreorderDraft = async (userId) => {
  let connection;
  try {
    connection = await orderRepository.getCheckoutConnection();
    const [rows] = await connection.execute("SELECT * FROM preorder_checkout_drafts WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [userId]);
    return Response.success(rows.length ? draftSummary(rows[0]) : null);
  } catch (error) { console.error("getPendingPreorderDraft:", error.message); return Response.internalServerError("Unable to load your preorder checkout"); }
  finally { connection?.release(); }
};

export const getPreorderDraftStatus = async (userId, draftId) => {
  if (!isDraftId(draftId)) return Response.badRequest("A valid checkout is required");
  let connection;
  try {
    connection = await orderRepository.getCheckoutConnection();
    const [rows] = await connection.execute("SELECT * FROM preorder_checkout_drafts WHERE id = ? AND user_id = ?", [draftId, userId]);
    if (!rows.length) return Response.notFound("Checkout not found");
    if (rows[0].status !== "completed") return Response.success({ status: rows[0].status });
    const [orders] = await connection.execute("SELECT orders.id, orders.order_number, orders.fulfillment_type, orders.total_amount, orders.deposit_amount, payments.id AS deposit_payment_id FROM orders JOIN payments ON payments.order_id = orders.id AND payments.payment_type = 'deposit' WHERE orders.id = ? AND orders.user_id = ?", [rows[0].order_id, userId]);
    return orders.length ? Response.success({ status: "completed", orders }) : Response.conflict("Please contact the shop about this checkout");
  } catch (error) { console.error("getPreorderDraftStatus:", error.message); return Response.internalServerError("Unable to check checkout status"); }
  finally { connection?.release(); }
};

export const cancelPreorderDraft = async (userId, draftId, acknowledgedNoTransfer) => {
  if (!isDraftId(draftId) || acknowledgedNoTransfer !== true) {
    return Response.badRequest("Confirm that no deposit has been transferred");
  }
  let connection;
  try {
    connection = await orderRepository.getCheckoutConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT id, status, staging_key FROM preorder_checkout_drafts WHERE id = ? AND user_id = ? FOR UPDATE", [draftId, userId]);
    const draft = rows[0];
    if (!draft) { await connection.rollback(); return Response.notFound("Checkout not found"); }
    if (draft.status !== "pending") {
      await connection.rollback();
      return Response.conflict("This checkout cannot be cancelled online. Please contact the shop.");
    }
    await connection.execute("UPDATE preorder_checkout_drafts SET status = 'cancelled', active_cart_id = NULL, active_user_id = NULL WHERE id = ? AND user_id = ?", [draftId, userId]);
    await connection.commit();
    return Response.success(null, "Preorder checkout cancelled; your cart is unchanged");
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("cancelPreorderDraft:", error.message);
    return Response.internalServerError("Unable to cancel this checkout");
  } finally { connection?.release(); }
};

export const preparePreorderCheckout = async (userId, data) => {
  const recipientName = String(data?.recipientName || "").trim();
  const recipientPhone = String(data?.recipientPhone || "").trim();
  if (!recipientName || !recipientPhone || data?.preorderTermsAccepted !== true) return Response.badRequest("Recipient details and preorder terms are required");
  let connection;
  try {
    connection = await orderRepository.getCheckoutConnection();
    await connection.beginTransaction();
    const [users] = await connection.execute("SELECT is_active FROM users WHERE id = ? FOR UPDATE", [userId]);
    if (!users.length || !Number(users[0].is_active)) { await connection.rollback(); return Response.unauthorized(); }
    const cart = await orderRepository.findActiveCartForCheckout(connection, userId);
    if (!cart) { await connection.rollback(); return Response.badRequest("Your cart is empty"); }
    const [existing] = await connection.execute("SELECT * FROM preorder_checkout_drafts WHERE active_user_id = ? AND user_id = ? FOR UPDATE", [userId, userId]);
    if (existing.length) { await connection.rollback(); return Response.success(draftSummary(existing[0]), "Existing preorder checkout"); }
    const items = (await orderRepository.getCartItemsForCheckout(connection, cart.id)).filter((item) => item.fulfillment_type === "preorder");
    if (!items.length || items.some((item) => !Number(item.variant_is_active) || !Number(item.product_is_active) || !Number(item.category_is_active))) { await connection.rollback(); return Response.badRequest("Preorder items are missing or no longer available"); }
    const delivery = await resolveDeliveryDetails(data.preorderDelivery, "preorder");
    if (delivery.error) { await connection.rollback(); return Response.badRequest(delivery.error); }
    const deposit = roundMoney(items.reduce((total, item) => total + Number(item.price) * Number(item.quantity), 0) * PREORDER_DEPOSIT_PERCENTAGE / 100);
    const draft = { id: randomUUID(), user_id: userId, active_cart_id: cart.id, checkout_data: JSON.stringify({ recipientName, recipientPhone, delivery: delivery.data, cartId: cart.id }), items_snapshot: JSON.stringify(items), deposit_amount: deposit, status: "pending" };
    await connection.execute("INSERT INTO preorder_checkout_drafts (id, user_id, active_user_id, active_cart_id, checkout_data, items_snapshot, deposit_amount) VALUES (?, ?, ?, ?, ?, ?, ?)", [draft.id, userId, userId, cart.id, draft.checkout_data, draft.items_snapshot, deposit]);
    await connection.commit();
    return Response.created(draftSummary(draft));
  } catch (error) { if (connection) await connection.rollback().catch(() => {}); console.error("preparePreorderCheckout:", error.message); return Response.internalServerError("Unable to prepare preorder checkout"); }
  finally { connection?.release(); }
};

export const preparePreorderReceiptUpload = async (userId, draftId, contentType) => {
  if (!isDraftId(draftId) || !mediaConfig.allowedMimeTypes.includes(contentType)) return Response.badRequest("A valid checkout and image type are required");
  let connection;
  try {
    connection = await orderRepository.getCheckoutConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT * FROM preorder_checkout_drafts WHERE id = ? AND user_id = ? FOR UPDATE", [draftId, userId]);
    if (!rows.length || rows[0].status !== "pending") { await connection.rollback(); return Response.conflict("This checkout is unavailable"); }
    const upload = await createStagedUpload({ mediaKind: "paymentProof", contentType });
    await connection.execute("UPDATE preorder_checkout_drafts SET staging_key = ?, content_type = ? WHERE id = ? AND user_id = ?", [upload.key, contentType, draftId, userId]);
    await connection.commit();
    return Response.success({ uploadUrl: upload.uploadUrl, fields: upload.fields, expiresIn: upload.expiresIn });
  } catch (error) { if (connection) await connection.rollback().catch(() => {}); console.error("preparePreorderReceiptUpload:", error.message); return Response.internalServerError("Unable to prepare receipt upload"); }
  finally { connection?.release(); }
};

export const completePreorderCheckout = async (userId, draftId, transactionReference) => {
  const reference = typeof transactionReference === "string" ? transactionReference.trim() : "";
  if (!isDraftId(draftId) || !reference || reference.length > 100) return Response.badRequest("A valid checkout and transaction reference are required");
  let connection;
  try {
    connection = await orderRepository.getCheckoutConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT * FROM preorder_checkout_drafts WHERE id = ? AND user_id = ? FOR UPDATE", [draftId, userId]);
    const draft = rows[0];
    if (!draft) { await connection.rollback(); return Response.notFound("Checkout not found"); }
    if (draft.status === "completed") {
      const [orders] = await connection.execute("SELECT orders.id, orders.order_number, orders.fulfillment_type, orders.total_amount, orders.deposit_amount, payments.id AS deposit_payment_id FROM orders JOIN payments ON payments.order_id = orders.id AND payments.payment_type = 'deposit' WHERE orders.id = ? AND orders.user_id = ?", [draft.order_id, userId]);
      await connection.rollback();
      return orders.length ? Response.success({ orders }, "Order already placed") : Response.conflict("Please contact the shop about this checkout");
    }
    if (draft.status !== "pending" || !draft.staging_key || !draft.content_type) { await connection.rollback(); return Response.badRequest("Upload your receipt first"); }
    const [users] = await connection.execute("SELECT is_active FROM users WHERE id = ? FOR UPDATE", [userId]);
    if (!users.length || !Number(users[0].is_active)) { await connection.rollback(); return Response.unauthorized(); }
    const inspected = await inspectStagedUpload({ mediaKind: "paymentProof", key: draft.staging_key, contentType: draft.content_type });
    await validateStagedUploadVersion({ mediaKind: "paymentProof", stagingKey: draft.staging_key, contentType: draft.content_type, versionId: inspected.versionId });
    const finalKey = await promoteStagedUpload({ mediaKind: "paymentProof", stagingKey: draft.staging_key, contentType: draft.content_type, versionId: inspected.versionId, uploadId: draft.id });
    const details = draftJson(draft.checkout_data);
    const items = draftJson(draft.items_snapshot);
    const order = await createOrderWithItems({ connection, userId, recipientName: details.recipientName, recipientPhone: details.recipientPhone, fulfillmentType: "preorder", items, delivery: details.delivery });
    if (roundMoney(order.deposit_amount) !== roundMoney(draft.deposit_amount)) throw new Error("Draft deposit amount mismatch");
    await paymentRepository.submitDepositProof({ connection, paymentId: order.deposit_payment_id, transactionReference: reference, paymentProofPath: null, paymentProofDriver: "s3", paymentProofStorageKey: finalKey });
    for (const item of items) {
      // Remove only purchased units if the quantity changed in another tab.
      await connection.execute("DELETE FROM cart_items WHERE cart_id = ? AND id = ? AND quantity <= ?", [details.cartId, item.cart_item_id, item.quantity]);
      await connection.execute("UPDATE cart_items SET quantity = quantity - ? WHERE cart_id = ? AND id = ? AND quantity > ?", [item.quantity, details.cartId, item.cart_item_id, item.quantity]);
    }
    // Keep the cart active even when it is empty: another tab may add an item
    // while this receipt is being processed.
    await connection.execute("UPDATE preorder_checkout_drafts SET status = 'completed', active_cart_id = NULL, active_user_id = NULL, order_id = ? WHERE id = ? AND user_id = ?", [order.id, draftId, userId]);
    await connection.commit();
    return Response.created({ orders: [order] }, "Order placed and receipt submitted");
  } catch (error) { if (connection) await connection.rollback().catch(() => {}); console.error("completePreorderCheckout:", error.message); return Response.internalServerError("Unable to submit the receipt. Retry or contact the shop if you have already paid."); }
  finally { connection?.release(); }
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

    const [accountRows] = await connection.execute("SELECT is_active FROM users WHERE id = ? FOR UPDATE", [userId]);
    if (!accountRows.length || !accountRows[0].is_active) {
      await connection.rollback();
      return Response.unauthorized("Account is inactive or unavailable");
    }

    const cart = await orderRepository.findActiveCartForCheckout(
      connection,
      userId,
    );

    if (!cart) {
      await connection.rollback();

      return Response.badRequest("Your cart is empty");
    }

    const allCartItems = await orderRepository.getCartItemsForCheckout(
      connection,
      cart.id,
    );

    // An explicit in-stock checkout leaves preorder items in the active cart.
    // The existing checkout remains unchanged until receipt-first checkout is ready.
    const cartItems = checkoutData?.fulfillmentType === "in_stock"
      ? allCartItems.filter((item) => item.fulfillment_type === "in_stock")
      : allCartItems;

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

    if (preorderItems.length > 0) {
      await connection.rollback();
      return Response.badRequest("Preorder checkout requires a deposit receipt. Refresh the page and try again.");
    }

    if (
      preorderItems.length > 0 &&
      checkoutData?.preorderTermsAccepted !== true
    ) {
      await connection.rollback();

      return Response.badRequest(
        "You must accept the preorder terms before checkout",
      );
    }

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

    if (checkoutData?.fulfillmentType === "in_stock") {
      await orderRepository.deleteCartItemsByIds(connection, cart.id, cartItems.map((item) => item.cart_item_id));
      // Keep this cart active so items added in another tab are not stranded.
    } else {
      await orderRepository.deleteCartItemsByCartId(connection, cart.id);
      await orderRepository.markCartCheckedOut(connection, cart.id);
    }

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

const formatOrderAmounts = (order) => {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    delivery_fee: Number(order.delivery_fee),
    total_amount: Number(order.total_amount),
    deposit_percentage: Number(order.deposit_percentage),
    deposit_amount: Number(order.deposit_amount),
  };
};

export const getMyOrders = async (userId) => {
  try {
    const orders = await orderRepository.findAllByUserId(userId);

    return Response.success(
      orders.map((order) => {
        return {
          ...order,
          total_amount: Number(order.total_amount),
          deposit_amount: Number(order.deposit_amount),
          total_item_quantity: Number(order.total_item_quantity),
        };
      }),
      "Orders fetched successfully",
    );
  } catch (error) {
    console.error("getMyOrders service error:", error.message);

    return Response.internalServerError("Unable to fetch orders");
  }
};

export const getMyOrderById = async (userId, orderId) => {
  const numericOrderId = Number(orderId);

  if (!isPositiveInteger(numericOrderId)) {
    return Response.badRequest("Order ID must be a positive whole number");
  }

  try {
    const order = await orderRepository.findByIdAndUserId(
      numericOrderId,
      userId,
    );

    if (!order) {
      return Response.notFound("Order not found");
    }

    const [items, payments] = await Promise.all([
      orderRepository.findItemsByOrderId(numericOrderId),
      orderRepository.findPaymentsByOrderId(numericOrderId),
    ]);

    return Response.success(
      {
        order: {
          ...formatOrderAmounts(order),
          pickup_window: order.delivery_method === "pickup"
            ? pickupWindow(order.fulfillment_type === "preorder" ? order.pickup_ready_ms : order.pickup_confirmed_ms)
            : null,
        },
        items: items.map((item) => {
          return {
            ...item,
            unit_price: Number(item.unit_price),
            line_total: Number(item.line_total),
            deposit_percentage: Number(item.deposit_percentage),
          };
        }),
        payments: payments.map((payment) => {
          return {
            ...payment,
            amount: Number(payment.amount),
          };
        }),
      },
      "Order fetched successfully",
    );
  } catch (error) {
    console.error("getMyOrderById service error:", error.message);

    return Response.internalServerError("Unable to fetch order");
  }
};

export const scheduleCustomerPickup = async (userId, orderId, { date, time } = {}) => {
  if (!isPositiveInteger(orderId)) return Response.badRequest("A valid order ID is required");
  let connection;
  try {
    connection = await orderRepository.getConnection();
    await connection.beginTransaction();
    const order = await orderRepository.lockCustomerPickupOrder(connection, Number(orderId), userId);
    if (!order) {
      await connection.rollback();
      return Response.notFound("Order not found");
    }
    const allowed = order.delivery_method === "pickup" && (order.fulfillment_type === "preorder"
      ? order.status === "ready_for_pickup"
      : ["confirmed", "processing", "ready_for_pickup"].includes(order.status));
    if (!allowed) {
      await connection.rollback();
      return Response.badRequest("Pickup scheduling is not yet available for this order.");
    }
    const anchor = order.fulfillment_type === "preorder" ? order.pickup_ready_ms : order.pickup_confirmed_ms;
    const error = validatePickupSelection(anchor, date, time);
    if (error) {
      await connection.rollback();
      return Response.badRequest(error);
    }
    const slot = `${date} · ${time} (Dubai time)`;
    await orderRepository.updatePickupSlot(connection, order.id, slot);
    const emailJobId = order.pickup_time_slot !== slot
      ? await enqueueOrderEmail(connection, order.id, "pickup", { pickupTimeSlot: slot, updated: Boolean(order.pickup_time_slot) })
      : null;
    await connection.commit();
    connection.release();
    connection = null;
    tryEmailJob(emailJobId);
    return Response.success({ pickup_time_slot: slot }, "Pickup time saved successfully");
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("scheduleCustomerPickup service error:", error.message);
    return Response.internalServerError("Unable to save pickup time");
  } finally {
    if (connection) connection.release();
  }
};

export const getOrdersForManagement = async () => {
  try {
    const orders = await orderRepository.findAllForManagement();

    return Response.success(
      orders.map((order) => {
        return {
          ...order,
          total_amount: Number(order.total_amount),
          deposit_amount: Number(order.deposit_amount),
        };
      }),
      "Orders fetched successfully",
    );
  } catch (error) {
    console.error("getOrdersForManagement service error:", error.message);

    return Response.internalServerError("Unable to fetch orders");
  }
};

export const getOrderForManagement = async (orderId) => {
  const numericOrderId = Number(orderId);

  if (!isPositiveInteger(numericOrderId)) {
    return Response.badRequest("Order ID must be a positive whole number");
  }

  try {
    const order = await orderRepository.findByIdForManagement(numericOrderId);

    if (!order) {
      return Response.notFound("Order not found");
    }

    const [items, payments, statusHistory, receipts] = await Promise.all([
      orderRepository.findItemsByOrderId(numericOrderId),
      orderRepository.findPaymentsByOrderId(numericOrderId),
      orderRepository.findStatusHistoryByOrderId(numericOrderId),
      orderRepository.findPreorderReceiptsByOrderId(numericOrderId),
    ]);

    return Response.success(
      {
        order: formatOrderAmounts(order),
        items: items.map((item) => {
          return {
            ...item,
            preorder_received_quantity: Number(receipts.find((entry) => entry.id === item.id)?.preorder_received_quantity || 0),
            unit_price: Number(item.unit_price),
            line_total: Number(item.line_total),
            deposit_percentage: Number(item.deposit_percentage),
          };
        }),
        payments: payments.map((payment) => {
          return {
            ...payment,
            amount: Number(payment.amount),
          };
        }),
        statusHistory,
      },
      "Order fetched successfully",
    );
  } catch (error) {
    console.error("getOrderForManagement service error:", error.message);

    return Response.internalServerError("Unable to fetch order");
  }
};

export const updatePreorderReceivedQuantity = async (orderId, itemId, quantity) => {
  const numericOrderId = Number(orderId);
  const numericItemId = Number(itemId);
  const received = Number(quantity);
  if (!isPositiveInteger(numericOrderId) || !isPositiveInteger(numericItemId) ||
      typeof quantity !== "number" || !Number.isInteger(received) || received < 0) {
    return Response.badRequest("A valid order, item, and non-negative whole number are required");
  }
  let connection;
  try {
    connection = await orderRepository.getConnection();
    await connection.beginTransaction();
    const [orders] = await connection.execute("SELECT id, fulfillment_type, status FROM orders WHERE id = ? FOR UPDATE", [numericOrderId]);
    if (!orders.length) { await connection.rollback(); return Response.notFound("Order not found"); }
    const order = orders[0];
    if (order.fulfillment_type !== "preorder" || !["confirmed", "processing", "ready_for_delivery", "ready_for_pickup"].includes(order.status)) {
      await connection.rollback();
      return Response.badRequest("Received quantities can only be updated for active confirmed preorders");
    }
    const [items] = await connection.execute("SELECT id, quantity FROM order_items WHERE id = ? AND order_id = ? FOR UPDATE", [numericItemId, numericOrderId]);
    if (!items.length) { await connection.rollback(); return Response.notFound("Order item not found"); }
    if (received > Number(items[0].quantity)) {
      await connection.rollback();
      return Response.badRequest("Received quantity cannot exceed the quantity ordered");
    }
    await connection.execute("UPDATE order_items SET preorder_received_quantity = ? WHERE id = ? AND order_id = ?", [received, numericItemId, numericOrderId]);
    await connection.commit();
    return Response.success({ order_item_id: numericItemId, preorder_received_quantity: received }, "Received quantity updated");
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("updatePreorderReceivedQuantity service error:", error.message);
    return Response.internalServerError("Unable to update received quantity");
  } finally {
    if (connection) connection.release();
  }
};

const allowedStatusTransitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["ready_for_delivery", "ready_for_pickup", "cancelled"],
  ready_for_delivery: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  ready_for_pickup: ["picked_up", "cancelled"],
  delivered: [],
  picked_up: [],
  cancelled: [],
};

const getWorkflowRank = (status, deliveryMethod) => {
  const statusRanks =
    deliveryMethod === "pickup"
      ? {
          pending: 0,
          confirmed: 1,
          processing: 2,
          ready_for_pickup: 3,
        }
      : {
          pending: 0,
          confirmed: 1,
          processing: 2,
          ready_for_delivery: 3,
          out_for_delivery: 4,
        };

  return statusRanks[status];
};

export const updateOrderStatusForManagement = async (
  orderId,
  { status } = {},
  changedBy,
) => {
  const numericOrderId = Number(orderId);
  const nextStatus = String(status || "").trim();

  if (!isPositiveInteger(numericOrderId) || !nextStatus) {
    return Response.badRequest("Order ID and status are required");
  }

  let connection;

  try {
    connection = await orderRepository.getConnection();
    await connection.beginTransaction();

    const order = await orderRepository.findByIdForManagement(
      numericOrderId,
      connection,
      { forUpdate: true },
    );

    const cancelTransaction = async (response) => {
      await connection.rollback();
      return response;
    };

    if (!order) {
      return cancelTransaction(Response.notFound("Order not found"));
    }

    const allowedNextStatuses = allowedStatusTransitions[order.status] || [];

    if (!allowedNextStatuses.includes(nextStatus)) {
      return cancelTransaction(
        Response.badRequest(
          `Order cannot move from ${order.status} to ${nextStatus}`,
        ),
      );
    }

    if (order.fulfillment_type === "preorder" && nextStatus === "cancelled") {
      const [reserved] = await connection.execute(
        "SELECT id FROM order_items WHERE order_id = ? AND preorder_received_quantity > 0 LIMIT 1",
        [numericOrderId],
      );
      if (reserved.length) {
        return cancelTransaction(Response.badRequest("This preorder has received items reserved for it. Adjust their received quantities before cancelling."));
      }
    }

    if (
      order.fulfillment_type === "preorder" &&
      order.payment_status !== "deposit_confirmed" &&
      nextStatus !== "cancelled"
    ) {
      return cancelTransaction(
        Response.badRequest(
          "Preorder deposit must be confirmed before processing the order",
        ),
      );
    }

    const isPickupOrder = order.delivery_method === "pickup";

    if (
      isPickupOrder &&
      ["ready_for_delivery", "out_for_delivery", "delivered"].includes(
        nextStatus,
      )
    ) {
      return cancelTransaction(
        Response.badRequest("Pickup orders must use pickup status updates"),
      );
    }

    if (
      !isPickupOrder &&
      ["ready_for_pickup", "picked_up"].includes(nextStatus)
    ) {
      return cancelTransaction(
        Response.badRequest("Delivery orders must use delivery status updates"),
      );
    }

    let confirmationDetails = null;

    if (order.fulfillment_type === "preorder" && nextStatus === "confirmed") {
      const confirmedAt = new Date();
      const cancellationDeadline = new Date(
        confirmedAt.getTime() +
          PREORDER_CANCELLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );

      confirmationDetails = {
        confirmedAt,
        cancellationDeadline,
      };
    }

    await orderRepository.updateOrderStatus(
      numericOrderId,
      nextStatus,
      confirmationDetails,
      connection,
    );

    await orderRepository.createOrderStatusHistory(connection, {
      orderId: numericOrderId,
      previousStatus: order.status,
      newStatus: nextStatus,
      changedBy,
    });

    const emailJobId = await enqueueOrderEmail(connection, numericOrderId, "status", { status: nextStatus });
    await connection.commit();

    connection.release();
    connection = null;
    tryEmailJob(emailJobId);

    return Response.success(
      {
        ...formatOrderAmounts(order),
        status: nextStatus,
        ...(confirmationDetails
          ? {
              confirmed_at: confirmationDetails.confirmedAt,
              cancellation_deadline: confirmationDetails.cancellationDeadline,
            }
          : {}),
      },
      "Order status updated successfully",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error(
      "updateOrderStatusForManagement service error:",
      error.message,
    );

    return Response.internalServerError("Unable to update order status");
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const correctOrderStatusForManagement = async (
  orderId,
  { status, reason } = {},
  changedBy,
) => {
  const numericOrderId = Number(orderId);
  const correctedStatus = String(status || "").trim();
  const correctionReason = String(reason || "").trim();

  if (!isPositiveInteger(numericOrderId) || !correctedStatus) {
    return Response.badRequest("Order ID and corrected status are required");
  }

  if (correctionReason.length < 10) {
    return Response.badRequest(
      "A correction reason must contain at least 10 characters",
    );
  }

  let connection;

  try {
    connection = await orderRepository.getConnection();
    await connection.beginTransaction();

    const order = await orderRepository.findByIdForManagement(
      numericOrderId,
      connection,
      { forUpdate: true },
    );

    const cancelTransaction = async (response) => {
      await connection.rollback();
      return response;
    };

    if (!order) {
      return cancelTransaction(Response.notFound("Order not found"));
    }

    if (["delivered", "picked_up", "cancelled"].includes(order.status)) {
      return cancelTransaction(
        Response.badRequest(
          "Delivered, picked-up, and cancelled orders cannot be corrected",
        ),
      );
    }

    const currentRank = getWorkflowRank(order.status, order.delivery_method);

    const correctedRank = getWorkflowRank(
      correctedStatus,
      order.delivery_method,
    );

    if (
      currentRank === undefined ||
      correctedRank === undefined ||
      correctedRank >= currentRank
    ) {
      return cancelTransaction(
        Response.badRequest(
          "An order correction must move the order back to an earlier valid status",
        ),
      );
    }

    if (order.fulfillment_type === "preorder" && correctedStatus === "pending") {
      const [reserved] = await connection.execute(
        "SELECT id FROM order_items WHERE order_id = ? AND preorder_received_quantity > 0 LIMIT 1",
        [numericOrderId],
      );
      if (reserved.length) {
        return cancelTransaction(Response.badRequest("This preorder has received items reserved for it. Adjust their received quantities before moving it back to pending."));
      }
    }

    await orderRepository.correctOrderStatus(
      numericOrderId,
      correctedStatus,
      connection,
    );

    await orderRepository.createOrderStatusHistory(connection, {
      orderId: numericOrderId,
      previousStatus: order.status,
      newStatus: correctedStatus,
      actionType: "correction",
      reason: correctionReason,
      changedBy,
    });

    const emailJobId = await enqueueOrderEmail(connection, numericOrderId, "status", { status: correctedStatus, isCorrection: true });
    await connection.commit();

    connection.release();
    connection = null;
    tryEmailJob(emailJobId);

    return Response.success(
      {
        ...formatOrderAmounts(order),
        status: correctedStatus,
      },
      "Order status corrected successfully",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error(
      "correctOrderStatusForManagement service error:",
      error.message,
    );

    return Response.internalServerError("Unable to correct order status");
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
