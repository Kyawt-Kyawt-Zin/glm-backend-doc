export const createWelcomeEmail = (fullName) => {
  const name = typeof fullName === "string" ? fullName.trim() : "";

  const greeting = name ? `Hello ${name},` : "Hello,";

  return {
    subject: "Welcome to Golden Loom Myanmar",
    text: `${greeting}

Thank you for creating an account with Golden Loom Myanmar.

You can now browse our sweater collection and follow your orders from your account.

We’re happy to have you here!

Golden Loom Myanmar`,
  };
};
