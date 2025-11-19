import Server from "./classes/Server.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start the main server
const server = new Server();

// Hämta Express-appen från Server-klassen och konfigurera static files
// (förutsatt att Server-klassen exponerar appen)
if (server.app) {
  // Serva statiska filer
  server.app.use(express.static(path.join(__dirname, "../dist")));

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
