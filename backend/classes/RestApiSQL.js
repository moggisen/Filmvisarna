import express from "express";
import LoginHandler from "./LoginHandlerSQL.js";
import RestSearch from "./RestSearchSQL.js";
import Acl from "./Acl.js";
import catchExpressJsonErrors from "../helpers/catchExpressJsonErrors.js";
import PasswordChecker from "../helpers/PasswordChecker.js";
import { body, query, validationResult } from "express-validator";
import { sendBookingEmail } from "./sendBookingEmail.js";
import {
  holdSeat,
  releaseSeat,
  broadcast,
  clearHolds,
} from "../helpers/sseRegistry.js";

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

    app.use((req, res, next) => {
      const isApiRequest = req.path.startsWith("/api");
      const isFromBrowser =
        req.get("Accept")?.includes("text/html") ||
        req.get("Sec-Fetch-Mode") === "navigate" ||
        req.get("Sec-Fetch-Dest") === "document";

      if (isApiRequest && isFromBrowser) {
        console.log(`Redirecting API direct access: ${req.method} ${req.path}`);
        return res.redirect("/");
      }
      next();
    });
    // use built in Express middleware to read the body
    app.use(express.json());
    // use middleware to capture malformed json errors
    app.use(catchExpressJsonErrors);
    // use middleware to check password strength
    // PasswordChecker.addMiddleware(app, this.prefix, settings);
    // add login routes
    new LoginHandler(this);
    // add post, get, put and delete routes
    this.addBookingRoute();
    this.addSeatHoldRoute();
    this.addRegisterRoute();
    this.addUserBookingsRoute();
    this.addUserBookingDeleteRoute();
    this.addBookingSeatDetailsRoute();
    this.addGuestUserRoute();
    this.addPostRoutes(); // C
    this.addGetRoutes(); // R
    this.addPutRoutes(); // U
    this.addDeleteRoutes(); // D

    app.get(this.prefix + "ticketTypes", async (req, res) => {
      try {
        const rows = await this.db.query(
          "GET",
          req.url,
          "SELECT * FROM ticketTypes ORDER BY id",
          {}
        );
        res.json(rows);
      } catch (error) {
        console.error("Error fetching ticket types:", error);
        res.status(500).json({ error: "Kunde inte hämta biljettyper" });
      }
    });

    // Get auditorium + what seats are booked for a screening
    this.app.get(this.prefix + "screenings/:id/layout", async (req, res) => {
      const screening_id = req.params.id;

      try {
        // 1. Get screening to know which auditorium to use
        const screeningRows = await this.db.query(
          "GET",
          req.url,
          `SELECT s.id, s.auditorium_id, a.auditorium_name
           FROM screenings s
           JOIN auditoriums a ON s.auditorium_id = a.id
           WHERE s.id = :screening_id`,
          { screening_id }
        );

        if (!screeningRows.length) {
          return res.status(404).json({ error: "Screening hittades inte" });
        }

        const { auditorium_id, auditorium_name } = screeningRows[0];

        // 2. Get all seats in that auditorium with row/number
        const seatRows = await this.db.query(
          "GET",
          req.url,
          `SELECT id, row_index, seat_number
           FROM seats
           WHERE auditorium_id = :auditorium_id
           ORDER BY row_index, seat_number`,
          { auditorium_id }
        );

        // 3. Get booked seats for "this" specific screening
        const bookedRows = await this.db.query(
          "GET",
          req.url,
          `SELECT seat_id
           FROM bookingsXseats
           WHERE screening_id = :screening_id`,
          { screening_id }
        );
        const bookedSet = new Set(bookedRows.map((r) => Number(r.seat_id)));

        // 4. Build structure per row
        // rowsMap[row_index] = [ {id, seatNumber, taken}, ... ]
        const rowsMap = new Map();
        for (const seat of seatRows) {
          const r = seat.row_index;
          if (!rowsMap.has(r)) rowsMap.set(r, []);
          rowsMap.get(r).push({
            id: seat.id,
            seatNumber: seat.seat_number,
            taken: bookedSet.has(Number(seat.id)),
          });
        }

        // 5. Conver Map -> array with sort
        const rows = Array.from(rowsMap.entries())
          .sort((a, b) => a[0] - b[0]) // sortera efter row_index
          .map(([rowIndex, seats]) => ({
            rowIndex,
            seats: seats.sort((a, b) => a.seatNumber - b.seatNumber),
          }));

        res.json({
          auditorium_id,
          auditorium_name,
          rows,
        });
      } catch (err) {
        console.error("Fel i GET /screenings/:id/layout:", err);
        res.status(500).json({ error: "Kunde inte hämta layout" });
      }
    });
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

  //  Convert rowindex (1, 2, 3...) to letter (A, B, C...)
  getRowLetter(rowIndex) {
    // 65 is the ASCII-koden for 'A'
    if (rowIndex < 1 || rowIndex > 26) return rowIndex.toString();
    return String.fromCharCode(64 + rowIndex);
  }

  // Bookings / Mina sidor -----------------------------------------------
  addUserBookingsRoute() {
    this.app.get(this.prefix + "user/bookings", async (req, res) => {
      if (!req.session.user) {
        return res.status(401).json({ error: "Ej inloggad" });
      }

      try {
        const userId = req.session.user.id;

        const bookings = await this.db.query(
          "GET",
          req.url,
          `SELECT 
          b.id,
          b.booking_confirmation,
          b.booking_time,
          s.screening_time,
          m.movie_title,
          a.auditorium_name,
          SUM(tt.ticketType_price) as total_price
        FROM bookings b
        JOIN screenings s ON b.screening_id = s.id
        JOIN movies m ON s.movie_id = m.id
        JOIN auditoriums a ON s.auditorium_id = a.id
        JOIN bookingsXseats bxs ON b.id = bxs.booking_id
        JOIN ticketTypes tt ON bxs.ticketType_id = tt.id
        WHERE b.user_id = :user_id
        GROUP BY b.id
        ORDER BY b.booking_time DESC`,
          { user_id: userId }
        );

        // Get seat-information for every booking
        for (let booking of bookings) {
          const seats = await this.db.query(
            "GET",
            req.url,
            `SELECT 
            bxs.seat_id,
            tt.ticketType_name,
            tt.ticketType_price
          FROM bookingsXseats bxs
          JOIN ticketTypes tt ON bxs.ticketType_id = tt.id
          WHERE bxs.booking_id = :booking_id`,
            { booking_id: booking.id }
          );
          booking.seats = seats;
        }
        this.sendJsonResponse(res, bookings);
      } catch (error) {
        console.error("Error fetching user bookings:", error);
        this.sendJsonResponse(res, { error: "Kunde inte hämta bokningar" });
      }
    });
  }

  addUserBookingDeleteRoute() {
    this.app.delete(this.prefix + "bookings/:id", async (req, res) => {
      if (!req.session.user) {
        return res.status(401).json({ error: "Ej inloggad" });
      }

      try {
        const bookingId = req.params.id;
        const userId = req.session.user.id;

        // Check that the booking belongs to the logged in user
        const userBooking = await this.db.query(
          "GET",
          req.url,
          "SELECT id FROM bookings WHERE id = :id AND user_id = :user_id",
          { id: bookingId, user_id: userId }
        );

        if (userBooking.length === 0) {
          return res.status(404).json({ error: "Bokning hittades inte" });
        }

        // Delete the booking (cascading delete should take care of bookingsXseats)
        await this.db.query(
          "DELETE",
          req.url,
          "DELETE FROM bookings WHERE id = :id",
          { id: bookingId }
        );

        this.sendJsonResponse(res, { success: "Bokning raderad" });
      } catch (error) {
        console.error("Error deleting booking:", error);
        this.sendJsonResponse(res, { error: "Kunde inte radera bokning" });
      }
    });
  }

  // Get seats + row/number for a certain booking
  addBookingSeatDetailsRoute() {
    this.app.get(
      this.prefix + "bookings/:id/seatsDetailed",
      async (req, res) => {
        const booking_id = req.params.id;

        try {
          // Get all seats for that booking and join seats - bookings
          const rows = await this.db.query(
            "GET",
            req.url,
            `
          SELECT 
            bxs.seat_id,
            bxs.ticketType_id,
            s.row_index,
            s.seat_number
          FROM bookingsXseats bxs
          JOIN seats s ON bxs.seat_id = s.id
          WHERE bxs.booking_id = :booking_id
          ORDER BY s.row_index, s.seat_number
        `,
            { booking_id }
          );

          // rows ser nu ut som:
          // [
          //   { seat_id: 27, ticketType_id: 1, row_index: 1, seat_number: 7 },
          //   { seat_id: 28, ticketType_id: 2, row_index: 1, seat_number: 8 },
          //   ...
          // ]

          res.json(rows);
        } catch (err) {
          console.error("Error fetching seat details for booking:", err);
          res.status(500).json({
            error: "Kunde inte hämta sätesinformation för bokningen.",
          });
        }
      }
    );
  }

  // SLUT ------ Bookings / Mina sidor -----------------------------------------------

  // using express-validator to validate the data sent through the API during user-registration
  addRegisterRoute() {
    this.app.post(
      this.prefix + "register",
      [
        body("user_email")
          .trim()
          .notEmpty()
          .withMessage("Email är obligatoriskt")
          .isEmail()
          .withMessage("Måste vara en giltig email"),
        body("user_password_hash")
          .optional()
          .isLength({ min: 8, max: 35 })
          .withMessage("Lösenordet måste vara minst 8 tecken"),
        body("user_password")
          .optional()
          .isLength({ min: 8, max: 35 })
          .withMessage("Lösenordet måste vara minst 8 tecken"),
        body("user_phoneNumber")
          .optional()
          .matches(/^(\+46|0)[\d\s-]{7,15}$/)
          .withMessage("Ange ett giltigt mobilnummer"),
      ],
      async (req, res) => {
        const result = validationResult(req);
        if (!result.isEmpty()) {
          return res.status(400).json({
            error: "Ogiltig input",
            details: result.array(),
          });
        }

        const {
          user_email,
          user_password,
          user_password_hash,
          user_name,
          user_phoneNumber,
          is_guest = false,
        } = req.body;

        //  Guest logic: if is_guest is true, acceptera without password
        if (is_guest) {
          if (user_password || user_password_hash) {
            return res.status(400).json({
              error: "Gästanvändare kan inte ha lösenord",
            });
          }

          req.session.user = {
            id: newUser[0].id,
            user_email: user_email,
            is_guest: true,
          };
        } else {
          // Normal user has to have password
          if (user_password && user_password_hash) {
            return res.status(400).json({
              error:
                "Skicka endast user_password eller user_password_hash, inte båda.",
            });
          }
          if (!user_password && !user_password_hash) {
            return res.status(400).json({
              error:
                "Du måste skicka antingen user_password eller user_password_hash.",
            });
          }
        }

        try {
          // Check if email already exists
          const existingUser = await this.db.query(
            "POST",
            req.url,
            "SELECT id, user_password_hash FROM users WHERE user_email = :user_email",
            { user_email }
          );

          if (existingUser.length > 0) {
            const user = existingUser[0];

            if (is_guest && !user.user_password_hash) {
              return res.status(200).json({
                success: true,
                message: "Gästanvändare finns redan",
                user: { id: user.id, user_email, user_name, user_phoneNumber },
                is_guest: true,
              });
            }

            //  If user exists as guest and want to become a member
            if (!is_guest && !user.user_password_hash) {
              // Upgrade to member
              const userObj = {
                user_password_hash: user_password_hash || user_password,
                user_name: user_name || null,
                user_phoneNumber: user_phoneNumber || null,
              };

              if (user_password) {
                await PasswordEncryptor.encrypt(userObj);
              }

              await this.db.query(
                "PUT",
                req.url,
                `UPDATE users 
               SET user_password_hash = :user_password_hash, 
                   user_name = :user_name, 
                   user_phoneNumber = :user_phoneNumber 
               WHERE id = :id`,
                { ...userObj, id: user.id }
              );

              const updatedUser = await this.db.query(
                "GET",
                req.url,
                `SELECT id, user_email, user_name, user_phoneNumber FROM users WHERE id = :id`,
                { id: user.id }
              );

              req.session.user = updatedUser[0];

              return res.status(200).json({
                success: true,
                message: "Gäst uppgraderad till medlem",
                user: updatedUser[0],
                is_guest: false,
              });
            }

            return res
              .status(400)
              .json({ error: "E-postadressen används redan" });
          }

          //  Create new user (member or guest)
          const userObj = {
            user_email,
            user_password_hash: is_guest
              ? null
              : user_password_hash || user_password,
            user_name: user_name || null,
            user_phoneNumber: user_phoneNumber || null,
          };

          if (!is_guest && user_password) {
            await PasswordEncryptor.encrypt(userObj);
          }

          // Save user
          const result = await this.db.query(
            "POST",
            req.url,
            `INSERT INTO users (user_email, user_password_hash, user_name, user_phoneNumber)
           VALUES (:user_email, :user_password_hash, :user_name, :user_phoneNumber)`,
            userObj
          );

          const newUser = await this.db.query(
            "GET",
            req.url,
            `SELECT id, user_email, user_name, user_phoneNumber FROM users WHERE id = :id`,
            { id: result.insertId }
          );

          // Log in automatically if not a guest
          if (!is_guest) {
            req.session.user = newUser[0];
          }

          res.status(201).json({
            success: true,
            message: is_guest
              ? "Gästanvändare skapad"
              : "Användare registrerad och inloggad",
            user: newUser[0],
            is_guest,
          });
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: "Kunde inte skapa användare" });
        }
      }
    );
  }

  addGuestUserRoute() {
    this.app.post(this.prefix + "guest", async (req, res) => {
      const { user_email } = req.body;

      if (!user_email) {
        return res.status(400).json({ error: "Email krävs för gäst" });
      }

      try {
        // Using same register-logic but with is_guest = true
        const guestReq = {
          body: {
            user_email,
            is_guest: true,
          },
        };

        // Simulate register-call for guest
        const existingUser = await this.db.query(
          "POST",
          req.url,
          "SELECT id, user_email FROM users WHERE user_email = :user_email AND user_password_hash IS NULL",
          { user_email }
        );

        if (existingUser.length > 0) {
          return res.json({
            success: true,
            user: existingUser[0],
            is_guest: true,
          });
        }

        // Create new guest
        const result = await this.db.query(
          "POST",
          req.url,
          `INSERT INTO users (user_email, user_password_hash, user_name, user_phoneNumber)
         VALUES (:user_email, NULL, NULL, NULL)`,
          { user_email }
        );

        const newGuest = await this.db.query(
          "GET",
          req.url,
          `SELECT id, user_email FROM users WHERE id = :id`,
          { id: result.insertId }
        );

        res.json({
          success: true,
          user: newGuest[0],
          is_guest: true,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Kunde inte skapa gästanvändare" });
      }
    });
  }

  // Route to hold/release seats in-memory via sseRegistry
  addSeatHoldRoute() {
    // Handle temporary seat holds/releases for real-time seat selection
    // Uses in-memory storage via sseRegistry to prevent double bookings
    this.app.post(
      this.prefix + "screenings/:screeningId/seats/:seatId/hold",
      async (req, res) => {
        const screeningId = Number(req.params.screeningId);
        const seatId = Number(req.params.seatId);
        const { action, sessionId } = req.body || {};

        if (
          !screeningId ||
          !seatId ||
          !["hold", "release", "extend"].includes(action) ||
          !sessionId
        ) {
          return res.status(400).json({ error: "Ogiltigt anrop" });
        }

        try {
          // Block if permanently booked
          const booked = await this.db.query(
            "POST",
            req.url,
            `SELECT seat_id
           FROM bookingsXseats
           WHERE screening_id = :screening_id
             AND seat_id = :seat_id
           LIMIT 1`,
            { screening_id: screeningId, seat_id: seatId }
          );
          if (booked.length > 0) {
            return res
              .status(409)
              .json({ error: "Denna plats är redan bokad." });
          }

          if (action === "hold") {
            const result = holdSeat(screeningId, seatId, sessionId);
            if (!result?.ok) {
              return res.status(409).json({
                error: "Platsen är tillfälligt upptagen av en annan användare.",
              });
            }
            return res.json({
              ok: true,
              action: "hold",
              expiresAt: result.expiresAt,
            });
          }

          if (action === "extend") {
            const result = holdSeat(screeningId, seatId, sessionId, {
              extend: true,
            });
            if (!result?.ok) {
              return res.status(409).json({
                error: "Hold saknas eller innehas av annan användare.",
              });
            }
            return res.json({
              ok: true,
              action: "extend",
              expiresAt: result.expiresAt,
            });
          }

          if (action === "release") {
            releaseSeat(screeningId, seatId, sessionId);
            return res.json({ ok: true, action: "release" });
          }
        } catch (err) {
          console.error("Fel i seat-hold-route:", err);
          return res
            .status(500)
            .json({ error: "Kunde inte uppdatera sätes-hold." });
        }
      }
    );
  }

  addBookingRoute() {
    // Handle booking creation for both logged-in users and guests
    // Includes validation, seat availability checks, and email confirmation
    this.app.post(this.prefix + "makeBooking", async (req, res) => {
      try {
        const { screening_id, seats, guest_email } = req.body;
        const isGuestBooking = !!guest_email;

        let user_id;

        if (guest_email) {
          // Create or get guest user
          const guestResult = await this.db.query(
            "POST",
            req.url,
            "SELECT id FROM users WHERE user_email = :guest_email AND user_password_hash IS NULL",
            { guest_email }
          );

          if (guestResult.length > 0) {
            user_id = guestResult[0].id;
          } else {
            // Create new guest user
            const newGuest = await this.db.query(
              "POST",
              req.url,
              "INSERT INTO users (user_email, user_password_hash) VALUES (:guest_email, NULL)",
              { guest_email }
            );
            user_id = newGuest.insertId;
          }

          //Set session user for guest so authorization works
          req.session.user = {
            id: user_id,
            user_email: guest_email,
            is_guest: true,
          };
        } else {
          // Normal booking for logged-in user
          if (!req.session.user || !req.session.user.id) {
            return res.status(401).json({ error: "Ej inloggad" });
          }
          user_id = req.session.user.id;
        }

        // --- Validation ---
        if (!screening_id || !Array.isArray(seats) || seats.length === 0) {
          return res.status(400).json({
            error: "Du måste ange screening_id och minst en stol.",
          });
        }

        for (const seat of seats) {
          if (!seat.seat_id || !seat.ticketType_id) {
            return res.status(400).json({
              error: "Varje seat måste ha seat_id och ticketType_id.",
            });
          }
        }

        // --- Check if user exists ---
        const userCheck = await this.db.query(
          "POST",
          req.url,
          "SELECT id FROM users WHERE id = :user_id",
          { user_id }
        );

        if (userCheck.length === 0) {
          return res.status(404).json({ error: "Användaren finns inte." });
        }

        // --- Check if screening exists ---
        const screening = await this.db.query(
          "POST",
          req.url,
          "SELECT * FROM screenings WHERE id = :screening_id",
          { screening_id }
        );

        if (!screening.length) {
          return res.status(404).json({ error: "Visningen finns inte." });
        }

        const screeningTimeRaw = screening[0].screening_time;
        const screeningTime = new Date(screeningTimeRaw).toLocaleString(
          "sv-SE",
          {
            dateStyle: "medium",
            timeStyle: "short",
          }
        );

        // --- Check free seats ---
        const requestedSeatIds = seats.map((s) => Number(s.seat_id));

        // Check for doubles in payload
        const seatIdSet = new Set();
        const duplicates = [];
        requestedSeatIds.forEach((id) => {
          if (seatIdSet.has(id)) duplicates.push(id);
          else seatIdSet.add(id);
        });

        if (duplicates.length > 0) {
          return res.status(400).json({
            error: `Dubbletter i anropet: stol ${duplicates.join(", ")}.`,
          });
        }

        // Get booked seats
        const booked = await this.db.query(
          "POST",
          req.url,
          "SELECT seat_id FROM bookingsXseats WHERE screening_id = :screening_id",
          { screening_id }
        );

        const bookedSeats = new Set(booked.map((r) => Number(r.seat_id)));
        const conflicts = requestedSeatIds.filter((id) => bookedSeats.has(id));

        if (conflicts.length > 0) {
          return res.status(409).json({
            error: `Följande stolar är redan bokade: ${conflicts.join(", ")}.`,
          });
        }

        // --- Calculate total cost ---
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
          (sum, s) => sum + (ticketMap[s.ticketType_id] || 0),
          0
        );

        // --- Create booking ---
        const crypto = await import("crypto");
        const confirmation = crypto.randomBytes(8).toString("hex");

        const bookingResult = await this.db.query(
          "POST",
          req.url,
          `INSERT INTO bookings (booking_time, booking_confirmation, screening_id, user_id)
         VALUES (NOW(), :confirmation, :screening_id, :user_id)`,
          { confirmation, screening_id, user_id }
        );

        let booking_id;

        if (bookingResult && bookingResult.insertId) {
          booking_id = bookingResult.insertId;
        } else if (bookingResult && bookingResult.insertid) {
          booking_id = bookingResult.insertid;
        } else if (bookingResult && bookingResult.lastID) {
          booking_id = bookingResult.lastID;
        } else {
          const lastBooking = await this.db.query(
            "POST",
            req.url,
            "SELECT id FROM bookings WHERE user_id = :user_id ORDER BY id DESC LIMIT 1",
            { user_id }
          );
          booking_id = lastBooking[0]?.id;
        }

        if (!booking_id) {
          throw new Error("Kunde inte hämta booking_id från insert-operation");
        }

        // --- Reserve seats ---
        for (const s of seats) {
          const seatResult = await this.db.query(
            "POST",
            req.url,
            `INSERT INTO bookingsXseats (screening_id, seat_id, ticketType_id, booking_id)
           VALUES (:screening_id, :seat_id, :ticketType_id, :booking_id)`,
            {
              screening_id,
              seat_id: s.seat_id,
              ticketType_id: s.ticketType_id,
              booking_id: booking_id,
            }
          );
        }
        // 8. Get details for email
        const movieDetails = await this.db.query(
          "GET",
          req.url,
          `SELECT m.movie_title, a.auditorium_name
           FROM screenings s
           JOIN movies m ON s.movie_id = m.id
           JOIN auditoriums a ON s.auditorium_id = a.id
           WHERE s.id = :screening_id`,
          { screening_id }
        );
        const { movie_title, auditorium_name } = movieDetails[0];

        const seatDetails = await this.db.query(
          "GET",
          req.url,
          `SELECT s.row_index, s.seat_number, tt.ticketType_name
           FROM bookingsXseats bxs
           JOIN seats s ON bxs.seat_id = s.id
           JOIN ticketTypes tt ON bxs.ticketType_id = tt.id
           WHERE bxs.booking_id = :booking_id
           ORDER BY s.row_index, s.seat_number`,
          { booking_id }
        );

        //  Change seats to A1, A2 etc
        const formattedSeats = seatDetails
          .map((s) => {
            const rowLetter = this.getRowLetter(s.row_index);
            return `${rowLetter}${s.seat_number}`;
          })
          .join(", ");

        const recipientEmail = guest_email || req.session.user.user_email;
        // Note: formattedScreeningTime moves up and defines here to avoid  'not defined'-error
        const formattedScreeningTime = new Date(
          screeningTimeRaw
        ).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" });

        // 9. Send email
        if (recipientEmail) {
          try {
            await sendBookingEmail({
              to: recipientEmail,
              confirmation: confirmation,
              movieTitle: movie_title,
              auditoriumName: auditorium_name,
              seatList: formattedSeats,
              screeningTime: formattedScreeningTime,
              totalPrice: totalPrice,
            });
          } catch (emailError) {
            console.error("Kunde INTE skicka bekräftelsemejl:", emailError);
          }
        }

        if (isGuestBooking) {
          const guestSessionData = { ...req.session.user };

          delete req.session.user;
        }

        // Send live updates to everyone + clean up holds for seats
        const seatIdsJustBooked = seats.map((s) => Number(s.seat_id));

        // 1) Broadcast "seat:booked"
        broadcast(Number(screening_id), "seat:booked", {
          seatIds: seatIdsJustBooked,
        });

        // 2) Removes eventual holds for snapshot without spamming 'seat:released'
        clearHolds(Number(screening_id), seatIdsJustBooked);

        res.status(201).json({
          message: guest_email ? "Gästbokning skapad!" : "Bokning skapad!",
          booking_id: booking_id,
          booking_confirmation: confirmation,
          total_price: totalPrice,
          screening_id,
          screening_time: screeningTime,
          seats,
          is_guest: !!guest_email,
        });
      } catch (err) {
        console.error("Booking error:", err);

        const status = err.status || 500;
        let errorMessage = err.message || "Internt serverfel.";

        if (err.message && err.message.includes("foreign key constraint")) {
          if (err.message.includes("user_id")) {
            errorMessage =
              "Ogiltigt användar-ID. Kontrollera att du är inloggad.";
          } else if (err.message.includes("screening_id")) {
            errorMessage = "Ogiltigt screening-ID.";
          }
        }

        res.status(status).json({
          error: errorMessage,
          details:
            process.env.NODE_ENV === "development" ? err.stack : undefined,
        });
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
    // get all posts in a table, or filtered posts if search parameters are provided in the URL
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
