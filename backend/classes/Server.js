import path from "path";
import express from "express";
import PathFinder from "../helpers/PathFinder.js";
import SseRoute from "./sseRoute.js";
import { startEventsPoller } from "../helpers/eventsPoller.js";

const settings = PathFinder.requireJson("../settings.json");

// check dbType from settings
globalThis.isSQLite = settings.dbType === "SQLite";
globalThis.isMySQL = settings.dbType === "MySQL";
globalThis.isSQL = isSQLite || isMySQL;
globalThis.isMongoDB = settings.dbType === "MongoDB";
if (!isSQLite && !isMySQL && !isMongoDB) {
  throw new Error("Valid dbType not specified");
}

// import the correct version of the rest API
const RestApi = (
  await import(isSQL ? "./RestApiSQL.js" : "./RestApiMongoDB.js")
).default;

// 🔽 ADD: importera SSE-route + poller
// import SseRoute from './sseRoute.js';
// import { startEventsPoller } from '../helpers/eventsPoller.js';

export default class Server {
  settings = settings;

  constructor() {
    this.startServer();
  }

  startServer() {
    // Start an Express server/app
    const { port } = this.settings;
    this.app = express();
    this.app.listen(port, () =>
      console.log(
        "Server listening on http://localhost:" + port
        //'with settings', this.settings
      )
    );
    // Add rest routes
    // new RestApi(this.app, this.settings);

    // if (isMySQL) {
    // new SseRoute(this.app, this.settings);
    // startEventsPoller(400); // 300–800 ms är lagom
    // }

    // NÖDBROMS: blockera /api/bookings (alla metoder & alla underpaths)
    this.app.get("/api/bookings", (req, res) => {
      return res.status(403).json({ error: "Forbidden" });
    });

    // NÖDBROMS: blockera /api/bookings/:id (endast numeriska id)
    this.app.get(/^\/api\/bookings\/\d+$/, (req, res) => {
      return res.status(403).json({ error: "Forbidden" });
    });

    // NÖDBROMS: blockera /api/users (alla metoder & alla underpaths)
    this.app.use("/api/users", (req, res) => {
      return res.status(403).json({ error: "Forbidden" });
    });

    new SseRoute(this.app, { prefix: this.settings.restPrefix });
    startEventsPoller(200);
    console.log("[SSE] mounted /api/bookings/stream");

    // Add rest routes efter SSE
    new RestApi(this.app, this.settings);
    // Add static folder to serve
    this.addStaticFolder();
  }

  // serve html, js, css, images etc from a static folder
  addStaticFolder() {
    const folder = PathFinder.relToAbs(this.settings.staticFolder);
    this.app.use(express.static(folder));

    this.app.get(/^\/(?!api).*/, (req, res) => {
      if (!req.url.includes(".")) {
        return res.sendFile(path.join(folder, "index.html"));
      }
      return res.status(404).json({ error: "Not found" });
    });

    // catch all middleware (important for SPA:s - serve index.html if not matching server route)
    // this.app.get("*", (req, res) => {
    //   !req.url.includes(".")
    //     ? res.sendFile(path.join(folder, "index.html"))
    //     : res.status(400).json({ error: "No such route" });
    // });
  }
}
