const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query: db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { uploadProfile, handleMulterError } = require('../middleware/upload');

// POST /api/register
router.post('/register',
  uploadProfile.single('profile_picture'),
  handleMulterError,
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('username').trim().notEmpty()
      .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username: letters, numbers, underscores only'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
  ],
  async (req, res) => {
    try {
      const setting = await db("SELECT value FROM platform_settings WHERE key = 'registrations_enabled'");
      if (setting.rows[0]?.value === 'false') return res.status(403).json({ error: 'Registrations are currently disabled.' });

      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { full_name, username, email, password } = req.body;
      const profile_picture = req.file ? `/uploads/profiles/${req.file.filename}` : null;

      const emailCheck = await db('SELECT id FROM users WHERE email = ?', [email]);
      if (emailCheck.rows.length > 0) return res.status(409).json({ error: 'Email already in use.' });

      const userCheck = await db('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
      if (userCheck.rows.length > 0) return res.status(409).json({ error: 'Username already taken.' });

      const password_hash = await bcrypt.hash(password, 12);

      const result = await db(
        `INSERT INTO users (full_name, username, email, password_hash, profile_picture) VALUES (?, ?, ?, ?, ?)`,
        [full_name, username.toLowerCase(), email, password_hash, profile_picture]
      );

      const user = await db('SELECT id, full_name, username, email, profile_picture, role FROM users WHERE rowid = ?', [result.rows[0]?.id]);
      res.status(201).json({ message: 'Account created successfully.', user: user.rows[0] });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error during registration.' });
    }
  }
);

// POST /api/login
router.post('/login',
  [
    body('identifier').trim().notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { identifier, password } = req.body;

      const result = await db(
        `SELECT * FROM users WHERE email = ? OR LOWER(username) = LOWER(?) LIMIT 1`,
        [identifier, identifier]
      );

      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid username/email or password.' });

      const user = result.rows[0];
      if (user.is_banned) return res.status(403).json({ error: 'Your account has been banned. Contact support.' });

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) return res.status(401).json({ error: 'Invalid username/email or password.' });

      await db("UPDATE users SET last_seen = datetime('now') WHERE id = ?", [user.id]);

      const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: 'Login successful.',
        token,
        user: {
          id: user.id, full_name: user.full_name, username: user.username,
          email: user.email, role: user.role, profile_picture: user.profile_picture,
          is_verified: !!user.is_verified, is_private: !!user.is_private,
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error during login.' });
    }
  }
);

// POST /api/logout
router.post('/logout', authenticateToken, async (req, res) => {
  await db("UPDATE users SET last_seen = datetime('now') WHERE id = ?", [req.user.id]);
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/me
router.get('/me', authenticateToken, async (req, res) => {
  const result = await db(
    `SELECT id, full_name, username, email, role, profile_picture, bio,
            is_private, is_verified, is_banned, last_seen, created_at FROM users WHERE id = ?`,
    [req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
  const u = result.rows[0];
  u.is_private = !!u.is_private; u.is_verified = !!u.is_verified; u.is_banned = !!u.is_banned;
  res.json({ user: u });
});

module.exports = router;
