const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// Multer storage (uploads go directly to Cloudinary)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: "captures",
      format: "jpg",
      public_id: `${req.body.sessionId}_${req.body.type}_${Date.now()}`,
    };
  },
});
const upload = multer({ storage });

// Middleware
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(session({
  secret: "super-secret-key",
  resave: false,
  saveUninitialized: true
}));

// In-memory session storage
let sessions = {}; 
// sessions = { sessionId: { userName, timestamp, accessed, images: [] } }

// Home page
app.get("/", (req, res) => res.render("index"));

// Capture page
app.get("/capture", (req, res) => res.render("capture"));

// Upload route (now handles FormData with multer + Cloudinary)
app.post("/upload-photo", upload.single("photo"), (req, res) => {
  const { name, type, sessionId } = req.body;
  if (!req.file || !name || !type || !sessionId) return res.sendStatus(400);

  const imageUrl = req.file.path;

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      userName: name,
      timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      accessed: false,
      images: []
    };
  }

  sessions[sessionId].images.push(imageUrl);

  res.json({ success: true, url: imageUrl });
});

// Admin login page
app.get("/admin", (req, res) => {
  if (req.session.loggedIn) return res.redirect("/admin/panel");
  res.render("admin_login");
});

// Admin login POST
app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
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

  const images = sessionData.images;
  res.render("show_captures", { userName: sessionData.userName, images });
});

// Delete session
app.delete("/delete-session/:id", (req, res) => {
  const id = req.params.id;
  if (sessions[id]) {
    delete sessions[id]; // Cloudinary keeps images but session is removed
    return res.json({ success: true });
  }
  res.json({ success: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
