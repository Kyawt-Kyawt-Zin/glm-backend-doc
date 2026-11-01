import * as Response from "../config/response.helper.js";
import * as dashboardRepository from "../repositories/dashboard.repository.js";

const formatOverviewStats = (stats) => {
  return {
    customers: {
      active: Number(stats.active_customers),
    },
    catalog: {
      active_products: Number(stats.active_products),
      low_stock_variants: Number(stats.low_stock_variants),
    },
    orders: {
      total: Number(stats.total_orders),
      pending: Number(stats.pending_orders),
      active: Number(stats.active_orders),
    },
    payments: {
      pending_deposits: Number(stats.pending_deposits),
      refund_pending_orders: Number(stats.refund_pending_orders),
    },
    feedback: {
      new: Number(stats.new_feedback),
      in_review: Number(stats.feedback_in_review),
    },
  };
};

export const getDashboardOverview = async () => {
  try {
    const stats = await dashboardRepository.getOverviewStats();

    return Response.success(
      formatOverviewStats(stats),
      "Dashboard overview fetched successfully",
    );
  } catch (error) {
    console.error("getDashboardOverview service error:", error.message);

    return Response.internalServerError("Unable to fetch dashboard overview");
  }
};

const formatRecentOrder = (order) => {
  return {
    ...order,
    total_amount: Number(order.total_amount),
    deposit_amount: Number(order.deposit_amount),
  };
};

export const getRecentOrders = async (limit) => {
  const normalizedLimit = limit === undefined ? 5 : Number(limit);

  if (
    !Number.isInteger(normalizedLimit) ||
    normalizedLimit < 1 ||
    normalizedLimit > 20
  ) {
    return Response.badRequest("limit must be a whole number between 1 and 20");
  }

  try {
    const orders = await dashboardRepository.getRecentOrders(normalizedLimit);

    return Response.success(
      orders.map(formatRecentOrder),
      "Recent orders fetched successfully",
    );
  } catch (error) {
    console.error("getRecentOrders service error:", error.message);

    return Response.internalServerError("Unable to fetch recent orders");
  }
};
