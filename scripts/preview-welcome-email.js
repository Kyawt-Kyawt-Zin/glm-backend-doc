import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  jsonTransport: true,
});

const result = await transporter.sendMail({
  from: "Golden Loom Myanmar <sender@example.invalid>",
  to: "customer@example.invalid",
  subject: "Welcome to Golden Loom Myanmar",
  text: "Hello! Thank you for joining Golden Loom Myanmar.",
});

const message = JSON.parse(result.message);

console.log("From:", result.envelope.from);
console.log("To:", result.envelope.to.join(", "));
console.log("Subject:", message.subject);
console.log("Message:", message.text);
