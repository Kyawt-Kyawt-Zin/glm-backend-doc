import nodemailer from "nodemailer";
import { createWelcomeEmail } from "./welcome-email.template.js";

let transporter = null;

const getTransporter = () => {
  const gmailUser = process.env.MAILER_GMAIL_USER;
  const gmailPassword = process.env.MAILER_GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPassword) {
    throw new Error("Gmail settings are missing.");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  return transporter;
};

export const sendWelcomeEmail = async ({ to, fullName }) => {
  const message = createWelcomeEmail(fullName);

  await sendEmail({ to, message });
};

export const sendEmail = async ({ to, message }) => {
  await getTransporter().sendMail({
    from: {
      name: "Golden Loom Myanmar",
      address: process.env.MAILER_GMAIL_USER,
    },
    to,
    subject: message.subject,
    text: message.text,
  });
};
