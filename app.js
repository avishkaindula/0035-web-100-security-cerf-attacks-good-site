const path = require("path");

const express = require("express");
const session = require("express-session");
const mongodbStore = require("connect-mongodb-session");
const csrf = require("csurf");
// Unfortunately this csurf package is no longer maintained.
// Therefor we need to use an alternative to this package such as csrf-csrf package
// We can install that by typing npm install csrf-csrf on the terminal

const db = require("./data/database");
const demoRoutes = require("./routes/demo");

const MongoDBStore = mongodbStore(session);

const app = express();

const sessionStore = new MongoDBStore({
  uri: "mongodb+srv://avishka_indula:p7iGGaREtxbhN3t3@cluster0.ibnu8y4.mongodb.net/?retryWrites=true&w=majority",
  databaseName: "auth-demo",
  collection: "sessions",
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: "super-secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 2 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
      // Same-site cookies is a cookie configuration that can be set on the server side,
      // where browsers also assume certain default values if it's not explicity configured.
      // ex: chrome uses lax, but safari and firefox doesn't use lax as default.
      // Therefor, we need to set this sameSite value in order to make sure that the firefox and safari users
      // are also using lax. But Browsers like Internet Explorer still can't use lax.
      // Lax means cookies can be attached to requests that come from a different site but,
      // only if you visited that site from the main site.
      // So if we click on a link from an email instead of the main site, then the cookies
      // would not be attached to the outgoing request. So the post request sent from the "bad site"
      // to the localhost:3000/transaction route of the real website won't work.
      // In localhost, this is disabled. But that doesn't matter because we use localhost only for development.
    },
  })
);

// We need to add the csrf package after app.use(sessions) because csrf use sessions under the hood.
app.use(csrf());
// This will create csrf tokens
// These are random string values that are generated on the server side, which are known by the server and
// which are short lived. They only exist for one request cycle.
// These tokens are known to the server but the phishing attacker has no way of knowing this token.
// These tokens are injected to the templates that are rendered by the server via hidden input fields.
// And then for incoming requests, the server checks whether such a valid token is part of that request or not.
// As the phishing attacker has no way of re-creating those tokens, the post requests that are sent by the
// phishing attacker doesn't have these tokens. Therefor, the post requests send by phishing attackers are ignored.
// Now we need to register this csrf tokens for all the routes that contain templates with forms.
// We need to add csrf tokens to any request that manipulate something on the
// backend (Typically those are post requests) because those are the requests that are most vulnerable to csrf attacks.

app.use(async function (req, res, next) {
  const user = req.session.user;
  const isAuth = req.session.isAuthenticated;

  if (!user || !isAuth) {
    return next();
  }

  const userDoc = await db
    .getDb()
    .collection("users")
    .findOne({ _id: user.id });
  const isAdmin = userDoc.isAdmin;

  res.locals.isAuth = isAuth;
  res.locals.isAdmin = isAdmin;
  res.locals.user = user;

  next();
});

app.use(demoRoutes);

app.use(function (error, req, res, next) {
  res.render("500");
});

db.connectToDatabase().then(function () {
  app.listen(3000);
});
