import { isS3MediaEnabled } from "../config/media.config.js";
import * as Response from "../config/response.helper.js";

export const requireLocalMediaMode = (_req, res, next) => {
  if (!isS3MediaEnabled()) {
    return next();
  }

  const response = Response.conflict(
    "Local uploads are disabled while S3 media mode is enabled",
  );

  return res.status(response.code).json(response);
};
