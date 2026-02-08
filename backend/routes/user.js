const express = require("express");
const router = express.Router();
const User = require("../models/user");
const multer = require("multer");

// Configure Multer for memory storage (store as Buffer in MongoDB)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB
});

// @route   PUT /api/user/profile
// @desc    Update user profile
router.put("/profile", async (req, res) => {
    const { email, name, company, role, bio, website, socials } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Update fields
        user.name = name || user.name;
        user.company = company || user.company;
        user.role = role || user.role;
        user.bio = bio || user.bio;
        user.website = website || user.website;
        user.socials = socials || user.socials;

        const updatedUser = await user.save();

        res.json({
            message: "Profile updated!",
            user: {
                name: updatedUser.name,
                company: updatedUser.company,
                role: updatedUser.role,
                bio: updatedUser.bio,
                website: updatedUser.website,
                socials: updatedUser.socials,
                voiceProfile: !!updatedUser.voiceProfile // Return true/false if voice exists
            }
        });

    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// @route   POST /api/user/voice
// @desc    Upload voice intro
router.post("/voice", upload.single("voice"), async (req, res) => {
    const { email } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.voiceProfile = {
            data: req.file.buffer,
            contentType: req.file.mimetype
        };

        await user.save();

        res.json({ message: "Voice intro uploaded successfully!" });

    } catch (error) {
        console.error("Voice Upload Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// @route   GET /api/user/voice/:email
// @desc    Get voice intro
router.get("/voice/:email", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email });

        if (!user || !user.voiceProfile || !user.voiceProfile.data) {
            return res.status(404).json({ message: "Voice intro not found" });
        }

        res.set("Content-Type", user.voiceProfile.contentType);
        res.send(user.voiceProfile.data);

    } catch (error) {
        console.error("Voice Fetch Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;
