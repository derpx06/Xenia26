const router = require("express").Router();
const Contact = require("../models/Contact");
const User = require("../models/user");

const sanitizeString = (value) => {
    if (typeof value !== "string") return "";
    return value.trim();
};

const normalizeContactPayload = (payload = {}) => ({
    name: sanitizeString(payload.name),
    email: sanitizeString(payload.email).toLowerCase(),
    phone: sanitizeString(payload.phone),
    linkedinUrl: sanitizeString(payload.linkedinUrl),
    role: sanitizeString(payload.role),
    company: sanitizeString(payload.company),
    notes: sanitizeString(payload.notes),
});

const normalizeEmail = (value) => sanitizeString(value).toLowerCase();

const getEmailFromRequest = (req) =>
    normalizeEmail(req.query?.email || req.headers["x-user-email"] || req.body?.userEmail);

const resolveUserFromRequest = async (req, res) => {
    const email = getEmailFromRequest(req);
    if (!email) {
        res.status(400).json({ message: "User email is required" });
        return null;
    }
    const user = await User.findOne({ email });
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return null;
    }
    return user;
};

// 1. GET ALL CONTACTS
// URL: http://localhost:8080/api/contacts
router.get("/", async (req, res) => {
    try {
        const user = await resolveUserFromRequest(req, res);
        if (!user) return;
        const contacts = await Contact.find({ userId: user._id }).sort({ createdAt: -1 });
        res.status(200).json(contacts);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 1b. GET ONE CONTACT (USER-SCOPED)
router.get("/:id", async (req, res) => {
    try {
        const user = await resolveUserFromRequest(req, res);
        if (!user) return;
        const contact = await Contact.findOne({ _id: req.params.id, userId: user._id });
        if (!contact) {
            return res.status(404).json({ message: "Contact not found" });
        }
        res.status(200).json(contact);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 2. ADD NEW CONTACT
router.post("/", async (req, res) => {
    try {
        const user = await resolveUserFromRequest(req, res);
        if (!user) return;
        const normalized = normalizeContactPayload(req.body);
        if (!normalized.name) {
            return res.status(400).json({ message: "Contact name is required" });
        }
        const newContact = new Contact({
            ...normalized,
            userId: user._id
        });
        const savedContact = await newContact.save();
        res.status(200).json(savedContact);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 3. UPDATE CONTACT
router.put("/:id", async (req, res) => {
    try {
        const user = await resolveUserFromRequest(req, res);
        if (!user) return;
        const contact = await Contact.findOne({ _id: req.params.id, userId: user._id });
        if (!contact) return res.status(404).json({ message: 'Contact not found' });

        const normalized = normalizeContactPayload(req.body);

        // Update fields if present in body
        if (req.body.name !== undefined) contact.name = normalized.name;
        if (req.body.email !== undefined) contact.email = normalized.email;
        if (req.body.phone !== undefined) contact.phone = normalized.phone;
        if (req.body.linkedinUrl !== undefined) contact.linkedinUrl = normalized.linkedinUrl;
        if (req.body.role !== undefined) contact.role = normalized.role;
        if (req.body.company !== undefined) contact.company = normalized.company;
        if (req.body.notes !== undefined) contact.notes = normalized.notes;

        if (!contact.name) {
            return res.status(400).json({ message: "Contact name is required" });
        }

        const updatedContact = await contact.save();
        res.status(200).json(updatedContact);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 4. DELETE CONTACT
router.delete("/:id", async (req, res) => {
    try {
        const user = await resolveUserFromRequest(req, res);
        if (!user) return;
        await Contact.findOneAndDelete({ _id: req.params.id, userId: user._id });
        res.status(200).json("Contact has been deleted...");
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;
