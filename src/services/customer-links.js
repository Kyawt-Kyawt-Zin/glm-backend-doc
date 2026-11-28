const defaultSite = "https://golden-loom-myanmar.vercel.app";

export const createCustomerOrderLink = (
  orderId,
  {
    pickup = false,
    siteUrl = process.env.CUSTOMER_SITE_URL || defaultSite,
  } = {},
) => {
  if (!/^[1-9]\d*$/.test(String(orderId)))
    throw new Error("A valid order ID is required");
  const base = new URL(siteUrl);
  const isLocal = ["localhost", "127.0.0.1"].includes(base.hostname);
  if (
    (!isLocal && base.protocol !== "https:") ||
    (isLocal && !["http:", "https:"].includes(base.protocol)) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("CUSTOMER_SITE_URL must be an origin using HTTPS");
  }
  const url = new URL(`/account/orders/${orderId}`, base.origin);
  if (pickup) url.hash = "pickup";
  return url.href;
};

export const pickupMapLink =
  "https://maps.google.com/maps?q=25.264416,55.316384&ll=25.264416,55.316384&z=16";
