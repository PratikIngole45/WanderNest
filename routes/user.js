const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const router = express.Router();
const User = require("../models/user.js");
const passport = require("passport");
const{saveRedirectUrl, isLoggedIn} = require("../middleware.js");

const userController = require("../controllers/users.js");
//for signup 
router.route("/signup")
    .get(userController.renderSignupForm)
    .post(wrapAsync(userController.signup));

//for login 
router.route("/login")
    .get(userController.renderLoginForm)
    .post(saveRedirectUrl, passport.authenticate("local", {failureRedirect: "/login",failureFlash: true }), userController.login);

//for logout

router.get("/logout", isLoggedIn, userController.logout)

module.exports=router;