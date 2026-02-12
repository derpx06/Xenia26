const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
    // 1. Remove 'required: true' so you don't need a login
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false // <--- CHANGED THIS
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    role: { type: String, default: "", trim: true },
    company: { type: String, default: "", trim: true },
    linkedinUrl: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
}, { timestamps: true });

// User-scoped retrieval performance + consistency.
ContactSchema.index({ userId: 1, updatedAt: -1 });
ContactSchema.index({ userId: 1, email: 1 });

module.exports = mongoose.model("Contact", ContactSchema);
