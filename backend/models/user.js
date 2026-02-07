const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // New Fields for Profile Page
  company: { type: String },
  role: { type: String },
  bio: { type: String },
  website: { type: String },
  socials: {
    linkedin: { type: String, default: "" },
    twitter: { type: String, default: "" },
    github: { type: String, default: "" },
    instagram: { type: String, default: "" }
  },

  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);