const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");

let { isLoggedIn, isOwner, validateListing } = require("../middleware.js");

const listingController = require("../controllers/listings.js");

const {storage} = require("../cloudConfig.js");
const multer = require("multer")
const upload = multer({storage});

router.route("/")
    .get(wrapAsync(listingController.index))  //index route 
    .post(isLoggedIn, upload.single("listing[image]"),validateListing, wrapAsync(listingController.createListing))   // add new listing into the db 
    
//create new route
router.get("/new",isLoggedIn, listingController.renderNewForm);

router.route("/:id")
    .get(wrapAsync(listingController.showListing))   //show route
    .put(isLoggedIn, isOwner,upload.single("listing[image]"), validateListing,wrapAsync(listingController.updateListing)) //update route
    .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));    //delete route

//edit route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));

// router.get('/search', listingController.searchListings);

module.exports = router;