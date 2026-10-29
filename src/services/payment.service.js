import * as Response from "../config/response.helper.js";
import * as paymentRepository from "../repositories/payment.repository.js";

const isPositiveInteger = (value) => {
  return Number.isInteger(Number(value)) && Number(value) > 0;
};

export const getPendingDepositPayments = async () => {
  try {
    const payments = await paymentRepository.findPendingDeposits();

    return Response.success(
      payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
      "Pending preorder deposits fetched successfully",
    );
  } catch (error) {
    console.error("getPendingDepositPayments service error:", error.message);

    return Response.internalServerError(
      "Unable to fetch pending preorder deposits",
    );
  }
};

export const confirmPreorderDeposit = async (staffUserId, paymentId, body) => {
  const transactionReference = String(body?.transactionReference || "").trim();

  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

  if (!isPositiveInteger(paymentId)) {
    return Response.badRequest("A valid payment ID is required");
  }

  if (!transactionReference) {
    return Response.badRequest("A bank transaction reference is required");
  }

  let connection;

  try {
    connection = await paymentRepository.getConnection();
    await connection.beginTransaction();

    const payment = await paymentRepository.findDepositByIdForUpdate(
      connection,
      paymentId,
    );

    if (!payment) {
      await connection.rollback();
      return Response.notFound("Deposit payment not found");
    }

    if (payment.payment_type !== "deposit") {
      await connection.rollback();
      return Response.badRequest("This payment is not a preorder deposit");
    }

    if (payment.fulfillment_type !== "preorder") {
      await connection.rollback();
      return Response.badRequest("Only preorder deposits can be confirmed");
    }

    if (payment.order_status === "cancelled") {
      await connection.rollback();
      return Response.badRequest(
        "A deposit cannot be confirmed for a cancelled order",
      );
    }

    if (payment.payment_record_status !== "pending") {
      await connection.rollback();
      return Response.conflict("This deposit has already been reviewed");
    }

    await paymentRepository.confirmDeposit({
      connection,
      paymentId,
      transactionReference,
      notes,
      confirmedBy: staffUserId,
    });

    await paymentRepository.setOrderDepositConfirmed(
      connection,
      payment.order_id,
    );

    await connection.commit();

    return Response.success(
      {
        payment_id: Number(paymentId),
        order_id: payment.order_id,
        amount: Number(payment.amount),
        payment_status: "deposit_confirmed",
      },
      "Preorder deposit confirmed successfully",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("confirmPreorderDeposit service error:", error.message);

    return Response.internalServerError("Unable to confirm preorder deposit");
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const getRefundPendingPayments = async () => {
  try {
    const payments = await paymentRepository.findRefundPendingPayments();

    return Response.success(
      payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
      "Refund-pending deposits fetched successfully",
    );
  } catch (error) {
    console.error("getRefundPendingPayments service error:", error.message);

    return Response.internalServerError(
      "Unable to fetch refund-pending deposits",
    );
  }
};

export const completePreorderDepositRefund = async (
  staffUserId,
  paymentId,
  body,
) => {
  const refundReference = String(body?.refundReference || "").trim();

  const refundNotes =
    typeof body?.refundNotes === "string" ? body.refundNotes.trim() : null;

  if (!isPositiveInteger(paymentId)) {
    return Response.badRequest("A valid payment ID is required");
  }

  if (!refundReference) {
    return Response.badRequest("A refund transfer reference is required");
  }

  let connection;

  try {
    connection = await paymentRepository.getConnection();
    await connection.beginTransaction();

    const payment = await paymentRepository.findRefundablePaymentByIdForUpdate(
      connection,
      paymentId,
    );

    if (!payment) {
      await connection.rollback();
      return Response.notFound("Refundable deposit payment not found");
    }

    if (payment.payment_type !== "deposit") {
      await connection.rollback();
      return Response.badRequest("This payment is not a preorder deposit");
    }

    if (payment.order_status !== "cancelled") {
      await connection.rollback();
      return Response.badRequest(
        "Only cancelled orders can receive a deposit refund",
      );
    }

    if (payment.payment_status !== "refund_pending") {
      await connection.rollback();
      return Response.badRequest("This order does not have a refund pending");
    }

    if (payment.payment_record_status !== "confirmed") {
      await connection.rollback();
      return Response.conflict(
        "This deposit payment is not available for refund",
      );
    }

    await paymentRepository.completeRefund({
      connection,
      paymentId,
      refundAmount: payment.amount,
      refundReference,
      refundNotes,
      refundedBy: staffUserId,
    });

    await paymentRepository.setOrderRefunded(connection, payment.order_id);

    await connection.commit();

    return Response.success(
      {
        payment_id: Number(paymentId),
        order_id: payment.order_id,
        refund_amount: Number(payment.amount),
        payment_status: "refunded",
      },
      "Preorder deposit refund recorded successfully",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error(
      "completePreorderDepositRefund service error:",
      error.message,
    );

    return Response.internalServerError(
      "Unable to record the preorder deposit refund",
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
