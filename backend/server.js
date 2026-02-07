require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const contactRoutes = require('./routes/contacts');
const sendRoute = require("./routes/send");

// --- IMPORT USER MODEL (REQUIRED for Profile Updates) ---
// Make sure this path matches where your User.js file actually is!
const User = require("./models/user");

const app = express();

// Connect DB
connectDB();

// Middleware
app.use(cors({
  origin: "http://localhost:5173"
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- ROUTES ---
app.use("/api/auth", authRoutes);
app.use('/api/contacts', contactRoutes);
app.use("/api/send", sendRoute);

// --- NEW: UPDATE PROFILE ROUTE ---
// backend/server.js (Update the profile route)

app.put("/api/user/profile", async (req, res) => {
  // 1. Destructure ALL the new fields
  const { email, name, company, role, bio, website, socials } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Update fields
    user.name = name || user.name;
    user.company = company || user.company;
    user.role = role || user.role;
    user.bio = bio || user.bio;
    user.website = website || user.website;
    user.socials = socials || user.socials; // Save the social object

    const updatedUser = await user.save();

    res.json({
      message: "Profile updated!",
      user: {
        name: updatedUser.name,
        company: updatedUser.company,
        role: updatedUser.role,
        bio: updatedUser.bio,
        website: updatedUser.website,
        socials: updatedUser.socials
      }
    });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running 🚀" });
});

// Start server
const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});