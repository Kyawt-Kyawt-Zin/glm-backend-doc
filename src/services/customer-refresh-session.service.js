import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import * as refreshRepository from "../repositories/customer-refresh-session.repository.js";
import * as userRepository from "../repositories/user.repository.js";
import { isDeletedEmailMarker } from "../helper/deleted-email.helper.js";

const newRefreshToken = () => randomBytes(32).toString("base64url");

const hashToken = (token) => createHash("sha256").update(token).digest();

const isValidTokenFormat = (token) =>
  typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

export const createCustomerAccessToken = (user) =>
  jwt.sign({ userId: user.id, role: user.role }, config.auth.jwtSecret, {
    expiresIn: "15m",
  });

export const createCustomerRefreshSession = async (userId) => {
  const refreshToken = newRefreshToken();

  await refreshRepository.createRefreshSession({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(refreshToken),
  });

  return refreshToken;
};

export const refreshCustomerSession = async (refreshToken) => {
  if (!isValidTokenFormat(refreshToken)) return null;

  const oldTokenHash = hashToken(refreshToken);
  const session =
    await refreshRepository.findActiveRefreshSession(oldTokenHash);

  if (!session) return null;

  const user = await userRepository.findById(session.user_id);

  if (
    !user ||
    !user.is_active ||
    user.role !== "customer" ||
    isDeletedEmailMarker(user.email)
  ) {
    await refreshRepository.revokeRefreshSession(oldTokenHash);
    return null;
  }

  const accessToken = createCustomerAccessToken(user);

  const nextRefreshToken = newRefreshToken();

  const rotated = await refreshRepository.rotateRefreshSession(
    session.id,
    oldTokenHash,
    hashToken(nextRefreshToken),
  );

  if (!rotated) return null;

  return {
    user,
    accessToken,
    refreshToken: nextRefreshToken,
  };
};

export const revokeCustomerRefreshSession = async (refreshToken) => {
  if (!isValidTokenFormat(refreshToken)) return;

  await refreshRepository.revokeRefreshSession(hashToken(refreshToken));
};
