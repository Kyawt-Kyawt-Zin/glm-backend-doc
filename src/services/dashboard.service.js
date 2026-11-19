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

const chartStatusDefinitions = [
  { status: "pending", label: "Pending" },
  { status: "confirmed", label: "Confirmed" },
  { status: "processing", label: "Processing" },
  { status: "ready_for_delivery", label: "Ready for delivery" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "ready_for_pickup", label: "Ready for pickup" },
  { status: "delivered", label: "Delivered" },
  { status: "picked_up", label: "Picked up" },
  { status: "cancelled", label: "Cancelled" },
];

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatOrderActivity = (rows) => {
  const countByDate = new Map(
    rows.map((row) => [row.date, Number(row.order_count)]),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activity = [];

  for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);

    const dateKey = formatDateKey(date);

    activity.push({
      date: dateKey,
      order_count: countByDate.get(dateKey) || 0,
    });
  }

  return activity;
};

const formatOrderStatusCounts = (rows) => {
  const countByStatus = new Map(
    rows.map((row) => [row.status, Number(row.order_count)]),
  );

  return chartStatusDefinitions.map(({ status, label }) => ({
    status,
    label,
    order_count: countByStatus.get(status) || 0,
  }));
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

export const getLowStockVariants = async (threshold) => {
  const normalizedThreshold = threshold === undefined ? 3 : Number(threshold);

  if (
    !Number.isInteger(normalizedThreshold) ||
    normalizedThreshold < 0 ||
    normalizedThreshold > 100
  ) {
    return Response.badRequest(
      "threshold must be a whole number between 0 and 100",
    );
  }

  try {
    const variants =
      await dashboardRepository.getLowStockVariants(normalizedThreshold);

    return Response.success(
      variants,
      "Low stock variants fetched successfully",
    );
  } catch (error) {
    console.error("getLowStockVariants service error:", error.message);

    return Response.internalServerError("Unable to fetch low stock variants");
  }
};

export const getDashboardAnalytics = async () => {
  try {
    const [activityRows, statusRows] = await Promise.all([
      dashboardRepository.getOrderActivityLastSevenDays(),
      dashboardRepository.getOrderStatusCounts(),
    ]);

    return Response.success(
      {
        order_activity: formatOrderActivity(activityRows),
        order_statuses: formatOrderStatusCounts(statusRows),
      },
      "Dashboard analytics fetched successfully",
    );
  } catch (error) {
    console.error("getDashboardAnalytics service error:", error.message);

    return Response.internalServerError("Unable to fetch dashboard analytics");
  }
};
