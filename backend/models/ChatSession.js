const mongoose = require("mongoose");

const ChatSessionSchema = new mongoose.Schema({
    userEmail: { type: String, required: true, index: true },
    agentType: { type: String, enum: ["outreach", "writer"], default: "outreach", index: true },
    title: { type: String, default: "New Chat", trim: true },
    messages: [{
        id: String,
        role: { type: String, required: true }, // 'user' | 'assistant'
        content: { type: String, default: "" },
        // Optional fields for rich content/logic
        type: { type: String, default: "text" },
        image: String,
        tool_calls: Array,
        tool_results: Array,
        thoughts: Array,
        generated_content: Object, // Structured content (email/whatsapp/etc objects)
        writer_brief: Object,
        active_node: String,
        timestamp: { type: Date, default: Date.now }
    }],
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Composite index for fetching user's sessions quickly by type and date
ChatSessionSchema.index({ userEmail: 1, agentType: 1, lastUpdated: -1 });

module.exports = mongoose.model("ChatSession", ChatSessionSchema);
