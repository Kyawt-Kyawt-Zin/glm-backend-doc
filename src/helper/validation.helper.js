export const isValidEmail = (email) => {
  if (typeof email !== "string") {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export const isValidPhone = (phone) => {
  if (!phone) {
    return true;
  }

  if (typeof phone !== "string") {
    return false;
  }

  return /^\+?[0-9]{7,15}$/.test(phone.trim());
};
