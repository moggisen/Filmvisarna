import Server from "./classes/Server.js";
import express from "express";
import session from "express-session";

// Start the Filmvisarna API server
new Server();

const app = express();
app.use(express.json());

// Session (om ni använder)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev",
    resave: false,
    saveUninitialized: false,
  })
);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on :${port}`));
