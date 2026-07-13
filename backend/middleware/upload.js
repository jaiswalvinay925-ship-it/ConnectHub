const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MAX_SIZE = (parseInt(process.env.MAX_FILE_SIZE) || 50) * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];
const ALLOWED_ALL_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];

const createStorage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`), false);
  }
};

const uploadPost = multer({
  storage: createStorage('posts'),
  limits: { fileSize: MAX_SIZE },
  fileFilter: fileFilter(ALLOWED_ALL_TYPES)
});

const uploadStory = multer({
  storage: createStorage('stories'),
  limits: { fileSize: MAX_SIZE },
  fileFilter: fileFilter(ALLOWED_ALL_TYPES)
});

const uploadProfile = multer({
  storage: createStorage('profiles'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_IMAGE_TYPES)
});

const uploadMessage = multer({
  storage: createStorage('messages'),
  limits: { fileSize: MAX_SIZE },
  fileFilter: fileFilter(ALLOWED_ALL_TYPES)
});

const uploadVerification = multer({
  storage: createStorage('verifications'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_DOC_TYPES)
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 10.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = { uploadPost, uploadStory, uploadProfile, uploadMessage, uploadVerification, handleMulterError };
