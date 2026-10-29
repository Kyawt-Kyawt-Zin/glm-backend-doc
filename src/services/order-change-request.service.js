import * as Response from "../config/response.helper.js";
import * as changeRequestRepository from "../repositories/order-change-request.repository.js";

const allowedRequestTypes = ["change_variant", "cancel_order"];
const changeableOrderStatuses = ["pending", "confirmed"];

const buildReviewNote = (
  requestType,
  status,
  staffComment,
  depositForfeitAcknowledged = false,
) => {
  let automaticMessage;

  if (status === "approved" && requestType === "cancel_order") {
    automaticMessage = depositForfeitAcknowledged
      ? "Cancellation approved. The order has been cancelled and the preorder deposit is non-refundable."
      : "Cancellation approved. The order has been cancelled. Any confirmed deposit is pending refund.";
  } else if (status === "approved" && requestType === "change_variant") {
    automaticMessage =
      "Variant change approved. The order item has been updated.";
  } else if (requestType === "cancel_order") {
    automaticMessage = "Cancellation request rejected.";
  } else {
    automaticMessage = "Variant change request rejected.";
  }

  return staffComment
    ? `${automaticMessage} Staff comment: ${staffComment}`
    : automaticMessage;
};

export const createMyOrderChangeRequest = async (userId, body) => {
  try {
    const {
      orderId,
      orderItemId,
      requestType,
      requestedVariantId,
      customerNote,
      acceptDepositForfeit,
    } = body;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return Response.badRequest("A valid order ID is required");
    }

    if (!allowedRequestTypes.includes(requestType)) {
      return Response.badRequest(
        "Request type must be change_variant or cancel_order",
      );
    }

    const order = await changeRequestRepository.findOrderByIdAndUserId(
      orderId,
      userId,
    );

    if (!order) {
      return Response.notFound("Order not found");
    }

    if (!changeableOrderStatuses.includes(order.status)) {
      return Response.badRequest(
        "Changes or cancellations can only be requested while the order is pending or confirmed",
      );
    }

    if (requestType === "cancel_order") {
      const cancellationDeadline = order.cancellation_deadline
        ? new Date(order.cancellation_deadline)
        : null;

      const isLatePreorderCancellation =
        order.fulfillment_type === "preorder" &&
        cancellationDeadline &&
        new Date() > cancellationDeadline;

      if (isLatePreorderCancellation && acceptDepositForfeit !== true) {
        return Response.badRequest(
          "The seven-day cancellation period has ended. You must accept that the deposit is non-refundable.",
        );
      }
      const existingRequest = await changeRequestRepository.findPendingRequest(
        orderId,
        userId,
        requestType,
        null,
      );

      if (existingRequest) {
        return Response.conflict(
          "A pending cancellation request already exists for this order",
        );
      }

      const requestId = await changeRequestRepository.create({
        orderId,
        userId,
        orderItemId: null,
        requestType,
        requestedVariantId: null,
        customerNote: customerNote?.trim() || null,
        depositForfeitAcknowledged: Boolean(isLatePreorderCancellation),
      });

      return Response.created(
        { id: requestId },
        "Order cancellation request submitted successfully",
      );
    }

    if (!Number.isInteger(orderItemId) || orderItemId <= 0) {
      return Response.badRequest(
        "A valid order item ID is required for a variant change request",
      );
    }

    if (!Number.isInteger(requestedVariantId) || requestedVariantId <= 0) {
      return Response.badRequest(
        "A valid requested variant ID is required for a variant change request",
      );
    }

    const orderItem = await changeRequestRepository.findOrderItemByIdAndOrderId(
      orderItemId,
      orderId,
    );

    if (!orderItem) {
      return Response.notFound("Order item not found in this order");
    }

    const requestedVariant =
      await changeRequestRepository.findActiveVariantById(requestedVariantId);

    if (
      !requestedVariant ||
      !requestedVariant.is_active ||
      !requestedVariant.product_is_active
    ) {
      return Response.notFound("Requested product variant is not available");
    }

    if (requestedVariant.product_id !== orderItem.product_id) {
      return Response.badRequest(
        "The requested variant must belong to the same product",
      );
    }

    if (requestedVariant.id === orderItem.product_variant_id) {
      return Response.badRequest(
        "Please choose a different size or color from the current variant",
      );
    }

    const existingRequest = await changeRequestRepository.findPendingRequest(
      orderId,
      userId,
      requestType,
      orderItemId,
    );

    if (existingRequest) {
      return Response.conflict(
        "A pending change request already exists for this order item",
      );
    }

    const requestId = await changeRequestRepository.create({
      orderId,
      userId,
      orderItemId,
      requestType,
      requestedVariantId,
      customerNote: customerNote?.trim() || null,
      depositForfeitAcknowledged: false,
    });

    return Response.created(
      { id: requestId },
      "Order variant change request submitted successfully",
    );
  } catch (error) {
    console.error("createMyOrderChangeRequest service error:", error.message);

    return Response.internalServerError(
      "Unable to submit the order change request",
    );
  }
};

export const getMyOrderChangeRequests = async (userId) => {
  try {
    const requests = await changeRequestRepository.findAllByUserId(userId);

    return Response.success(
      requests,
      "Order change requests fetched successfully",
    );
  } catch (error) {
    console.error("getMyOrderChangeRequests service error:", error.message);

    return Response.internalServerError(
      "Unable to fetch order change requests",
    );
  }
};

