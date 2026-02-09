console.log("🏁 Starting server.js...");
require("dotenv").config();
console.log("✅ Dotenv loaded");
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const contactRoutes = require('./routes/contacts');
const sendRoute = require("./routes/send");
const userRoutes = require("./routes/user");

// User model moved to routes/user.js

const app = express();

// Connect DB
console.log("🔌 Connecting to DB...");
connectDB();
console.log("🛰️ DB connection initiated (async)");

// Middleware
app.use(cors({
  origin: "http://localhost:5173"
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- ROUTES ---
console.log("🛣️ Setting up routes...");
app.use("/api/auth", authRoutes);
app.use('/api/contacts', contactRoutes);
app.use("/api/send", sendRoute);
app.use("/api/user", userRoutes);
console.log("✅ Routes set up");

// Profile routes moved to routes/user.js

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running 🚀" });
});

// Start server
const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});