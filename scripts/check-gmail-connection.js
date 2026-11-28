import nodemailer from "nodemailer";

const gmailUser = process.env.MAILER_GMAIL_USER;
const gmailPassword = process.env.MAILER_GMAIL_APP_PASSWORD;

if (!gmailUser || !gmailPassword) {
  console.error("Gmail settings are missing from the environment.");
  process.exitCode = 1;
} else {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.verify();
    console.log("Gmail connection verified successfully");
  } catch (error) {
    console.error(
      "Gmail connection failed. Error code:",
      error.code || "UNKNOWN",
    );
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}
