import { randomUUID } from "node:crypto";
import * as Response from "../config/response.helper.js";
import { mediaConfig } from "../config/media.config.js";
import * as paymentRepository from "../repositories/payment.repository.js";
import {
  createStagedUpload,
  inspectStagedUpload,
  validateStagedUploadVersion,
  createFinalObjectKey,
  promoteStagedUpload,
  listFinalPaymentProofVersions,
  deleteFinalPaymentProofVersion,
} from "./s3-media.service.js";

const isValidId = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0;

export const createCustomerProofUpload = async ({
  userId,
  paymentId,
  contentType,
}) => {
  const numericUserId = Number(userId);
  const numericPaymentId = Number(paymentId);

  if (!isValidId(userId) || !isValidId(paymentId)) {
    return Response.badRequest("A valid payment ID is required");
  }

  if (!mediaConfig.allowedMimeTypes.includes(contentType)) {
    return Response.badRequest("Only JPG, PNG, and WebP images are allowed");
  }

  let connection;

  try {
    connection = await paymentRepository.getConnection();
    await connection.beginTransaction();

    const payment = await paymentRepository.findCustomerDepositByIdForUpdate(
      connection,
      numericPaymentId,
      numericUserId,
    );

    if (!payment) {
      await connection.rollback();
      return Response.notFound("Deposit payment not found");
    }

    if (
      payment.payment_type !== "deposit" ||
      payment.fulfillment_type !== "preorder" ||
      payment.order_status === "cancelled"
    ) {
      await connection.rollback();
      return Response.badRequest("This order cannot receive a deposit proof");
    }

    if (payment.payment_record_status !== "pending") {
      await connection.rollback();
      return Response.conflict(
        "This deposit is already submitted or has been reviewed",
      );
    }

    const uploadId = randomUUID();

    const finalKey = createFinalObjectKey({
      mediaKind: "paymentProof",
      contentType,
      uploadId,
    });

    const upload = await createStagedUpload({
      mediaKind: "paymentProof",
      contentType,
    });

    await paymentRepository.createPaymentProofUpload({
      connection,
      id: uploadId,
      customerId: numericUserId,
      paymentId: numericPaymentId,
      stagingKey: upload.key,
      finalKey,
      contentType,
      expiresInSeconds: upload.expiresIn,
    });

    await connection.commit();

    return Response.success(
      {
        uploadId,
        uploadUrl: upload.uploadUrl,
        fields: upload.fields,
        expiresIn: upload.expiresIn,
      },
      "Payment proof upload prepared",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("createCustomerProofUpload service error:", error.message);
    return Response.internalServerError(
      "Unable to prepare payment proof upload",
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const completeCustomerProofUpload = async ({
  userId,
  paymentId,
  uploadId,
  transactionReference,
}) => {
  const numericUserId = Number(userId);
  const numericPaymentId = Number(paymentId);
  const cleanReference =
    typeof transactionReference === "string" ? transactionReference.trim() : "";

  if (!isValidId(userId) || !isValidId(paymentId)) {
    return Response.badRequest("A valid payment ID is required");
  }

  if (
    typeof uploadId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      uploadId,
    )
  ) {
    return Response.badRequest("A valid upload ID is required");
  }

  if (!cleanReference || cleanReference.length > 100) {
    return Response.badRequest(
      "A transaction reference of up to 100 characters is required",
    );
  }

  let connection;

  try {
    connection = await paymentRepository.getConnection();
    await connection.beginTransaction();

    // Lock the payment first, using the same ownership check as local uploads.
    const payment = await paymentRepository.findCustomerDepositByIdForUpdate(
      connection,
      numericPaymentId,
      numericUserId,
    );

    if (!payment) {
      await connection.rollback();
      return Response.notFound("Deposit payment not found");
    }

    const upload = await paymentRepository.findPaymentProofUploadForUpdate({
      connection,
      id: uploadId,
      customerId: numericUserId,
      paymentId: numericPaymentId,
    });

    if (!upload) {
      await connection.rollback();
      return Response.notFound("Payment proof upload not found");
    }

    // A retry after a successful commit should not submit the payment twice.
    if (upload.status === "completed") {
      const alreadySubmitted =
        payment.payment_record_status === "submitted" &&
        payment.payment_proof_driver === "s3" &&
        payment.payment_proof_storage_key === upload.final_key;

      await connection.rollback();

      if (!alreadySubmitted) {
        return Response.conflict("The upload record needs staff review");
      }

      return Response.success(
        { payment_id: numericPaymentId },
        "Deposit proof was already submitted",
      );
    }

    if (upload.status !== "pending" || !Number(upload.is_unexpired)) {
      await connection.rollback();
      return Response.conflict("This upload has expired or is unavailable");
    }

    const expectedFinalKey = createFinalObjectKey({
      mediaKind: "paymentProof",
      contentType: upload.content_type,
      uploadId: upload.id,
    });

    if (upload.final_key !== expectedFinalKey) {
      throw new Error("Payment proof upload has an unexpected final key");
    }

    if (
      payment.payment_type !== "deposit" ||
      payment.fulfillment_type !== "preorder" ||
      payment.order_status === "cancelled" ||
      payment.payment_record_status !== "pending"
    ) {
      await connection.rollback();
      return Response.conflict("This payment cannot receive a deposit proof");
    }

    const inspected = await inspectStagedUpload({
      mediaKind: "paymentProof",
      key: upload.staging_key,
      contentType: upload.content_type,
    });

    await validateStagedUploadVersion({
      mediaKind: "paymentProof",
      stagingKey: upload.staging_key,
      contentType: upload.content_type,
      versionId: inspected.versionId,
    });

    const finalKey = await promoteStagedUpload({
      mediaKind: "paymentProof",
      stagingKey: upload.staging_key,
      contentType: upload.content_type,
      versionId: inspected.versionId,
      uploadId: upload.id,
    });

    const updatedRows = await paymentRepository.markPaymentProofUploadCompleted(
      {
        connection,
        id: upload.id,
        customerId: numericUserId,
        paymentId: numericPaymentId,
        stagingVersionId: inspected.versionId,
        finalKey,
      },
    );

    if (updatedRows !== 1) {
      throw new Error("Payment proof upload could not be completed");
    }

    await paymentRepository.submitDepositProof({
      connection,
      paymentId: numericPaymentId,
      transactionReference: cleanReference,
      paymentProofPath: null,
      paymentProofDriver: "s3",
      paymentProofStorageKey: finalKey,
    });

    await connection.commit();

    return Response.success(
      {
        payment_id: numericPaymentId,
        order_id: payment.order_id,
        order_number: payment.order_number,
        amount: Number(payment.amount),
        payment_record_status: "submitted",
      },
      "Deposit proof submitted for staff review",
    );
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("completeCustomerProofUpload service error:", error.message);
    return Response.internalServerError("Unable to submit deposit proof");
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

export const cleanExpiredProofUpload = async ({
  uploadId,
  customerId,
  paymentId,
}) => {
  let connection;

  try {
    connection = await paymentRepository.getConnection();
    await connection.beginTransaction();

    // Use the same lock order as upload completion: payment, then upload.
    const payment = await paymentRepository.findCustomerDepositByIdForUpdate(
      connection,
      paymentId,
      customerId,
    );

    if (!payment) {
      await connection.rollback();
      return Response.notFound("Payment not found; cleanup requires review");
    }

    const upload = await paymentRepository.findPaymentProofUploadForUpdate({
      connection,
      id: uploadId,
      customerId,
      paymentId,
    });

    if (!upload || upload.status !== "pending" || Number(upload.is_unexpired)) {
      await connection.rollback();
      return Response.conflict("Upload is not eligible for cleanup");
    }

    const expectedFinalKey = createFinalObjectKey({
      mediaKind: "paymentProof",
      contentType: upload.content_type,
      uploadId: upload.id,
    });

    if (upload.final_key !== expectedFinalKey) {
      throw new Error("Unexpected final key; cleanup requires review");
    }

    const paymentUsingKey =
      await paymentRepository.findPaymentUsingProofStorageKeyForUpdate(
        connection,
        expectedFinalKey,
      );

    if (paymentUsingKey) {
      await connection.rollback();
      return Response.conflict("A payment uses this receipt; cleanup stopped");
    }

    const { items } = await listFinalPaymentProofVersions({
      uploadId: upload.id,
      contentType: upload.content_type,
    });

    // Limit work per call. A later call can continue if versions remain.
    const batch = items.slice(0, 50);

    for (const item of batch) {
      await deleteFinalPaymentProofVersion({
        uploadId: upload.id,
        contentType: upload.content_type,
        versionId: item.versionId,
      });
    }

    if (items.length > batch.length) {
      await connection.commit();

      return Response.success(
        { remaining: items.length - batch.length },
        "Cleanup partially completed",
      );
    }

    const updatedRows = await paymentRepository.markPaymentProofUploadCleaned({
      connection,
      id: upload.id,
      customerId,
      paymentId,
    });

    if (updatedRows !== 1) {
      throw new Error("Upload cleanup status could not be saved");
    }

    await connection.commit();

    return Response.success({ remaining: 0 }, "Expired upload cleaned");
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("cleanExpiredProofUpload service error:", error.message);
    return Response.internalServerError("Unable to clean expired upload");
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
