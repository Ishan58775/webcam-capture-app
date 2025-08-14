require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const cookieSession = require('cookie-session');

const app = express();
const upload = multer();

// Setup Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

// Cookie session for admin login
app.set('trust proxy', 1);
app.use(cookieSession({
  name: 'sid',
  keys: [process.env.COOKIE_SECRET || 'change_this_secret'],
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: true,
  httpOnly: true,
  sameSite: 'lax'
}));

// EJS views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => {
  res.render('admin_login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    req.session = { loggedIn: true };
    res.redirect('/admin/panel');
  } else {
    res.send('Invalid login');
  }
});

app.get('/admin/panel', (req, res) => {
  if (!req.session?.loggedIn) return res.redirect('/login');
  res.render('admin_panel');
});

// Upload photo
app.post('/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('No file received from frontend');
      return res.status(400).json({ error: 'No file received' });
    }

    console.log('Received file:', req.file.originalname || 'webcam_capture');

    const result = await new Promise((resolve, reject) => {
      let stream = cloudinary.uploader.upload_stream(
        { folder: 'webcam_captures' },
        (error, uploadResult) => {
          if (error) return reject(error);
          resolve(uploadResult);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    console.log('Cloudinary upload success:', result.secure_url);
    res.json({ url: result.secure_url });

  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
