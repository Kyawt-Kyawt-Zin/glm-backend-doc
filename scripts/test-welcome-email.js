import { sendWelcomeEmail } from "../src/services/email.service.js";

const testAddress = process.env.MAILER_GMAIL_USER;

if (!testAddress) {
  console.error("The test Gmail address is missing from .env.");
  process.exitCode = 1;
} else {
  try {
    await sendWelcomeEmail({
      to: testAddress,
      fullName: "Aye",
    });

    console.log("Gmail accepted the welcome email for delivery.");
  } catch (error) {
    console.error(
      "Welcome email test failed. Error code:",
      error.code || "UNKNOWN",
    );
    process.exitCode = 1;
  }
}
