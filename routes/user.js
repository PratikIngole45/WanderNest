const express = require("express");
const { cloudinary } = require("../cloudConfig");
const wrapAsync = require("../utils/wrapAsync");
const router = express.Router();
const User = require("../models/user.js");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");
const Listing = require("../models/index");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
// const passportLocalMongoose = require('passport-local-mongoose');

// Cloudinary Configuration
const {storage} = require("../cloudConfig.js");
const multer = require("multer")
const upload = multer({storage});

const userController = require("../controllers/users.js");

// Authentication Routes
router.route("/signup")
    .get(userController.renderSignupForm)
    .post(wrapAsync(userController.signup));

router.route("/login")
    .get(userController.renderLoginForm)
    .post(
        saveRedirectUrl, 
        passport.authenticate("local", { 
            failureRedirect: "/login",
            failureFlash: true 
        }), 
        userController.login
    );

router.get("/logout", isLoggedIn, userController.logout);

// Profile Routes
router.get('/profile', isLoggedIn, async (req, res) => {
    const user = await User.findById(req.user._id); // Using req.user from passport
    res.render('users/profile', { user });
});

router.post('/profile', isLoggedIn, upload.single('profilePic'), async (req, res) => {
    try {
        const { fullName, age, bio, email } = req.body;
        const updateData = { fullName, age, bio, email };

        if (req.file) {
            updateData.image = req.file.path; // This is the Cloudinary URL
        }

        await User.findByIdAndUpdate(req.user._id, updateData);
        req.flash('success', 'Profile updated successfully!');
        res.redirect('/profile');
    } catch (e) {
        console.error(e);
        req.flash('error', 'Failed to update profile');
        res.redirect('/profile');
    }
});

// Listing Routes
router.get("/my-listings", isLoggedIn, async (req, res) => {
    const listings = await Listing.find({ owner: req.user._id }).populate('owner');
    res.render("listings/myListings", { listings }); // Corrected path to listings folder
});

// Saved Properties Routes
router.get("/saved-properties", isLoggedIn, async (req, res) => {
    const user = await User.findById(req.user._id).populate("savedListings");
    res.render("users/savedProperties", { listings: user.savedListings });
});

// Account Settings Routes
router.get("/account-settings", isLoggedIn, async (req, res) => {
    const user = await User.findById(req.user._id);
    res.render("users/accountSettings", { user });
});
router.post('/account-settings/email', async (req, res) => {
  const userId = req.user._id; // Use req.user if using Passport
  const { newEmail } = req.body;

  try {
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      req.flash('error', 'This email is already in use.');
      return res.redirect('/account-settings');
    }

    await User.findByIdAndUpdate(userId, { email: newEmail });
    req.flash('success', 'Email updated successfully.');
    res.redirect('/account-settings');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong.');
    res.redirect('/account-settings');
  }
});

router.post("/account-settings/password", isLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        const isMatch = await user.authenticate(currentPassword);
        if (!isMatch.user) {
            req.flash('error', 'Current password is incorrect');
            return res.redirect("/account-settings");
        }

        user.setPassword(newPassword, async (err) => {
            if (err) {
                req.flash('error', 'Failed to update password');
                return res.redirect("/account-settings");
            }
            await user.save();
            req.flash('success', 'Password updated successfully!');
            res.redirect("/account-settings");
        });
    } catch (e) {
        console.error(e);
        req.flash('error', 'Failed to update password');
        res.redirect("/account-settings");
    }
});
//account delete
router.post('/account-settings/delete', isLoggedIn, async (req, res) => {
  const userId = req.user._id;
  const { deletePassword } = req.body;

  try {
    const user = await User.findById(userId);
    // Use passport-local-mongoose's authenticate method
    user.authenticate(deletePassword, async (err, result) => {
      if (err || !result) {
        req.flash('error', 'Incorrect password. Account not deleted.');
        return res.redirect('/account-settings');
      }
      await User.findByIdAndDelete(userId);
      req.logout(() => {
        req.flash('success', 'Account deleted successfully.');
        res.redirect('/login');
      });
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong.');
    res.redirect('/account-settings');
  }
});
// Show forgot password form
router.get('/forgot-password', (req, res) => {
    res.render('users/forgot-password', { currentPath: req.path });
});

// Handle forgot password form submission
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always show the same message, whether user exists or not
    req.flash('success', 'If an account with that email exists, a reset link has been sent.');

    if (!user) {
        return res.redirect('/forgot-password');
    }

    // Generate token
    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        }
    });

    const resetURL = `http://${req.headers.host}/reset-password/${token}`;
    const mailOptions = {
        to: user.email,
        from: 'passwordreset@wanderlust.com',
        subject: 'Password Reset',
        text: `You requested a password reset. Click the link to reset: ${resetURL}`
    };

    await transporter.sendMail(mailOptions);

    res.redirect('/login');
});

// Show reset password form
router.get('/reset-password/:token', async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) {
        req.flash('error', 'Password reset token is invalid or has expired.');
        return res.redirect('/forgot-password');
    }
    res.render('users/reset-password', { token: req.params.token });
});

// Handle reset password form submission
router.post('/reset-password/:token', async (req, res) => {
    const user = await User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) {
        req.flash('error', 'Password reset token is invalid or has expired.');
        return res.redirect('/forgot-password');
    }

    user.setPassword(req.body.password, async (err) => {
        if (err) {
            req.flash('error', 'Error resetting password.');
            return res.redirect('/forgot-password');
        }
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        req.flash('success', 'Your password has been reset. You can now log in.');
        res.redirect('/login');
    });
});


module.exports = router;