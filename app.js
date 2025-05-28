// Load environment variables from .env in development
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const Listing = require("./models/index.js");
const Review = require("./models/review.js");
const User = require("./models/user.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");

// Routes
const listingRouter = require("./routes/listing.js");
const reviewsRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// MongoDB connection
const dbUrl = process.env.ATLASDB_URL;
main().then(() => {
    console.log("Connected to DB.");
}).catch((err) => {
    console.log("DB Connection Error:", err);
});

async function main() {
    await mongoose.connect(dbUrl);
}

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// Static files and body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));

// Mongo Store for session
const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: { secret: process.env.SECRET},
    touchAfter: 24 * 3600,
    ttl: 7 * 24 * 60 * 60,
    autoRemove: 'native'
});
store.on("error", (err) => {
    console.log("MongoStore Error:", err);
});

// Session configuration
const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
};

app.use(session(sessionOptions));
app.use(flash());

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware to pass flash & current user to all views
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user ||null;
    res.locals.currentPath = req.path;
    // console.log("Current User in middleware:", req.user);
    next();
});

//new code heree added 

app.get("/", (req, res) => {
    res.redirect("/listings");
});

// Use routes
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/", userRouter);

app.get('/search', async (req, res) => {
  const query = req.query.q || '';
  const minPrice = parseInt(req.query.minPrice) || 0;
  const maxPrice = parseInt(req.query.maxPrice) || Infinity;
  const category = req.query.category || '';
  const sort = req.query.sort || '';

  const filter = {
    price: { $gte: minPrice, $lte: maxPrice },
    $or: [
      { location: { $regex: query, $options: 'i' } },
      { title: { $regex: query, $options: 'i' } }
    ]
  };

  if (category) {
    filter.category = category; 
  }

  let sortOption = {};
  if (sort === 'priceAsc') sortOption.price = 1;
  else if (sort === 'priceDesc') sortOption.price = -1;

  try {
    const listing = await Listing.find(filter).sort(sortOption);
    res.render('searchResults.ejs', {
      listing,
      query,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      category,
      sort,
      currentPath: '/search'
    });
  } catch (err) {
    console.error(err);
    res.send('Search failed');
  }
});


// Catch-all for unmatched routes
app.all("*", (req, res, next) => {
    next(new ExpressError(404, "PAGE NOT FOUND!"));
});

// Error handler
app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("error.ejs", { message });
});

// Start server
app.listen(8080, () => {
    console.log("Server listening on port 8080");
});
