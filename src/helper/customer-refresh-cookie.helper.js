const cookieName = "glm_customer_refresh";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
  sameSite: "strict",
  path: "/api/auth",
};

export const setCustomerRefreshCookie = (res, token) => {
  res.cookie(cookieName, token, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

export const clearCustomerRefreshCookie = (res) => {
  res.clearCookie(cookieName, cookieOptions);
};

export const readCustomerRefreshCookie = (req) => {
  const cookies = req.headers.cookie?.split(";") || [];

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (name === cookieName) {
      return valueParts.join("=");
    }
  }

  return null;
};
