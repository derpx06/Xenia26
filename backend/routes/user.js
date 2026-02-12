const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Contact = require("../models/Contact");
const multer = require("multer");

// Configure Multer for memory storage (store as Buffer in MongoDB)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB
});

const sanitizeString = (value) => {
    if (typeof value !== "string") return "";
    return value.trim();
};

const normalizeEmail = (value) => sanitizeString(value).toLowerCase();

const normalizeSocials = (socials = {}) => ({
    linkedin: sanitizeString(socials.linkedin),
    twitter: sanitizeString(socials.twitter),
    github: sanitizeString(socials.github),
    instagram: sanitizeString(socials.instagram),
});

// @route   GET /api/user/profile/:email
// @desc    Fetch user profile
router.get("/profile/:email", async (req, res) => {
    try {
        const user = await User.findOne({ email: normalizeEmail(req.params.email) });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            user: {
                name: user.name || "",
                email: user.email || "",
                company: user.company || "",
                role: user.role || "",
                bio: user.bio || "",
                website: user.website || "",
                socials: {
                    linkedin: user.socials?.linkedin || "",
                    twitter: user.socials?.twitter || "",
                    github: user.socials?.github || "",
                    instagram: user.socials?.instagram || ""
                },
                voiceProfile: !!user.voiceProfile
            }
        });
    } catch (error) {
        console.error("Profile Fetch Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// @route   GET /api/user/snapshot/:email
// @desc    Fetch complete user-scoped snapshot (profile + contacts)
router.get("/snapshot/:email", async (req, res) => {
    try {
        const email = normalizeEmail(req.params.email);
        const user = await User.findOne({ email }).lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const contacts = await Contact.find({ userId: user._id })
            .sort({ updatedAt: -1 })
            .lean();

        res.json({
            profile: {
                name: user.name || "",
                email: user.email || "",
                company: user.company || "",
                role: user.role || "",
                bio: user.bio || "",
                website: user.website || "",
                socials: {
                    linkedin: user.socials?.linkedin || "",
                    twitter: user.socials?.twitter || "",
                    github: user.socials?.github || "",
                    instagram: user.socials?.instagram || ""
                },
                voiceProfile: !!user.voiceProfile,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
            contacts,
            meta: {
                contactCount: contacts.length,
                synchronizedAt: new Date().toISOString(),
            }
        });
    } catch (error) {
        console.error("Snapshot Fetch Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
router.put("/profile", async (req, res) => {
    const { email, name, company, role, bio, website, socials } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Deterministic updates: preserve explicit empty strings instead of falling back silently.
        if (name !== undefined) user.name = sanitizeString(name);
        if (company !== undefined) user.company = sanitizeString(company);
        if (role !== undefined) user.role = sanitizeString(role);
        if (bio !== undefined) user.bio = sanitizeString(bio);
        if (website !== undefined) user.website = sanitizeString(website);
        if (socials !== undefined) user.socials = normalizeSocials(socials);

        if (!user.name) {
            return res.status(400).json({ message: "Name is required" });
        }

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
    const email = normalizeEmail(req.body?.email);

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    if (!req.file || !req.file.buffer?.length) {
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
        const user = await User.findOne({ email: normalizeEmail(req.params.email) });

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