export const getOrderChangeRequestsForManagement = async () => {
  try {
    const requests = await changeRequestRepository.findAllForManagement();

    return Response.success(
      requests,
      "Order change requests fetched successfully",
    );
  } catch (error) {
    console.error(
      "getOrderChangeRequestsForManagement service error:",
      error.message,
    );

    return Response.internalServerError(
      "Unable to fetch order change requests",
    );
  }
};

export const reviewOrderChangeRequest = async (
  staffUserId,
  requestId,
  body,
) => {
  const { status, staffComment } = body;
  const normalizedStaffComment =
    typeof staffComment === "string" ? staffComment.trim() : "";
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return Response.badRequest("A valid request ID is required");
  }

  if (!["approved", "rejected"].includes(status)) {
    return Response.badRequest("Review status must be approved or rejected");
  }

  if (status === "rejected" && !normalizedStaffComment) {
    return Response.badRequest(
      "A staff note is required when rejecting a request",
    );
  }

  let connection;

  try {
    connection = await changeRequestRepository.getConnection();
    await connection.beginTransaction();

    const request = await changeRequestRepository.findByIdForReview(
      connection,
      requestId,
    );

    if (!request) {
      await connection.rollback();
      return Response.notFound("Order change request not found");
    }

    if (request.status !== "pending") {
      await connection.rollback();
      return Response.conflict(
        "Only pending order change requests can be reviewed",
      );
    }

    if (
      status === "approved" &&
      !["pending", "confirmed"].includes(request.order_status)
    ) {
      await connection.rollback();
      return Response.badRequest(
        "This request can no longer be approved because the order is already being processed",
      );
    }

    if (status === "approved" && request.request_type === "cancel_order") {
      const orderItems = await changeRequestRepository.findOrderItemsForReview(
        connection,
        request.order_id,
      );

      if (request.fulfillment_type === "in_stock") {
        for (const item of orderItems) {
          await changeRequestRepository.increaseVariantStock(
            connection,
            item.product_variant_id,
            item.quantity,
          );
        }
      }

      const hasDepositToResolve = [
        "deposit_submitted",
        "deposit_confirmed",
        "paid",
      ].includes(request.payment_status);

      const depositWasForfeited = Boolean(request.deposit_forfeit_acknowledged);

      const nextPaymentStatus = hasDepositToResolve
        ? depositWasForfeited
          ? "deposit_forfeited"
          : "refund_pending"
        : "unpaid";

      await changeRequestRepository.cancelOrder(
        connection,
        request.order_id,
        nextPaymentStatus,
      );
    }

    if (status === "approved" && request.request_type === "change_variant") {
      const orderItem =
        await changeRequestRepository.findOrderItemByIdForReview(
          connection,
          request.order_item_id,
          request.order_id,
        );

      if (!orderItem) {
        await connection.rollback();
        return Response.notFound("The requested order item was not found");
      }

      const requestedVariant =
        await changeRequestRepository.findVariantByIdForReview(
          connection,
          request.requested_variant_id,
        );

      if (
        !requestedVariant ||
        !requestedVariant.variant_is_active ||
        !requestedVariant.product_is_active
      ) {
        await connection.rollback();
        return Response.badRequest(
          "The requested product variant is no longer available",
        );
      }

      if (requestedVariant.product_id !== orderItem.product_id) {
        await connection.rollback();
        return Response.badRequest(
          "The requested variant must belong to the same product",
        );
      }

      if (requestedVariant.fulfillment_type !== request.fulfillment_type) {
        await connection.rollback();
        return Response.badRequest(
          "The requested variant must have the same fulfillment type",
        );
      }

      if (Number(requestedVariant.price) !== Number(orderItem.unit_price)) {
        await connection.rollback();
        return Response.badRequest(
          "The requested variant must have the same price",
        );
      }

      if (request.fulfillment_type === "in_stock") {
        const stockReduced = await changeRequestRepository.decreaseVariantStock(
          connection,
          requestedVariant.id,
          orderItem.quantity,
        );

        if (!stockReduced) {
          await connection.rollback();
          return Response.badRequest(
            "The requested variant no longer has enough stock",
          );
        }

        await changeRequestRepository.increaseVariantStock(
          connection,
          orderItem.product_variant_id,
          orderItem.quantity,
        );
      }

      await changeRequestRepository.updateOrderItemVariant({
        connection,
        orderItemId: orderItem.id,
        variant: requestedVariant,
      });
    }

    const generatedStaffNote = buildReviewNote(
      request.request_type,
      status,
      normalizedStaffComment,
      Boolean(request.deposit_forfeit_acknowledged),
    );

    await changeRequestRepository.reviewWithinTransaction({
      connection,
      requestId,
      status,
      staffNote: generatedStaffNote,
      reviewedBy: staffUserId,
    });

    await connection.commit();

    const message =
      status === "rejected"
        ? "Order change request rejected successfully"
        : "Order change request approved and applied successfully";

    return Response.success({ id: requestId, status }, message);
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("reviewOrderChangeRequest service error:", error.message);

    return Response.internalServerError(
      "Unable to review the order change request",
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
