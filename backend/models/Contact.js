const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
    // 1. Remove 'required: true' so you don't need a login
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false // <--- CHANGED THIS
    },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    role: { type: String },
    company: { type: String },
    linkedinUrl: { type: String },
    notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Contact", ContactSchema);