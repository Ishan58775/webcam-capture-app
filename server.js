const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
app.set("view engine", "ejs");
app.use(express.static("public"));

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

// Admin panel placeholder
app.get("/admin/panel", (req, res) => {
    const files = fs.readdirSync(path.join(__dirname, "uploads"));
    res.render("admin", { files });  // <-- match your admin.ejs file
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
