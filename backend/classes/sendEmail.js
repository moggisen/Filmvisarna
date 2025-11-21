// sendEmail.js
// Updated to be an ES Module (works with imports/export syntax)

// Import the Nodemailer libary to handle email sending
import nodemailer from "nodemailer";
// import the file system module to read local files
import fs from "fs"; 

// The file path to your secret JSON file- Adjurt if the file is elsewhere
const GMAIL_SECRET_PATH = "./gmail-secret.json";

// Use "export default" so it can be imported easily as "import sendEmail from './sendEmail.js;"
export default async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments = [],
}) {
  let credentials;

  try {
    // Read and aprse the secret JSON file SYNCHRONOUSLY
    // This reads the file content
    const data = fs.readFileSync(GMAIL_SECRET_PATH, "utf8");
    // This reads the file content
    credentials = JSON.parse(data);
  } catch (error) {
    throw new Error(
      `Kunde inte ladda e-postuppgifter. Kontrollera att ${GMAIL_SECRET_PATH} finns.`
    );
  }

  // Check if the necessary values (email and password) are in the file 
  if (!credentials.email || !credentials.appPassword) {
    throw new Error(
      "E-post ('email') eller App-lösenord ('appPassword') saknas i gmail-secret.json."
    );
  }
// Create the transporter (The sender setup)
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: credentials.email,
      pass: credentials.appPassword,
    },
  });

  // Define email options (The mail content)
  const mailOptions = {
    from: `"Filmvisarna" <${credentials.email}>`,
    to,
    subject,
    text,
    html,
    attachments,
  };

  // Send the email
  try {
    // Send the eamil and wait for the result 
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    throw error;
  }
}
