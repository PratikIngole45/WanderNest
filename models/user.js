const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
    email:{
        type:String,
        required:true,
    },
    fullName: String,
    age: Number,
    bio: String,
    image: String,
    savedListings: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
    // In models/user.js
    resetPasswordToken: String,
    resetPasswordExpires: Date,
})

userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);