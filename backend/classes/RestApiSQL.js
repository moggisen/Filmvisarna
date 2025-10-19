import express from "express";
import LoginHandler from "./LoginHandlerSQL.js";
import RestSearch from "./RestSearchSQL.js";
import Acl from "./Acl.js";
import catchExpressJsonErrors from "../helpers/catchExpressJsonErrors.js";
import PasswordChecker from "../helpers/PasswordChecker.js";
import { body, query, validationResult } from "express-validator";

// import the correct version of the DBQueryMaker
const DBQueryMaker = (
  await import(isSQLite ? "./DBQueryMakerSQLite.js" : "./DBQueryMakerMySQL.js")
).default;

export default class RestApi {
  // Connect to the db through DBQueryMaker
  // and call methods that creates routes
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.prefix = this.settings.restPrefix;
    this.prefix.endsWith("/") || (this.prefix += "/");
    this.db = new DBQueryMaker(settings);
    // use built in Express middleware to read the body
    app.use(express.json());
    // use middleware to capture malformed json errors
    app.use(catchExpressJsonErrors);
    // use middleware to check password strength
    PasswordChecker.addMiddleware(app, this.prefix, settings);
    // add login routes
    new LoginHandler(this);
    // add post, get, put and delete routes
    this.addBookingRoute();
    this.addRegisterRoute();
    this.addPostRoutes(); // C
    this.addGetRoutes(); // R
    this.addPutRoutes(); // U
    this.addDeleteRoutes(); // D
    // catch calls to undefined routes
    this.addCatchAllRoute();
  }

  // send data as a json response
  // after running it through the acl system for filtering
  // alsow remove any password fields (according to settings)
  // and alter the status to 400 (bad request) if the data contains a error property
  sendJsonResponse(res, data, asObject = false) {
    if (data instanceof Array) {
      data = Acl.filterResultOnFieldMatchingUserId(res, data);
      data.forEach((post) => {
        this.settings.passwordFieldNames.forEach((x) => delete post[x]);
      });
    }
    res.status(data.error ? 400 : 200).json(asObject ? data[0] || null : data);
  }

  // delete all role fields amongst parameters if write to users table
  // (so that a user can not set his own role)
  stripRoleField(table, body) {
    table.toLowerCase() === this.settings.userTableName.toLowerCase() &&
      delete body[this.settings.userRoleField];
  }

  // using express-validator to validate the data sent through the API during user-registration
  addRegisterRoute() {
    this.app.post(
      this.prefix + "register",
      body("user_email")
        .trim()
        .notEmpty()
        .withMessage("Email är obligatoriskt")
        .isEmail()
        .withMessage("Måste vara en giltig email"),
      async (req, res) => {
        const result = validationResult(req);

        if (!result.isEmpty()) {
          return res.status(400).json({
            error: "Ogiltig input",
            details: result.array(),
          });
        }

        try {
          // await this.saveUser(user_email, user_password_hash);
          res.json({ success: true, message: "Användare registrerad" });
        } catch (error) {
          res.status(500).json({ error: "Kunde inte skapa användare" });
        }
      }
    );
  }

  addBookingRoute() {
    this.app.post(this.prefix + "makeBooking", async (req, res) => {
      try {
        const { screening_id, user_id, seats } = req.body;

        // --- 1️⃣ Validering ---
        if (!screening_id || !Array.isArray(seats) || seats.length === 0) {
          return res
            .status(400)
            .json({ error: "Du måste ange screening_id och minst en stol." });
        }

        for (const seat of seats) {
          if (!seat.seat_id || !seat.ticketType_id) {
            return res.status(400).json({
              error: "Varje seat måste ha seat_id och ticketType_id.",
            });
          }
        }

        // --- 2️⃣ Starta transaktion ---
        await this.db.query("POST", req.url, "START TRANSACTION;", {});

        // --- 3️⃣ Kontrollera att visningen finns ---
        const screening = await this.db.query(
          "POST",
          req.url,
          "SELECT * FROM screenings WHERE id = :id",
          { id: screening_id }
        );
        if (!screening.length)
          throw { status: 404, message: "Visningen finns inte." };

        // Hämta och formatera screeningens datum och tid
        const screeningTimeRaw = screening[0].screening_time;
        const screeningTime = new Date(screeningTimeRaw).toLocaleString(
          "sv-SE",
          {
            dateStyle: "medium",
            timeStyle: "short",
          }
        );

        // --- 4️⃣ Kontrollera lediga stolar ---
        // 4a) Plocka ut efterfrågade seat_id som tal
        const requestedSeatIds = seats.map((s) => Number(s.seat_id));

        // 4b) Blockera dubbletter i samma anrop (UX)
        const duplicatesInPayload = [
          ...new Set(
            requestedSeatIds.filter((id, idx, arr) => arr.indexOf(id) !== idx)
          ),
        ];
        if (duplicatesInPayload.length) {
          return res.status(400).json({
            error: `Dubbletter i anropet: stolar ${duplicatesInPayload.join(
              ", "
            )}.`,
          });
        }

        // 4c) Hämta redan bokade stolar för visningen
        const booked = await this.db.query(
          "POST",
          req.url,
          "SELECT seat_id FROM bookingsXseats WHERE screening_id = :id",
          { id: screening_id }
        );
        const bookedSeats = new Set(booked.map((r) => Number(r.seat_id)));

        // 4d) Samla *alla* konflikter (inte bara första)
        const conflicts = requestedSeatIds.filter((id) => bookedSeats.has(id));
        if (conflicts.length) {
          return res.status(409).json({
            error: `Följande stolar är redan bokade: ${[
              ...new Set(conflicts),
            ].join(", ")}.`,
          });
        }

        // --- 5️⃣ Beräkna totalpris ---
        const uniqueTicketIds = [...new Set(seats.map((s) => s.ticketType_id))];
        const placeholders = uniqueTicketIds
          .map((_, i) => `:id${i}`)
          .join(", ");
        const params = Object.fromEntries(
          uniqueTicketIds.map((id, i) => [`id${i}`, id])
        );

        const ticketRows = await this.db.query(
          "POST",
          req.url,
          `SELECT id, ticketType_price FROM ticketTypes WHERE id IN (${placeholders})`,
          params
        );
        const ticketMap = Object.fromEntries(
          ticketRows.map((r) => [r.id, r.ticketType_price])
        );
        const totalPrice = seats.reduce(
          (sum, s) => sum + ticketMap[s.ticketType_id],
          0
        );

        // --- 6️⃣ Skapa bokningen ---
        const crypto = await import("crypto");
        const confirmation = crypto.randomBytes(8).toString("hex");

        const bookingResult = await this.db.query(
          "POST",
          req.url,
          `INSERT INTO bookings (booking_time, booking_confirmation, screening_id, user_id)
         VALUES (NOW(), :confirmation, :screening_id, :user_id)`,
          { confirmation, screening_id, user_id }
        );
        const booking_id = bookingResult.insertId;

        // --- 7️⃣ Reservera stolar ---
        for (const s of seats) {
          try {
            await this.db.query(
              "POST",
              req.url,
              `INSERT INTO bookingsXseats (screening_id, seat_id, ticketType_id, booking_id)
       VALUES (:screening_id, :seat_id, :ticketType_id, :booking_id)`,
              {
                screening_id,
                seat_id: s.seat_id,
                ticketType_id: s.ticketType_id,
                booking_id,
              }
            );
          } catch (e) {
            // Om databasen har uniknyckel på (screening_id, seat_id) blir detta ett snyggt 409-svar
            if (
              e &&
              (e.code === "ER_DUP_ENTRY" || /Duplicate entry/.test(String(e)))
            ) {
              throw {
                status: 409,
                message: `Stol ${s.seat_id} är redan bokad.`,
              };
            }
            throw e;
          }
        }

        // --- 8️⃣ Bekräfta bokningen ---
        await this.db.query("POST", req.url, "COMMIT;", {});

        res.status(201).json({
          message: "Bokning skapad!",
          booking_id,
          booking_confirmation: confirmation,
          total_price: totalPrice,
          screening_id,
          screening_time: screeningTime,
          seats,
        });
      } catch (err) {
        console.error("Booking error:", err);
        await this.db.query("POST", req.url, "ROLLBACK;", {});
        const status = err.status || 500;
        res.status(status).json({ error: err.message || "Internt serverfel." });
      }
    });
  }

  addPostRoutes() {
    // insert a post in a table
    this.app.post(this.prefix + ":table", async (req, res) => {
      req.body = req.body || {};
      const { table } = req.params;
      const { body } = req;
      this.stripRoleField(table, body);
      delete body.id; // id:s should be set by the db
      const result = await this.db.query(
        req.method,
        req.url,
        /*sql*/ `
        INSERT INTO ${table} (${Object.keys(body).join(", ")})
        VALUES (${Object.keys(body)
          .map((x) => ":" + x)
          .join(", ")})
      `,
        body
      );
      this.sendJsonResponse(res, result);
    });
  }

  addGetRoutes() {
    // get all the posts in a table
    // or: if there are search params in the url get posts matching them
    this.app.get(this.prefix + ":table", async (req, res) => {
      const { table } = req.params;
      const { error, sqlWhere, parameters } = RestSearch.parse(req);
      if (error) {
        this.sendJsonResponse(res, { error });
        return;
      }
      const result = await this.db.query(
        req.method,
        req.url,
        /*sql*/ `
        SELECT * FROM ${table}
        ${sqlWhere}
      `,
        parameters
      );
      this.sendJsonResponse(res, result);
    });

    // get a post by id in a table
    this.app.get(this.prefix + ":table/:id", async (req, res) => {
      const { table, id } = req.params;
      const result = await this.db.query(
        req.method,
        req.url,
        /*sql*/ `
        SELECT * FROM ${table}
        WHERE id = :id
      `,
        { id }
      );
      this.sendJsonResponse(res, result, true);
    });
  }

  addPutRoutes() {
    // update a post in a table
    this.app.put(this.prefix + ":table/:id", async (req, res) => {
      const { table, id } = req.params;
      let { body } = req;
      this.stripRoleField(table, body);
      delete body.id; // id:s should be set in the route
      const result = await this.db.query(
        req.method,
        req.url,
        /*sql*/ `
        UPDATE ${table}
        SET ${Object.keys(body)
          .map((x) => x + "= :" + x)
          .join(", ")}
        WHERE id = :id
      `,
        { id, ...body }
      );
      this.sendJsonResponse(res, result);
    });
  }

  addDeleteRoutes() {
    // delete a post in a table
    this.app.delete(this.prefix + ":table/:id", async (req, res) => {
      const { table, id } = req.params;
      const result = await this.db.query(
        req.method,
        req.url,
        /*sql*/ `
        DELETE FROM ${table}
        WHERE id = :id
      `,
        { id }
      );
      this.sendJsonResponse(res, result);
    });
  }

  addCatchAllRoute() {
    // send if the route is missing
    /*this.app.all(this.prefix + '{*splat}', (_req, res) => {
      this.sendJsonResponse(res, { error: 'No such route exists in the REST-api' });
    });*/
  }
}
