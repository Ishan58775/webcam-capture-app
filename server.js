const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // make uploads public

// Admin session
app.use(session({
    secret: "super-secret-key",
    resave: false,
    saveUninitialized: true
}));

// In-memory session storage
let sessions = {}; 
// sessions = { sessionId: { userName, timestamp, accessed, images: [] } }

// Rebuild sessions from existing uploads on server start
const uploadsPath = path.join(__dirname, "uploads");
if (fs.existsSync(uploadsPath)) {
    const allSessions = fs.readdirSync(uploadsPath);
    allSessions.forEach(sessionId => {
        const folder = path.join(uploadsPath, sessionId);
        const metaFile = path.join(folder, "meta.json");
        if (fs.existsSync(metaFile)) {
            const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
            const images = fs.readdirSync(folder).filter(f => f.endsWith(".jpg"));
            sessions[sessionId] = { ...meta, images };
        }
    });
}

// Home page
app.get("/", (req, res) => res.render("index"));

// Capture page
app.get("/capture", (req, res) => res.render("capture"));

// Upload route
app.post("/upload", (req, res) => {
    const { image, name, type, sessionId } = req.body;
    if (!image || !name || !type || !sessionId) return res.sendStatus(400);

    const sessionFolder = path.join(__dirname, "uploads", sessionId);
    if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

    const filename = `${type}_${Date.now()}.jpg`;
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
    fs.writeFileSync(path.join(sessionFolder, filename), base64Data, "base64");

    // Store in memory
    const metaFile = path.join(sessionFolder, "meta.json");
    if (!sessions[sessionId]) {
        const meta = {
            userName: name,
            timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            accessed: false
        };
        fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
        sessions[sessionId] = { ...meta, images: [] };
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
