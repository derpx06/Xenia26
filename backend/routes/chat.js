const express = require("express");
const router = express.Router();
const ChatSession = require("../models/ChatSession");

const normalizeAgentType = (value) => {
    const v = String(value || "").trim().toLowerCase();
    return v === "writer" ? "writer" : "outreach";
};

const buildAgentTypeFilter = (agentType) => {
    if (agentType === "writer") return { agentType: "writer" };
    // Backward compatibility: old sessions may not have agentType yet.
    return { $or: [{ agentType: "outreach" }, { agentType: { $exists: false } }, { agentType: null }] };
};

// GET /sessions: Fetch list of chat sessions for a user
router.get("/sessions", async (req, res) => {
    try {
        const userEmail = req.query.email;
        const agentType = normalizeAgentType(req.query.agentType);
        if (!userEmail) return res.status(400).json({ message: "Email is required" });

        // Fetch only essential fields for the list view
        const sessions = await ChatSession.find({ userEmail, ...buildAgentTypeFilter(agentType) })
            .select("title lastUpdated createdAt agentType")
            .sort({ lastUpdated: -1 })
            .limit(50); // Limit to recent 50

        res.json(sessions);
    } catch (err) {
        console.error("Error fetching sessions:", err);
        res.status(500).json({ message: "Failed to fetch sessions" });
    }
});

// GET /sessions/:id: Fetch full session details
router.get("/sessions/:id", async (req, res) => {
    try {
        const agentType = normalizeAgentType(req.query.agentType);
        const session = await ChatSession.findOne({ _id: req.params.id, ...buildAgentTypeFilter(agentType) });
        if (!session) return res.status(404).json({ message: "Session not found" });
        res.json(session);
    } catch (err) {
        console.error("Error fetching session:", err);
        res.status(500).json({ message: "Failed to fetch session" });
    }
});

// POST /sessions: Create a new chat session
router.post("/sessions", async (req, res) => {
    try {
        const { userEmail, title, messages, agentType: incomingAgentType } = req.body;
        if (!userEmail) return res.status(400).json({ message: "Email is required" });
        const agentType = normalizeAgentType(incomingAgentType);

        const newSession = new ChatSession({
            userEmail,
            agentType,
            title: title || "New Chat",
            messages: messages || []
        });

        const savedSession = await newSession.save();
        res.status(201).json(savedSession);
    } catch (err) {
        console.error("Error creating session:", err);
        res.status(500).json({ message: "Failed to create session" });
    }
});

// PUT /sessions/:id: Update session (add messages, rename)
router.put("/sessions/:id", async (req, res) => {
    try {
        const agentType = normalizeAgentType(req.query.agentType || req.body.agentType);
        const { messages, title } = req.body;
        const updateData = { lastUpdated: Date.now() };

        if (messages) updateData.messages = messages;
        if (title) updateData.title = title;

        const updatedSession = await ChatSession.findOneAndUpdate(
            { _id: req.params.id, ...buildAgentTypeFilter(agentType) },
            { $set: updateData },
            { new: true }
        );

        if (!updatedSession) return res.status(404).json({ message: "Session not found" });
        res.json(updatedSession);
    } catch (err) {
        console.error("Error updating session:", err);
        res.status(500).json({ message: "Failed to update session" });
    }
});

// DELETE /sessions/:id: Delete a session
router.delete("/sessions/:id", async (req, res) => {
    try {
        const agentType = normalizeAgentType(req.query.agentType);
        const deletedSession = await ChatSession.findOneAndDelete({ _id: req.params.id, ...buildAgentTypeFilter(agentType) });
        if (!deletedSession) return res.status(404).json({ message: "Session not found" });
        res.json({ message: "Session deleted successfully" });
    } catch (err) {
        console.error("Error deleting session:", err);
        res.status(500).json({ message: "Failed to delete session" });
    }
});

module.exports = router;
