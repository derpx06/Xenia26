const router = require("express").Router();
const nodemailer = require("nodemailer");

// ⚠️ REPLACE THESE WITH YOUR REAL APP PASSWORD ⚠️
// Go to Google Account > Security > 2-Step Verification > App Passwords
const SENDER_EMAIL = process.env.EMAIL_USER;
const APP_PASSWORD = process.env.EMAIL_PASS; // The 16-digit code, NOT your normal password

router.post("/email", async (req, res) => {
    const { to, subject, text, attachments } = req.body;

    console.log(`📧 Sending email to: ${to} with ${attachments?.length || 0} attachments`);

    // Validation
    if (!to || (!text && (!attachments || attachments.length === 0))) {
        return res.status(400).json({ message: "Missing 'to' or content ('text'/'attachments')" });
    }

    try {
        // 1. Setup the Transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: SENDER_EMAIL,
                pass: APP_PASSWORD,
            },
        });

        // 2. Configure the Email
        const mailOptions = {
            from: `"Outreach AI" <${SENDER_EMAIL}>`, // Shows as "Outreach AI" in inbox
            to: to,
            subject: subject || "Quick Question",
            text: text || " ",
            attachments: attachments ? attachments.map((att, index) => ({
                path: att // Nodemailer handles data URIs directly if passed as 'path' 
            })) : []
        };

        // 3. Send It
        const info = await transporter.sendMail(mailOptions);

        console.log("Email sent: " + info.response);
        res.status(200).json({ success: true, message: "Email sent successfully!" });

    } catch (err) {
        console.error("Email Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;