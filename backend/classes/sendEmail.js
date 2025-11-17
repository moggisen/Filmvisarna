// sendEmail.js
// Uppdaterad för att vara en ES Module (fungerar med import/export)

import nodemailer from "nodemailer";
import fs from "fs"; // Fortsätter att använda synkron fs

// Sökvägen till din hemliga fil. Justera om filen ligger någon annanstans.
const GMAIL_SECRET_PATH = "./gmail-secret.json";

// Använder "export default" för att enkelt kunna importeras som "import sendEmail from './sendEmail.js';"
export default async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments = [],
}) {
  let credentials;

  try {
    // 1. Läs och tolka den hemliga JSON-filen SYNKRONT
    const data = fs.readFileSync(GMAIL_SECRET_PATH, "utf8");
    credentials = JSON.parse(data);
  } catch (error) {
    console.error(
      `❌ Kunde inte läsa eller tolka filen ${GMAIL_SECRET_PATH}. Har du lagt till den?`,
      error
    );
    throw new Error(
      `Kunde inte ladda e-postuppgifter. Kontrollera att ${GMAIL_SECRET_PATH} finns.`
    );
  }

  if (!credentials.email || !credentials.appPassword) {
    throw new Error(
      "E-post ('email') eller App-lösenord ('appPassword') saknas i gmail-secret.json."
    );
  }

  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: credentials.email,
      pass: credentials.appPassword,
    },
  });

  const mailOptions = {
    from: `"Filmvisarna" <${credentials.email}>`,
    to,
    subject,
    text,
    html,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ E-post skickad:", info.response);
    return info;
  } catch (error) {
    console.error("❌ Fel vid e-postutskick:", error);
    throw error;
  }
}
