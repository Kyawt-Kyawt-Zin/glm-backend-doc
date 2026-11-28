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
    const result = await transporter.sendMail({
      from: {
        name: "Golden Loom Myanmar",
        address: gmailUser,
      },
      to: gmailUser,
      subject: "Golden Loom Myanmar — email test",
      text: "Hello! This is a test email from the Golden Loom Myanmar backend.",
    });

    if (result.accepted.length > 0) {
      console.log("Gmail accepted the test email for delivery.");
    } else {
      console.log("Gmail did not accept the test email.");
    }
  } catch (error) {
    console.error("Test email failed. Error code:", error.code || "UNKNOWN");
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}
