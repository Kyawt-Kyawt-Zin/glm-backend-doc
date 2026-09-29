export const success = (data = null, message = "Succeeded", code = 200) => {
  return {
    status: "ok",
    code,
    message,
    data,
  };
};

export const created = (data = null, message = "Created successfully") => {
  return {
    status: "ok",
    code: 201,
    message,
    data,
  };
};

export const badRequest = (message = "Bad Request") => {
  return {
    status: "error",
    code: 400,
    message,
  };
};

export const notFound = (message = "Resource not found") => {
  return {
    status: "error",
    code: 404,
    message,
  };
};

export const conflict = (message = "Conflict") => {
  return {
    status: "error",
    code: 409,
    message,
  };
};

export const internalServerError = (message = "Internal Server Error") => {
  return {
    status: "error",
    code: 500,
    message,
  };
};
