const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/user");

const router = express.Router();
const sanitizeString = (v) => (typeof v === "string" ? v.trim() : "");
const normalizeEmail = (v) => sanitizeString(v).toLowerCase();

/**
 * =========================
 * REGISTER USER
 * =========================
 */
router.post("/register", async (req, res) => {
  try {
    console.log("REGISTER BODY:", req.body);

    const name = sanitizeString(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    await User.create({
      name,
      email,
      password: hashedPassword
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful"
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    // MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * =========================
 * LOGIN USER
 * =========================
 */
router.post("/login", async (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body);

    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    return res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
