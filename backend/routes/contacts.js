const router = require("express").Router();
const Contact = require("../models/Contact");

// 1. GET ALL CONTACTS
// URL: http://localhost:8080/api/contacts
router.get("/", async (req, res) => {
    try {
        // If you implement user-specific contacts later:
        // const contacts = await Contact.find({ userId: req.query.userId }).sort({ createdAt: -1 });
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.status(200).json(contacts);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 2. ADD NEW CONTACT
router.post("/", async (req, res) => {
    try {
        const newContact = new Contact(req.body);
        const savedContact = await newContact.save();
        res.status(200).json(savedContact);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 3. UPDATE CONTACT
router.put("/:id", async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Contact not found' });

        // Update fields if present in body
        if (req.body.name != null) contact.name = req.body.name;
        if (req.body.email != null) contact.email = req.body.email;
        if (req.body.phone != null) contact.phone = req.body.phone;
        if (req.body.linkedinUrl != null) contact.linkedinUrl = req.body.linkedinUrl;
        if (req.body.role != null) contact.role = req.body.role;
        if (req.body.company != null) contact.company = req.body.company;
        if (req.body.notes != null) contact.notes = req.body.notes;

        const updatedContact = await contact.save();
        res.status(200).json(updatedContact);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 4. DELETE CONTACT
router.delete("/:id", async (req, res) => {
    try {
        await Contact.findByIdAndDelete(req.params.id);
        res.status(200).json("Contact has been deleted...");
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;