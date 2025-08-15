const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();

// Middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

// Static files
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // make uploads public

// Session for admin login
app.use(session({
    secret: "super-secret-key",
    resave: false,
    saveUninitialized: true
}));

// Store captured sessions
let sessions = {}; // { sessionId: { userName, timestamp, accessed, images: [] } }

// Home page
app.get("/", (req, res) => res.render("index"));

// Capture page
app.get("/capture", (req, res) => res.render("capture"));

// Upload route
app.post("/upload", (req, res) => {
    const { image, name, type, sessionId } = req.body;
    if (!image || !name || !type || !sessionId) return res.sendStatus(400);

    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
    const uploadDir = path.join(__dirname, "uploads", sessionId);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `${type}_${Date.now()}.jpg`;
    fs.writeFileSync(path.join(uploadDir, filename), base64Data, "base64");

    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            userName: name,
            timestamp: new Date().toLocaleString(),
            accessed: false,
            images: []
        };
    }
    sessions[sessionId].images.push(filename);

    res.sendStatus(200);
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

    const images = sessionData.images.map(img => `/uploads/${id}/${img}`);
    res.render("show_captures", { userName: sessionData.userName, images });
});

// Delete session
app.delete("/delete-session/:id", (req, res) => {
    const id = req.params.id;
    if (sessions[id]) {
        fs.rmSync(path.join(__dirname, "uploads", id), { recursive: true, force: true });
        delete sessions[id];
        return res.json({ success: true });
    }
    res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
