const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

// Session for admin login
app.use(session({
    secret: "super-secret-key",
    resave: false,
    saveUninitialized: true
}));

// Store captured sessions in memory
let sessions = {}; // { sessionId: { userName, timestamp, accessed, images: [] } }

// Home page
app.get("/", (req, res) => res.render("index"));

// Capture page
app.get("/capture", (req, res) => res.render("capture"));

// Upload route (to Cloudinary)
app.post("/upload", async (req, res) => {
    const { image, name, type, sessionId } = req.body;
    if (!image || !name || !type || !sessionId) return res.sendStatus(400);

    try {
        // Upload image to Cloudinary
        const result = await cloudinary.uploader.upload(image, {
            folder: `webcam-captures/${sessionId}`,
            public_id: `${type}_${Date.now()}`,
            resource_type: "image"
        });

        // Save session info in memory
        if (!sessions[sessionId]) {
            sessions[sessionId] = {
                userName: name,
                timestamp: new Date().toLocaleString(),
                accessed: false,
                images: []
            };
        }
        sessions[sessionId].images.push(result.secure_url);

        res.sendStatus(200);
    } catch (err) {
        console.error("Cloudinary upload error:", err);
        res.sendStatus(500);
    }
});

// Admin login page
app.get("/admin", (req, res) => {
    if (req.session.loggedIn) return res.redirect("/admin/panel");
    res.render("admin_login");
});

// Admin login POST
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "ishan@@1008") {
        req.session.loggedIn = true;
        res.redirect("/admin/panel");
    } else {
        res.send("Invalid credentials");
    }
});

// Admin panel
app.get("/admin/panel", (req, res) => {
    if (!req.session.loggedIn) return res.redirect("/admin");
    res.render("admin", { sessions });
});

// Show captures
app.get("/show-captures/:id", (req, res) => {
    if (!req.session.loggedIn) return res.redirect("/admin");

    const id = req.params.id;
    const sessionData = sessions[id];
    if (!sessionData) return res.send("No data found");

    res.render("show_captures", { userName: sessionData.userName, images: sessionData.images });
});

// Delete session (delete from Cloudinary too)
app.delete("/delete-session/:id", async (req, res) => {
    const id = req.params.id;
    if (sessions[id]) {
        try {
            // Delete from Cloudinary
            for (let imgUrl of sessions[id].images) {
                const publicId = imgUrl.split("/").slice(-2).join("/").split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            }
        } catch (err) {
            console.error("Cloudinary delete error:", err);
        }

        delete sessions[id];
        return res.json({ success: true });
    }
    res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
