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

// In-memory session data
let sessions = {}; // { id: { userName, timestamp, accessed, images: [] } }

// Home page
app.get("/", (req, res) => res.render("index"));

// Capture page
app.get("/capture", (req, res) => res.render("capture"));

// Upload route
app.post("/upload", (req, res) => {
    const { image, name, type } = req.body;
    if (!image || !name || !type) return res.sendStatus(400);

    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
    const filename = `${name}_${type}_${Date.now()}.jpg`;
    const uploadPath = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

    fs.writeFileSync(path.join(uploadPath, filename), base64Data, "base64");
    res.sendStatus(200);
});

// serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


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
