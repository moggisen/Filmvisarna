import Server from "./classes/Server.js";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start the Filmvisarna API server
const server = new Server();

if (server.app) {
  // CSP headers
  server.app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "connect-src 'self' http://localhost:5001 ws://localhost:5001; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:;"
    );
    next();
  });

  // Fallback för SPA
  server.app.get("/", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(__dirname, "../dist", "index.html"));
    }
  });
}

// const port = process.env.PORT || 3000;
// app.listen(port, () => console.log(`API running on :${port}`));
// Starta en **separat** Express-app bara om man uttryckligen vill det.
// Då krockar vi inte med Server-klassen som redan startar appen.
if (process.env.ENABLE_LEGACY_INDEX_APP === "1") {
  const app = express();
  app.use(express.json());

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev",
      resave: false,
      saveUninitialized: false,
    })
  );

  const port = process.env.PORT || 5001;
  app.listen(port, () => console.log(`API running on :${port}`));
}
