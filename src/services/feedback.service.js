import * as Response from "../config/response.helper.js";
import * as feedbackRepository from "../repositories/feedback.repository.js";

const allowedFeedbackTypes = [
  "product_request",
  "product_feedback",
  "general_feedback",
];

const allowedFeedbackStatuses = ["new", "in_review", "resolved", "closed"];

export const createMyFeedback = async (
  userId,
  { feedbackType, subject, message },
) => {
  try {
    const cleanFeedbackType = feedbackType?.trim().toLowerCase();
    const cleanSubject = subject?.trim();
    const cleanMessage = message?.trim();

    if (!allowedFeedbackTypes.includes(cleanFeedbackType)) {
      return Response.badRequest(
        "feedbackType must be product_request, product_feedback, or general_feedback",
      );
    }

    if (!cleanSubject) {
      return Response.badRequest("Subject is required");
    }

    if (!cleanMessage) {
      return Response.badRequest("Message is required");
    }

    const feedbackId = await feedbackRepository.createFeedback({
      userId,
      feedbackType: cleanFeedbackType,
      subject: cleanSubject,
      message: cleanMessage,
    });

    return Response.created(
      {
        id: feedbackId,
        feedback_type: cleanFeedbackType,
        subject: cleanSubject,
        message: cleanMessage,
        status: "new",
      },
      "Feedback submitted successfully",
    );
  } catch (error) {
    console.error("createMyFeedback service error:", error.message);

    return Response.internalServerError("Unable to submit feedback");
  }
};

export const getMyFeedback = async (userId) => {
  try {
    const feedback = await feedbackRepository.findAllByUserId(userId);

    return Response.success(feedback, "Your feedback fetched successfully");
  } catch (error) {
    console.error("getMyFeedback service error:", error.message);

    return Response.internalServerError("Unable to fetch your feedback");
  }
};

export const getFeedbackForManagement = async () => {
  try {
    const feedback = await feedbackRepository.findAllForManagement();

    return Response.success(feedback, "Customer feedback fetched successfully");
  } catch (error) {
    console.error("getFeedbackForManagement service error:", error.message);

    return Response.internalServerError("Unable to fetch customer feedback");
  }
};

export const reviewFeedback = async (
  feedbackId,
  reviewedBy,
  { status, staffNote },
) => {
  try {
    const normalizedFeedbackId = Number(feedbackId);
    const cleanStatus = status?.trim().toLowerCase();
    const cleanStaffNote = staffNote?.trim();

    if (!Number.isInteger(normalizedFeedbackId) || normalizedFeedbackId < 1) {
      return Response.badRequest("A valid feedback ID is required");
    }

    if (!allowedFeedbackStatuses.includes(cleanStatus)) {
      return Response.badRequest(
        "status must be new, in_review, resolved, or closed",
      );
    }

    if (["resolved", "closed"].includes(cleanStatus) && !cleanStaffNote) {
      return Response.badRequest(
        "A staffNote is required when feedback is resolved or closed",
      );
    }

    const feedback = await feedbackRepository.findById(normalizedFeedbackId);

    if (!feedback) {
      return Response.notFound("Feedback not found");
    }

    await feedbackRepository.reviewFeedback(normalizedFeedbackId, {
      status: cleanStatus,
      staffNote: cleanStaffNote,
      reviewedBy,
    });

    const updatedFeedback =
      await feedbackRepository.findById(normalizedFeedbackId);

    return Response.success(
      updatedFeedback,
      "Customer feedback reviewed successfully",
    );
  } catch (error) {
    console.error("reviewFeedback service error:", error.message);

    return Response.internalServerError("Unable to review customer feedback");
  }
};
