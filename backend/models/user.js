const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },

  // New Fields for Profile Page
  company: { type: String, default: "", trim: true },
  role: { type: String, default: "", trim: true },
  bio: { type: String, default: "", trim: true },
  website: { type: String, default: "", trim: true },
  socials: {
    linkedin: { type: String, default: "", trim: true },
    twitter: { type: String, default: "", trim: true },
    github: { type: String, default: "", trim: true },
    instagram: { type: String, default: "", trim: true }
  },

  // New Field for Voice Intro
  voiceProfile: {
    data: Buffer,
    contentType: String
  },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("User", UserSchema);
