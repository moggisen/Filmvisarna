import session from "express-session";
import sessionStore from "../helpers/sessionStore.js";
import Acl from "./Acl.js";
import PasswordEncryptor from "../helpers/PasswordEncryptor.js";
import rateLimit from "express-rate-limit";

export default class LoginHandler {
  constructor(restApi) {
    // transfer settings from restApi.settings to instance properties
    Object.assign(this, restApi.settings);
    // set some other properties from the restApi
    this.restApi = restApi;
    this.app = restApi.app;
    this.prefix = restApi.prefix;
    this.db = restApi.db;
    // start session handling and add login/logout routes
    this.setupSessionHandling();
    // add acl middleware for route protection
    Acl.addMiddleware(restApi);
    // add login routes
    this.addPostRoute();
    this.addGetRoute();
    this.addDeleteRoute();
  }

  setupSessionHandling() {
    this.app.use(
      session({
        secret: this.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: false,
          sameSite: "lax",
        },
        store: sessionStore(this.restApi.settings, session),
      })
    );
  }

  // Post route -> Used to LOGIN
  addPostRoute() {
    // Creating a limiter for the attempts to login, after set max-attempts user gets locked out for set amount of time
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5000000, // max X login attempts  <--------- ÄNDRA DETTA ----------------------------------------------------------------------------------
      message: {
        error: "För många inloggningsförsök, försök igen om 15 minuter",
      },
    });

    // Note: This code would have been slightly easer to read if we
    // had hardcoded userTableName, userNameField and passwordFieldName
    // (but we don't - for flexibility they are set in the settings.json file)
    this.app.post(this.prefix + "login", loginLimiter, async (req, res) => {
      // If a user is already logged in, then do not allow login
      if (req.session.user) {
        this.restApi.sendJsonResponse(res, {
          error: "Someone is already logged in.",
        });
        return;
      }
      // get the user from the db
      const result = await this.db.query(
        req.method,
        req.url,
        /*sql*/ `
        SELECT * FROM ${this.userTableName}
        WHERE ${this.userNameField} = :${this.userNameField}
      `,
        { [this.userNameField]: req.body[this.userNameField] }
      );
      const foundDbUser = result[0] || null;
      // if the user is not  found return an error
      if (!foundDbUser) {
        this.restApi.sendJsonResponse(res, {
          error: "Ogiltigt användarnamn eller lösenord",
        });
        return;
      }
      // get the name of the db field with the password
      let passwordFieldlName = Object.keys(foundDbUser).find((key) =>
        this.passwordFieldNames.includes(key)
      );
      // check if the password matches the stored encrypted one
      if (
        !(await PasswordEncryptor.check(
          req.body[passwordFieldlName],
          foundDbUser[passwordFieldlName]
        ))
      ) {
        this.restApi.sendJsonResponse(res, {
          error: "Ogiltigt användarnamn eller lösenord",
        });
        return;
      }
      // the user has successfully logged in, store in req.session.user
      // (but without password) and send user data as resposne
      delete foundDbUser[passwordFieldlName];
      req.session.user = foundDbUser;
      this.restApi.sendJsonResponse(res, foundDbUser);
    });
  }

  // Get route -> used to check if we have a logged in user
  // (return the user property of our session)
  addGetRoute() {
    this.app.get(this.prefix + "login", (req, res) =>
      this.restApi.sendJsonResponse(
        res,
        req.session.user || { error: "Not logged in." }
      )
    );
  }

  // Delete route -> used to LOGOUT
  // (delete the user property of our session)
  addDeleteRoute() {
    this.app.delete(this.prefix + "login", (req, res) =>
      this.restApi.sendJsonResponse(
        res,
        req.session.user
          ? delete req.session.user && { success: "Logged out successfully." }
          : { error: "No user logged in." }
      )
    );
  }
}
