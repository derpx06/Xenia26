const router = require("express").Router();
const Contact = require("../models/Contact");

// 1. GET ALL CONTACTS
// URL: http://localhost:8080/api/contacts
router.get("/", async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.status(200).json(contacts);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 2. ADD NEW CONTACT
// URL: http://localhost:8080/api/contacts
// ⚠️ MAKE SURE THIS IS "/" AND NOT "/:userId"
router.post("/", async (req, res) => {
    try {
        const newContact = new Contact(req.body);
        const savedContact = await newContact.save();
        res.status(200).json(savedContact);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 3. DELETE CONTACT
router.delete("/:id", async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.status(200).json("Contact has been deleted...");
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;